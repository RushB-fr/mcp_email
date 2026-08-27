"use server";

import { requireUser } from "@/lib/actions/session";
import { getMailboxById, isMailboxOwnedBy } from "@/lib/mail/mailbox";
import { listFolders } from "@/lib/mail/imap";
import { describeMailError } from "@/lib/mail/errors";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

export async function testMailConnection(mailboxId: string): Promise<{ error: string | null; folders?: string[] }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  if (!(await isMailboxOwnedBy(mailboxId, user.id))) {
    return { error: dict.errors.mailboxNotFound };
  }

  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox) return { error: dict.errors.mailboxNotFound };

  try {
    const folders = await listFolders(mailbox);
    return { error: null, folders };
  } catch (error) {
    return { error: describeMailError(error, dict) };
  }
}
