"use server";

import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/actions/session";
import { isMailboxOwnedBy } from "@/lib/mail/mailbox";
import { getTrustedAppBaseUrl, AppBaseUrlNotConfiguredError } from "@/lib/http";
import { sendTransactionalEmail, TransactionalEmailNotConfiguredError } from "@/lib/email/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  buildOrganizationNameSchema,
  buildOrganizationInviteSchema,
  buildMailboxGroupNameSchema,
  buildMailboxGroupRenameSchema,
} from "@/lib/validations/auth";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

const ORG_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function requireMembership(organizationId: string, userId: string) {
  const dict = getDictionary(await getLocale());
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) throw new Error(dict.settings.organizations.errors.notMember);
  return membership;
}

async function requireOwner(organizationId: string, userId: string) {
  const dict = getDictionary(await getLocale());
  const membership = await requireMembership(organizationId, userId);
  if (membership.role !== "OWNER") throw new Error(dict.settings.organizations.errors.ownersOnly);
  return membership;
}

export async function listMyOrganizations() {
  const user = await requireUser();
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
    createdAt: m.organization.createdAt.toISOString(),
  }));
}

export async function createOrganization(formData: unknown): Promise<{ error: string | null; id?: string }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`org-create:${user.id}:${ip}`, 10, 60 * 60 * 1000)) {
    return { error: dict.errors.rateLimited };
  }

  const parsed = buildOrganizationNameSchema(dict).safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.errors.invalidForm };
  }

  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: parsed.data.name, createdByUserId: user.id },
    });
    await tx.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: "OWNER" },
    });
    return org;
  });

  revalidatePath("/settings", "layout");
  return { error: null, id: organization.id };
}

/**
 * Full detail view of an organization for the current member: its
 * mailboxes, its groups (with their mailboxes), its members, and - for
 * OWNERs only - every grant currently in effect (a MEMBER only ever sees
 * their own).
 */
