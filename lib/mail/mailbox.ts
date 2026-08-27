import "server-only";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/mail/crypto";

export type MailboxConfig = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

/** A resolved mailbox: its connection config plus identity (id, owner). */
export type Mailbox = MailboxConfig & { id: string; userId: string };

type MailboxRow = {
  id: string;
  userId: string;
  email: string;
  encryptedPassword: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

function toMailbox(row: MailboxRow): Mailbox {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    password: decryptSecret(row.encryptedPassword),
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    imapSecure: row.imapSecure,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
  };
}

export async function getMailboxById(id: string): Promise<Mailbox | null> {
  const row = await prisma.mailbox.findUnique({ where: { id } });
  return row ? toMailbox(row) : null;
}

export async function listOwnMailboxes(userId: string): Promise<Mailbox[]> {
  const rows = await prisma.mailbox.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rows.map(toMailbox);
}

/**
 * Attaches a brand new mailbox to an already-authenticated user (Réglages).
 * The caller must have already live-tested the IMAP/SMTP connection
 * (lib/actions/setup.ts) - that's the only proof of ownership required, and
 * there is no IMAP test anywhere in the signup/identity flow anymore.
 */
export async function attachMailbox(userId: string, config: MailboxConfig): Promise<Mailbox> {
  const created = await prisma.mailbox.create({
    data: {
      userId,
      email: config.email,
      encryptedPassword: encryptSecret(config.password),
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      imapSecure: config.imapSecure,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
    },
  });

  // First mailbox this user ever gets access to (own or otherwise)? make it
  // the default automatically - see User.defaultMailboxId.
  await prisma.user.updateMany({
    where: { id: userId, defaultMailboxId: null },
    data: { defaultMailboxId: created.id },
  });

  return toMailbox(created);
}

/** Updates an existing mailbox's credentials (Réglages, or self-healing password rotation on login). Caller must check ownership first via isMailboxOwnedBy. */
export async function updateMailboxCredentials(mailboxId: string, config: MailboxConfig): Promise<void> {
  await prisma.mailbox.update({
    where: { id: mailboxId },
    data: {
      email: config.email,
      encryptedPassword: encryptSecret(config.password),
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      imapSecure: config.imapSecure,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
    },
  });
}

/** Detaches and deletes a mailbox entirely (cascades to its org shares/grants). Caller must check ownership first. */
export async function deleteMailbox(mailboxId: string): Promise<void> {
  await prisma.mailbox.delete({ where: { id: mailboxId } });
}

/** Ownership check used by every mailbox-management action (edit, delete, regenerate token, share into an org, set as default). */
export async function isMailboxOwnedBy(mailboxId: string, userId: string): Promise<boolean> {
  const count = await prisma.mailbox.count({ where: { id: mailboxId, userId } });
  return count > 0;
}

/**
 * The full set of mailboxes a user can act on via MCP (own + org access) -
 * see the module-level doc in prisma/schema.prisma for the exact rule:
 * own mailboxes ∪ (every mailbox shared in an org this user OWNs) ∪
 * (mailboxes this user has an explicit grant for in orgs where it's only a
 * MEMBER, direct or dynamically via a MailboxGroup). This is the single
 * source of truth for that resolution - route.ts and every server action
 * that needs "which mailboxes can this user reach" must go through this
 * rather than re-deriving it.
 */
export async function listAccessibleMailboxes(userId: string): Promise<Mailbox[]> {
  const [own, memberships] = await Promise.all([
    prisma.mailbox.findMany({ where: { userId } }),
    prisma.organizationMember.findMany({
      where: { userId },
      select: { id: true, role: true, organizationId: true },
    }),
  ]);

  const ownerOrgIds = memberships.filter((m) => m.role === "OWNER").map((m) => m.organizationId);
  const memberEntries = memberships.filter((m) => m.role === "MEMBER");
  const memberIds = memberEntries.map((m) => m.id);
  const memberOrgByMemberId = new Map(memberEntries.map((m) => [m.id, m.organizationId]));

  const [ownerShares, memberOrgShares, grants] = await Promise.all([
    ownerOrgIds.length
      ? prisma.organizationMailbox.findMany({
          where: { organizationId: { in: ownerOrgIds } },
          include: { mailbox: true },
        })
      : Promise.resolve([]),
    // Needed to defensively re-validate direct grants below: a grant's
    // mailboxId points straight at Mailbox (see schema.prisma), so it
    // doesn't automatically stop being valid when the mailbox is unshared
    // from the org (unsharing deletes the OrganizationMailbox row, and
    // lib/actions/organization.ts's unshareMailboxFromOrganization()
    // proactively cleans up matching grants too - this is just a second
    // line of defense against the two ever drifting apart).
    memberEntries.length
      ? prisma.organizationMailbox.findMany({
          where: { organizationId: { in: memberEntries.map((m) => m.organizationId) } },
          select: { organizationId: true, mailboxId: true },
        })
      : Promise.resolve([]),
    memberIds.length
      ? prisma.organizationMailboxGrant.findMany({
          where: { organizationMemberId: { in: memberIds } },
          include: {
            mailbox: true,
            mailboxGroup: {
              include: {
                mailboxes: { include: { organizationMailbox: { include: { mailbox: true } } } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const sharedPairs = new Set(memberOrgShares.map((s) => `${s.organizationId}:${s.mailboxId}`));

  const byId = new Map<string, MailboxRow>();
  for (const row of own) byId.set(row.id, row);
  for (const share of ownerShares) byId.set(share.mailbox.id, share.mailbox);
  for (const grant of grants) {
    if (grant.mailbox) {
      // Non-null by construction: this query filtered on
      // organizationMemberId: { in: memberIds }, so every row it returns
      // has one - the column is only nullable in general because a grant
      // can *also* target a still-pending OrganizationInvite instead (see
      // schema.prisma), which is irrelevant here (a pending invitee has no
      // OrganizationMember yet, hence can't authenticate as one).
      const organizationId = memberOrgByMemberId.get(grant.organizationMemberId!);
      if (organizationId && sharedPairs.has(`${organizationId}:${grant.mailbox.id}`)) {
        byId.set(grant.mailbox.id, grant.mailbox);
      }
    }
    if (grant.mailboxGroup) {
      for (const gm of grant.mailboxGroup.mailboxes) {
        const mailbox = gm.organizationMailbox.mailbox;
        byId.set(mailbox.id, mailbox);
      }
    }
  }

  return [...byId.values()].map(toMailbox);
}

/**
 * Resolves which mailbox a user-scoped (OAuth) MCP connector should act on:
 * `selector` is the `mailbox` tool argument (an email), or undefined to
 * fall back to the user's configured default, or, failing that, the first
 * mailbox it can access. Returns null if the user has no accessible
 * mailbox at all, or if `selector` doesn't match any of them.
 */
export async function resolveAccessibleMailbox(
  userId: string,
  selector: string | undefined
): Promise<{ mailbox: Mailbox; accessible: Mailbox[] } | null> {
  const accessible = await listAccessibleMailboxes(userId);
  if (accessible.length === 0) return null;

  if (selector) {
    const match = accessible.find((m) => m.email === selector);
    return match ? { mailbox: match, accessible } : null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { defaultMailboxId: true } });
  const defaultMailbox = user?.defaultMailboxId
    ? accessible.find((m) => m.id === user.defaultMailboxId)
    : undefined;

  return { mailbox: defaultMailbox ?? accessible[0], accessible };
}
