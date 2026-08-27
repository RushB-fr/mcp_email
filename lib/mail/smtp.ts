import "server-only";
import nodemailer from "nodemailer";
import type { MailboxConfig } from "@/lib/mail/mailbox";

export async function sendEmail(
  account: MailboxConfig,
  args: {
    to: string;
    subject: string;
    text: string;
    cc?: string;
    bcc?: string;
  }
): Promise<string> {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: { user: account.email, pass: account.password },
  });

  const info = await transporter.sendMail({
    from: account.email,
    to: args.to,
    cc: args.cc,
    bcc: args.bcc,
    subject: args.subject,
    text: args.text,
  });

  return info.messageId;
}

/** Verifies SMTP credentials without sending anything - used by the setup form. */
export async function testSmtpConnection(config: MailboxConfig): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.email, pass: config.password },
  });
  await transporter.verify();
}