export async function getOrganizationDetail(organizationId: string) {
  const user = await requireUser();
  const membership = await requireMembership(organizationId, user.id);

  const [organization, members, mailboxes, groups] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organizationMailbox.findMany({
      where: { organizationId },
      include: { mailbox: { include: { owner: { select: { email: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mailboxGroup.findMany({
      where: { organizationId },
      include: { mailboxes: { include: { organizationMailbox: { include: { mailbox: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const pendingInvites =
    membership.role === "OWNER"
      ? await prisma.organizationInvite.findMany({
          where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // For an OWNER, grants targeting either an enrolled member or a still-
  // pending invite in this org are both visible (they manage both). A
  // MEMBER only ever sees their own (invite-targeted grants are never
  // relevant to a non-owner - only an OWNER manages invites).
  const grants = await prisma.organizationMailboxGrant.findMany({
    where:
      membership.role === "OWNER"
        ? { OR: [{ member: { organizationId } }, { invite: { organizationId } }] }
        : { organizationMemberId: membership.id },
    include: {
      member: { include: { user: { select: { email: true } } } },
      invite: true,
      mailbox: true,
      mailboxGroup: {
        include: {
          mailboxes: { include: { organizationMailbox: { include: { mailbox: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    id: organization.id,
    name: organization.name,
    myRole: membership.role,
    /** The caller's own OrganizationMember id - lets the UI identify its own row in `members` below (e.g. to gate self-removal or exclude itself as an ownership-transfer target). */
    myMemberId: membership.id,
    members: members.map((m) => ({ id: m.id, userId: m.userId, email: m.user.email, role: m.role })),
    mailboxes: mailboxes.map((om) => ({
      organizationMailboxId: om.id,
      mailboxId: om.mailboxId,
      email: om.mailbox.email,
      ownerEmail: om.mailbox.owner.email,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      mailboxes: g.mailboxes.map((gm) => ({
        organizationMailboxId: gm.organizationMailboxId,
        mailboxId: gm.organizationMailbox.mailbox.id,
        email: gm.organizationMailbox.mailbox.email,
      })),
    })),
    pendingInvites: pendingInvites.map((i) => ({
      id: i.id,
      email: i.email,
      expiresAt: i.expiresAt.toISOString(),
    })),
    grants: grants.map((g) => ({
      id: g.id,
      // Exactly one of these two is set - mirrors the schema's own
      // "exactly one target" CHECK constraint.
      targetKind: g.organizationMemberId ? ("member" as const) : ("invite" as const),
      targetId: g.organizationMemberId ?? g.organizationInviteId!,
      targetEmail: g.member?.user.email ?? g.invite!.email,
      pending: g.organizationInviteId !== null,
      mailboxEmail: g.mailbox?.email ?? null,
      mailboxGroupName: g.mailboxGroup?.name ?? null,
      mailboxGroupMailboxes: g.mailboxGroup?.mailboxes.map((gm) => gm.organizationMailbox.mailbox.email) ?? [],
    })),
  };
}

/**
 * Invites a member by email (OWNER only). If the email has no User yet,
 * the invite is still created and emailed, but acceptance is blocked until
 * one exists - see acceptOrganizationInvite(). Org membership is
 * intentionally decoupled from the platform's invite-gated signup (see
 * Invite vs OrganizationInvite doc comments in schema.prisma): this never
 * creates a User.
 */
export async function inviteOrganizationMember(formData: unknown): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const parsed = buildOrganizationInviteSchema(dict).safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.errors.invalidForm };
  }
  const { organizationId, email } = parsed.data;

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`org-invite:${user.id}:${ip}`, 20, 60 * 60 * 1000)) {
    return { error: dict.errors.rateLimited };
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: dict.settings.organizations.errors.notFound };
  await requireOwner(organizationId, user.id);

  const existingMember = await prisma.organizationMember.findFirst({
    where: { organizationId, user: { email } },
  });
  if (existingMember) return { error: dict.settings.organizations.errors.alreadyMember };

  const token = randomBytes(24).toString("base64url");
  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId,
      email,
      token,
      expiresAt: new Date(Date.now() + ORG_INVITE_TTL_MS),
    },
  });

  // getTrustedAppBaseUrl() requires APP_BASE_URL rather than falling back to
  // a client-controllable Host/X-Forwarded-Host header: this link goes out
  // by email to the invitee, so a spoofed header here would mean the app's
  // own legitimate sender mailing them a link to an attacker-chosen domain.
  try {
    const acceptUrl = `${await getTrustedAppBaseUrl()}/org-invite/accept?token=${invite.token}`;
    await sendTransactionalEmail({
      to: email,
      subject: dict.email.orgInvite.subject(organization.name),
      text: dict.email.orgInvite.body(user.email, organization.name, acceptUrl),
    });
  } catch (error) {
    if (error instanceof TransactionalEmailNotConfiguredError || error instanceof AppBaseUrlNotConfiguredError) {
      return { error: dict.settings.organizations.errors.inviteEmailFailed };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function acceptOrganizationInvite(token: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  const invite = await prisma.organizationInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return { error: dict.orgInvite.errors.invalidOrExpired };
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { error: dict.orgInvite.errors.wrongAccount(invite.email, user.email) };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const member = await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
        create: { organizationId: invite.organizationId, userId: user.id, role: "MEMBER" },
        update: {},
      });
      await tx.organizationInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

      // Carry over any access the owner set up for this invitee before they
      // enrolled (see Réglages > Organisation, and the schema's doc comment
      // on OrganizationMailboxGrant) - re-pointing each grant at the real
      // member instead of the now-accepted invite. If an equivalent grant
      // already exists for this member (edge case: they were already a
      // member and got re-invited), drop the redundant pending one instead
      // of violating the member-scoped unique constraint.
      const pendingGrants = await tx.organizationMailboxGrant.findMany({
        where: { organizationInviteId: invite.id },
      });
      for (const grant of pendingGrants) {
        const duplicate = await tx.organizationMailboxGrant.findFirst({
          where: { organizationMemberId: member.id, mailboxId: grant.mailboxId, mailboxGroupId: grant.mailboxGroupId },
        });
        if (duplicate) {
          await tx.organizationMailboxGrant.delete({ where: { id: grant.id } });
        } else {
          await tx.organizationMailboxGrant.update({
            where: { id: grant.id },
            data: { organizationMemberId: member.id, organizationInviteId: null },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { error: dict.orgInvite.errors.acceptFailed };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

/** Cancels a still-pending invitation (OWNER only) - cascades deletion of any grants already set up for it. */
export async function cancelOrganizationInvite(inviteId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { error: dict.settings.organizations.errors.inviteNotFound };
  await requireOwner(invite.organizationId, user.id);

  if (invite.acceptedAt) {
    return { error: dict.settings.organizations.errors.inviteAlreadyAccepted };
  }

  await prisma.organizationInvite.delete({ where: { id: inviteId } });
  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function removeOrganizationMember(memberId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  const member = await prisma.organizationMember.findUnique({ where: { id: memberId } });
  if (!member) return { error: dict.settings.organizations.errors.memberNotFound };
  await requireOwner(member.organizationId, user.id);

  if (member.role === "OWNER") {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: member.organizationId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: dict.settings.organizations.errors.cannotRemoveLastOwner };
    }
  }

  await prisma.organizationMember.delete({ where: { id: memberId } });
  revalidatePath("/settings", "layout");
  return { error: null };
}

/**
 * Hands off ownership to an already-enrolled MEMBER of the same org (OWNER
 * only): the target becomes OWNER, and the caller's own membership is
 * demoted to MEMBER in the same transaction. This is a full handoff, not
 * adding a co-owner - the org always keeps exactly one OWNER, same as
 * today, so the caller loses the automatic full-access behaviour of an
 * OWNER right away (they keep only whatever MEMBER access is explicitly
 * granted to them afterwards). The target must already be an enrolled
 * OrganizationMember with role MEMBER - a still-pending OrganizationInvite
 * has no such row yet (see acceptOrganizationInvite()), so it can never be
 * an ownership-transfer target.
 */
export async function transferOrganizationOwnership(
  organizationId: string,
  newOwnerMemberId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const membership = await requireOwner(organizationId, user.id);

  const newOwner = await prisma.organizationMember.findUnique({ where: { id: newOwnerMemberId } });
  if (!newOwner || newOwner.organizationId !== organizationId) {
    return { error: dict.settings.organizations.errors.memberNotFound };
  }
  // Excludes the caller's own row too: an OWNER is never a valid transfer
  // target (they already have full access), which also means a no-op
  // "transfer to myself" is rejected here rather than silently succeeding.
  if (newOwner.role !== "MEMBER") {
    return { error: dict.settings.organizations.errors.transferTargetMustBeMember };
  }

  await prisma.$transaction([
    prisma.organizationMember.update({ where: { id: newOwner.id }, data: { role: "OWNER" } }),
    prisma.organizationMember.update({ where: { id: membership.id }, data: { role: "MEMBER" } }),
  ]);

  revalidatePath("/settings", "layout");
  return { error: null };
}

/** Shares a mailbox the caller owns into an organization they belong to (any role - it's their own resource). */
export async function shareMailboxToOrganization(
  organizationId: string,
  mailboxId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  await requireMembership(organizationId, user.id);

  if (!(await isMailboxOwnedBy(mailboxId, user.id))) {
    return { error: dict.settings.organizations.errors.notMailboxOwner };
  }

  try {
    await prisma.organizationMailbox.create({ data: { organizationId, mailboxId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: dict.settings.organizations.errors.alreadySharedInOrg };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

/**
 * Unshares a mailbox from an organization (its owner, or any org OWNER, can
 * do this). Deleting the OrganizationMailbox row cascades cleanup of any
 * MailboxGroupMailbox rows referencing it; direct OrganizationMailboxGrant
 * rows for that mailbox are cleaned up explicitly here since that FK points
 * at Mailbox directly rather than at OrganizationMailbox (see
 * schema.prisma) - listAccessibleMailboxes() also defensively re-checks
 * that a directly-granted mailbox is still shared, so a grant surviving
 * here would be inert, but removing it keeps Réglages honest.
 */
export async function unshareMailboxFromOrganization(
  organizationId: string,
  mailboxId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const membership = await requireMembership(organizationId, user.id);

  const ownsMailbox = await isMailboxOwnedBy(mailboxId, user.id);
  if (!ownsMailbox && membership.role !== "OWNER") {
    return { error: dict.settings.organizations.errors.ownerOrOrgOwnerOnly };
  }

  await prisma.$transaction([
    prisma.organizationMailboxGrant.deleteMany({
      where: { mailboxId, member: { organizationId } },
    }),
    prisma.organizationMailbox.deleteMany({ where: { organizationId, mailboxId } }),
  ]);

  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function createMailboxGroup(formData: unknown): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const parsed = buildMailboxGroupNameSchema(dict).safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.errors.invalidForm };
  }
  const { organizationId, name } = parsed.data;
  await requireOwner(organizationId, user.id);

  await prisma.mailboxGroup.create({ data: { organizationId, name } });
  revalidatePath("/settings", "layout");
  return { error: null };
}

/** Renames an existing group (OWNER only) - same name validation rule as createMailboxGroup. */
export async function renameMailboxGroup(mailboxGroupId: string, name: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const parsed = buildMailboxGroupRenameSchema(dict).safeParse({ mailboxGroupId, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.errors.invalidForm };
  }

  const group = await prisma.mailboxGroup.findUnique({ where: { id: mailboxGroupId } });
  if (!group) return { error: dict.settings.organizations.errors.groupNotFound };
  await requireOwner(group.organizationId, user.id);

  await prisma.mailboxGroup.update({ where: { id: mailboxGroupId }, data: { name: parsed.data.name } });
  revalidatePath("/settings", "layout");
  return { error: null };
}

/**
 * Deletes a group entirely (OWNER only) - not just its individual mailbox
 * memberships (see removeMailboxFromGroup for that). MailboxGroupMailbox
 * rows and any OrganizationMailboxGrant pointing at this group both cascade
 * on delete (onDelete: Cascade in schema.prisma), so no orphaned row is
 * left behind: members who only had access through this group's grant
 * simply lose that access, exactly as if each grant had been revoked
 * individually first.
 */
export async function deleteMailboxGroup(mailboxGroupId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  const group = await prisma.mailboxGroup.findUnique({ where: { id: mailboxGroupId } });
  if (!group) return { error: dict.settings.organizations.errors.groupNotFound };
  await requireOwner(group.organizationId, user.id);

  await prisma.mailboxGroup.delete({ where: { id: mailboxGroupId } });
  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function addMailboxToGroup(
  mailboxGroupId: string,
  organizationMailboxId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const group = await prisma.mailboxGroup.findUnique({ where: { id: mailboxGroupId } });
  if (!group) return { error: dict.settings.organizations.errors.groupNotFound };
  await requireOwner(group.organizationId, user.id);

  const share = await prisma.organizationMailbox.findUnique({ where: { id: organizationMailboxId } });
  if (!share || share.organizationId !== group.organizationId) {
    return { error: dict.settings.organizations.errors.mailboxNotSharedInOrg };
  }

  try {
    await prisma.mailboxGroupMailbox.create({
      data: { mailboxGroupId, organizationMailboxId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: dict.settings.organizations.errors.alreadyInGroup };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function removeMailboxFromGroup(
  mailboxGroupId: string,
  organizationMailboxId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const group = await prisma.mailboxGroup.findUnique({ where: { id: mailboxGroupId } });
  if (!group) return { error: dict.settings.organizations.errors.groupNotFound };
  await requireOwner(group.organizationId, user.id);

  await prisma.mailboxGroupMailbox.deleteMany({ where: { mailboxGroupId, organizationMailboxId } });
  revalidatePath("/settings", "layout");
  return { error: null };
}

/** A grant can target an already-enrolled member or a still-pending invite - see the schema's doc comment on OrganizationMailboxGrant. */
export type GrantTarget = { kind: "member"; id: string } | { kind: "invite"; id: string };

/** Resolves a grant target to its organizationId, and rejects targeting an OWNER (who already has full access by construction) or an already-accepted invite. */
async function resolveGrantTarget(
  target: GrantTarget
): Promise<{ organizationId: string } | { error: string }> {
  const dict = getDictionary(await getLocale());
  if (target.kind === "member") {
    const member = await prisma.organizationMember.findUnique({ where: { id: target.id } });
    if (!member) return { error: dict.settings.organizations.errors.memberNotFound };
    if (member.role === "OWNER") {
      return { error: dict.settings.organizations.errors.memberAlreadyOwner };
    }
    return { organizationId: member.organizationId };
  }

  const invite = await prisma.organizationInvite.findUnique({ where: { id: target.id } });
  if (!invite) return { error: dict.settings.organizations.errors.inviteNotFound };
  if (invite.acceptedAt) {
    return { error: dict.settings.organizations.errors.inviteAlreadyAccepted };
  }
  return { organizationId: invite.organizationId };
}

/** Grants access to one mailbox already shared in the org, to a member or a still-pending invite (OWNER only). */
export async function grantMailboxAccess(
  target: GrantTarget,
  mailboxId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const resolved = await resolveGrantTarget(target);
  if ("error" in resolved) return resolved;
  await requireOwner(resolved.organizationId, user.id);

  const share = await prisma.organizationMailbox.findUnique({
    where: { organizationId_mailboxId: { organizationId: resolved.organizationId, mailboxId } },
  });
  if (!share) return { error: dict.settings.organizations.errors.mailboxNotSharedInOrg };

  try {
    await prisma.organizationMailboxGrant.create({
      data:
        target.kind === "member"
          ? { organizationMemberId: target.id, mailboxId }
          : { organizationInviteId: target.id, mailboxId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: dict.settings.organizations.errors.grantAlreadyExists };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

/** Grants dynamic access to every mailbox currently and later in a group, to a member or a still-pending invite (OWNER only). */
export async function grantMailboxGroupAccess(
  target: GrantTarget,
  mailboxGroupId: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const resolved = await resolveGrantTarget(target);
  if ("error" in resolved) return resolved;
  await requireOwner(resolved.organizationId, user.id);

  const group = await prisma.mailboxGroup.findUnique({ where: { id: mailboxGroupId } });
  if (!group || group.organizationId !== resolved.organizationId) {
    return { error: dict.settings.organizations.errors.groupNotInOrg };
  }

  try {
    await prisma.organizationMailboxGrant.create({
      data:
        target.kind === "member"
          ? { organizationMemberId: target.id, mailboxGroupId }
          : { organizationInviteId: target.id, mailboxGroupId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: dict.settings.organizations.errors.grantAlreadyExists };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function revokeMailboxGrant(grantId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const grant = await prisma.organizationMailboxGrant.findUnique({
    where: { id: grantId },
    include: { member: true, invite: true },
  });
  if (!grant) return { error: dict.settings.organizations.errors.grantNotFound };
  const organizationId = grant.member?.organizationId ?? grant.invite?.organizationId;
  if (!organizationId) return { error: dict.settings.organizations.errors.grantNotFound };
  await requireOwner(organizationId, user.id);

  await prisma.organizationMailboxGrant.delete({ where: { id: grantId } });
  revalidatePath("/settings", "layout");
  return { error: null };
}
