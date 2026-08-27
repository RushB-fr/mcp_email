import "server-only";
import nodemailer from "nodemailer";

/**
 * Sender for *system* transactional emails (signup verification, org
 * invitations) - deliberately a separate SMTP config from any user Mailbox
 * (lib/mail/smtp.ts): those are pilotable inboxes tied to a User, this is
 * the platform's own outgoing address. Optional at the env level (self-
 * hosted deployments may not need email verification wired up on day one),
 * but flows that need to send one fail loudly with a clear message rather
 * than silently pretending to have sent something unusable.
 */
function getTransport() {
  const host = process.env.SMTP_FROM_HOST;
  const port = process.env.SMTP_FROM_PORT;
  const user = process.env.SMTP_FROM_USER;
  const password = process.env.SMTP_FROM_PASSWORD;
  if (!host || !port || !user || !password) return null;

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_FROM_SECURE !== "false",
    auth: { user, pass: password },
  });
}

export class TransactionalEmailNotConfiguredError extends Error {
  constructor() {
    super(
      "SMTP_FROM_* n'est pas configuré côté serveur : impossible d'envoyer cet email. Voir .env.example."
    );
    this.name = "TransactionalEmailNotConfiguredError";
  }
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const transport = getTransport();
  const fromAddress = process.env.SMTP_FROM_ADDRESS ?? process.env.SMTP_FROM_USER;

  if (!transport || !fromAddress) {
    // Always surface the content server-side, even when misconfigured: in
    // self-hosted/dev setups without SMTP_FROM_* wired up yet, this is the
    // difference between "totally stuck" and "grab the link from the logs".
    console.warn(
      `[email] SMTP_FROM_* not configured - would have sent to ${params.to}: "${params.subject}"\n${params.text}`
    );
    throw new TransactionalEmailNotConfiguredError();
  }

  const fromName = process.env.SMTP_FROM_NAME;
  await transport.sendMail({
    from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
