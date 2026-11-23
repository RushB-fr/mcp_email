import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { MailboxConfig } from "@/lib/mail/mailbox";
import { appendToSent } from "@/lib/mail/imap";

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

  // Fixed here so the copy filed in Sent carries the same Message-ID and Date as the sent mail.
  const date = new Date();
  const messageId = `<${randomUUID()}@${account.email.split("@")[1] ?? "localhost"}>`;
  const mail = {
    from: account.email,
    to: args.to,
    cc: args.cc,
    bcc: args.bcc,
    subject: args.subject,
    text: args.text,
    date,
    messageId,
  };

  const info = await transporter.sendMail(mail);

  // SMTP does not file anything in Sent: the IMAP side has to be told. The mail has left by now,
  // so a failure here is logged and must never be reported as a failed send.
  try {
    const raw = await nodemailer
      .createTransport({ streamTransport: true, buffer: true, newline: "unix" })
      .sendMail({ ...mail, bcc: undefined });
    await appendToSent(account, raw.message as Buffer, date);
  } catch (error) {
    console.error("[mail] sent, but the copy could not be saved in the Sent folder:", error);
  }

  return info.messageId ?? messageId;
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
