"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { attachMailbox, updateMailboxCredentials, isMailboxOwnedBy } from "@/lib/mail/mailbox";
import { testImapConnection } from "@/lib/mail/imap";
import { testSmtpConnection } from "@/lib/mail/smtp";
import { requireUser } from "@/lib/actions/session";
import { buildMailAccountSchema } from "@/lib/validations/mail-account";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

/**
 * Attaches a brand new mailbox to the logged-in user (mailboxId omitted),
 * or updates the credentials of one it already owns (mailboxId given).
 * Tests the connection live before ever saving anything either way, so a
 * typo doesn't lock the user out or leave a broken mailbox behind. There is
 * no IMAP/SMTP test anywhere in the *identity* signup flow anymore - see
 * lib/actions/signup.ts - only here, once the user is already authenticated.
 */
export async function setupMailbox(
  formData: unknown,
  mailboxId?: string
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const dict = getDictionary(await getLocale());

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`setup:${user.id}:${ip}`, 10, 60 * 60 * 1000)) {
    return { error: dict.errors.rateLimited };
  }

  const parsed = buildMailAccountSchema(dict).safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.errors.invalidForm };
  }
  const config = parsed.data;

  if (mailboxId && !(await isMailboxOwnedBy(mailboxId, user.id))) {
    return { error: dict.errors.mailboxNotFound };
  }

  try {
    await testImapConnection(config);
  } catch (error) {
    return { error: dict.mail.imapConnectionFailed(error instanceof Error ? error.message : dict.errors.unknownError) };
  }

  try {
    await testSmtpConnection(config);
  } catch (error) {
    return { error: dict.mail.smtpConnectionFailed(error instanceof Error ? error.message : dict.errors.unknownError) };
  }

  try {
    if (mailboxId) {
      await updateMailboxCredentials(mailboxId, config);
    } else {
      await attachMailbox(user.id, config);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: dict.settings.mailboxes.errors.emailAlreadyAttached };
    }
    throw error;
  }

  revalidatePath("/settings", "layout");
  return { error: null };
}
