"use server";

import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, generateMcpToken } from "@/lib/user/user";
import { buildSignupSchema } from "@/lib/validations/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getTrustedAppBaseUrl, AppBaseUrlNotConfiguredError } from "@/lib/http";
import { sendTransactionalEmail, TransactionalEmailNotConfiguredError } from "@/lib/email/mailer";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a brand new, mailbox-less identity (invite-gated: no open public
 * signup - see the Invite model). No IMAP/SMTP test happens here anymore:
 * attaching a mailbox is a separate step done from Réglages once logged in
 * (see lib/actions/setup.ts). The account can't log in until the
 * verification email is confirmed (see verifyEmail() below).
 */
export async function redeemInvite(formData: unknown): Promise<{ error: string | null; verifying?: boolean }> {
  const dict = getDictionary(await getLocale());

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`signup:${ip}`, 10, 60 * 60 * 1000)) {
    return { error: dict.errors.rateLimited };
  }

  const parsed = buildSignupSchema(dict).safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.errors.invalidForm };
  }
  const { token, email, password } = parsed.data;

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: dict.auth.signup.errors.invalidOrExpiredInvite };
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = randomBytes(32).toString("base64url");

  // Account creation and invite consumption must commit atomically, same
  // as before.
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, mcpToken: generateMcpToken() } });
      await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      await tx.verificationToken.create({
        data: {
          identifier: user.email,
          token: verificationToken,
          expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: dict.auth.signup.errors.emailTaken };
    }
    throw error;
  }

  // The account already exists at this point (transaction above committed):
  // a config problem here is reported the same way as a failed send below
  // (account created, but stuck until an admin fixes the server config) -
  // getTrustedAppBaseUrl() throws rather than falling back to a
  // client-controllable header for a link that's about to be emailed out.
  // Composed in `dict`'s language - the locale active when the user
  // submitted this form - so the email lands in the language they picked.
  try {
    const verifyUrl = `${await getTrustedAppBaseUrl()}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    await sendTransactionalEmail({
      to: email,
      subject: dict.email.verify.subject,
      text: dict.email.verify.body(verifyUrl),
    });
  } catch (error) {
    if (error instanceof TransactionalEmailNotConfiguredError || error instanceof AppBaseUrlNotConfiguredError) {
      return { error: dict.auth.signup.errors.verificationEmailFailed };
    }
    throw error;
  }

  return { error: null, verifying: true };
}

export async function verifyEmail(token: string, email: string): Promise<{ error: string | null }> {
  const dict = getDictionary(await getLocale());

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`verify-email:${ip}`, 20, 60 * 60 * 1000)) {
    return { error: dict.errors.rateLimited };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });
  if (!record || record.expires < new Date()) {
    return { error: dict.auth.verifyEmail.errors.invalidOrExpiredLink };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token } } }),
  ]);

  return { error: null };
}
