"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/actions/session";
import { listOwnMailboxes, listAccessibleMailboxes, isMailboxOwnedBy, deleteMailbox } from "@/lib/mail/mailbox";
import { setDefaultMailbox as setUserDefaultMailbox } from "@/lib/user/user";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

export async function getMyMailboxes() {
  const user = await requireUser();
  const mailboxes = await listOwnMailboxes(user.id);
  return mailboxes.map((m) => ({
    id: m.id,
    email: m.email,
    imapHost: m.imapHost,
    imapPort: m.imapPort,
    imapSecure: m.imapSecure,
    smtpHost: m.smtpHost,
    smtpPort: m.smtpPort,
    smtpSecure: m.smtpSecure,
    isDefault: m.id === user.defaultMailboxId,
  }));
}

/** Everything reachable via MCP for this user (own + shared via an org) - used to populate the "default mailbox" picker in Réglages. */
export async function getMyAccessibleMailboxes() {
  const user = await requireUser();
  const accessible = await listAccessibleMailboxes(user.id);
  return accessible.map((m) => ({ id: m.id, email: m.email, isDefault: m.id === user.defaultMailboxId }));
}

export async function setDefaultMailbox(mailboxId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  const accessible = await listAccessibleMailboxes(user.id);
  if (!accessible.some((m) => m.id === mailboxId)) {
    return { error: dict.settings.mailboxes.errors.notAccessible };
  }
  await setUserDefaultMailbox(user.id, mailboxId);
  revalidatePath("/settings", "layout");
  return { error: null };
}

export async function deleteMyMailbox(mailboxId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!(await isMailboxOwnedBy(mailboxId, user.id))) {
    return { error: dict.errors.mailboxNotFound };
  }

  await deleteMailbox(mailboxId);

  // If it was the default, fall back to whatever is still accessible.
  if (user.defaultMailboxId === mailboxId) {
    const remaining = await listAccessibleMailboxes(user.id);
    await setUserDefaultMailbox(user.id, remaining[0]?.id ?? null);
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}

/** All organizations a mailbox owner belongs to, for the "share into org" picker. */
export async function getMyOrganizationsForSharing() {
  const user = await requireUser();
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { select: { id: true, name: true } } },
  });
  return memberships.map((m) => ({ id: m.organization.id, name: m.organization.name }));
}
