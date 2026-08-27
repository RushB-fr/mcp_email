import "server-only";
import { format } from "date-fns";
import { listFolders, searchEmails, getEmail, setSeenFlag } from "@/lib/mail/imap";
import { sendEmail } from "@/lib/mail/smtp";
import { describeMailError } from "@/lib/mail/errors";
import { fr } from "@/lib/i18n/dictionaries/fr";
import type { MailboxConfig } from "@/lib/mail/mailbox";

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function formatDate(iso: string | null): string {
  if (!iso) return "date inconnue";
  try {
    return format(new Date(iso), "d MMM HH:mm");
  } catch {
    return iso;
  }
}

/**
 * Lists every mailbox this connector can act on via the `mailbox` selector
 * (see route.ts) - own mailboxes plus whatever is reachable via an
 * organization, resolved by lib/mail/mailbox.ts's listAccessibleMailboxes.
 * Same resolution regardless of whether the bearer token is a static
 * per-mailbox token or an OAuth access token - both authenticate as a user,
 * not a single mailbox.
 */
export function listMailboxesTool(mailboxes: { email: string; isDefault: boolean }[]): ToolResult {
  if (mailboxes.length === 0) {
    return ok("Aucune boîte mail accessible.");
  }
  return ok(mailboxes.map((m) => `- ${m.email}${m.isDefault ? " (par défaut)" : ""}`).join("\n"));
}

export async function listFoldersTool(account: MailboxConfig): Promise<ToolResult> {
  try {
    const folders = await listFolders(account);
    if (folders.length === 0) return ok("Aucun dossier trouvé.");
    return ok(folders.map((f) => `- ${f}`).join("\n"));
  } catch (error) {
    return err(describeMailError(error, fr));
  }
}

export async function searchEmailsTool(
  account: MailboxConfig,
  args: {
    folder?: string;
    from?: string;
    subject?: string;
    bodyContains?: string;
    unreadOnly?: boolean;
    sinceDays?: number;
    limit?: number;
  }
): Promise<ToolResult> {
  try {
    const results = await searchEmails(account, args);
    if (results.length === 0) return ok("Aucun email ne correspond.");
    return ok(
      results
        .map(
          (e) =>
            `- ${e.seen ? "" : "[non lu] "}"${e.subject}" de ${e.from} · ${formatDate(e.date)} [uid: ${e.uid}]`
        )
        .join("\n")
    );
  } catch (error) {
    return err(describeMailError(error, fr));
  }
}

export async function getEmailTool(
  account: MailboxConfig,
  args: { uid: number; folder?: string }
): Promise<ToolResult> {
  try {
    const email = await getEmail(account, args.uid, args.folder);
    if (!email) return err(`Aucun email trouvé avec l'uid "${args.uid}".`);
    return ok(
      `De : ${email.from}\nÀ : ${email.to}\nSujet : ${email.subject}\nDate : ${formatDate(email.date)}\n\n${email.text}`
    );
  } catch (error) {
    return err(describeMailError(error, fr));
  }
}

export async function sendEmailTool(
  account: MailboxConfig,
  args: {
    to: string;
    subject: string;
    text: string;
    cc?: string;
    bcc?: string;
  }
): Promise<ToolResult> {
  try {
    const messageId = await sendEmail(account, args);
    return ok(`Email envoyé à ${args.to} : "${args.subject}" [id: ${messageId}]`);
  } catch (error) {
    return err(describeMailError(error, fr));
  }
}

export async function markAsReadTool(
  account: MailboxConfig,
  args: {
    uid: number;
    folder?: string;
    seen?: boolean;
  }
): Promise<ToolResult> {
  try {
    const seen = args.seen ?? true;
    await setSeenFlag(account, args.uid, args.folder, seen);
    return ok(`Email [uid: ${args.uid}] marqué comme ${seen ? "lu" : "non lu"}.`);
  } catch (error) {
    return err(describeMailError(error, fr));
  }
}
