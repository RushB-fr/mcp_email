import "server-only";
import { ImapFlow, type FetchMessageObject, type ListTreeResponse } from "imapflow";
import { simpleParser } from "mailparser";
import type { MailboxConfig } from "@/lib/mail/mailbox";

async function getConnectedClient(account: MailboxConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: { user: account.email, pass: account.password },
    logger: false,
  });
  await client.connect();
  return client;
}

/** Connects with explicit credentials, without touching the stored account - used by the setup form to validate before saving. */
export async function testImapConnection(config: MailboxConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.email, pass: config.password },
    logger: false,
  });
  await client.connect();
  await client.logout();
}

export type EmailSummary = {
  uid: number;
  subject: string;
  from: string;
  date: string | null;
  seen: boolean;
};

function flattenFolders(node: ListTreeResponse, out: string[] = []): string[] {
  for (const child of node.folders ?? []) {
    if (child.path) out.push(child.path);
    flattenFolders(child, out);
  }
  return out;
}

export async function listFolders(account: MailboxConfig): Promise<string[]> {
  const client = await getConnectedClient(account);
  try {
    const tree = await client.listTree();
    return flattenFolders(tree);
  } finally {
    await client.logout();
  }
}

export async function searchEmails(
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
): Promise<EmailSummary[]> {
  const client = await getConnectedClient(account);
  try {
    const lock = await client.getMailboxLock(args.folder ?? "INBOX");
    try {
      const criteria: Record<string, unknown> = {};
      if (args.unreadOnly) criteria.seen = false;
      if (args.from) criteria.from = args.from;
      if (args.subject) criteria.subject = args.subject;
      if (args.bodyContains) criteria.body = args.bodyContains;
      if (args.sinceDays) {
        const since = new Date();
        since.setDate(since.getDate() - args.sinceDays);
        criteria.since = since;
      }

      const uids = await client.search(Object.keys(criteria).length ? criteria : { all: true }, {
        uid: true,
      });
      if (!uids || uids.length === 0) return [];

      const limit = args.limit ?? 20;
      const selected = uids.slice(-limit).reverse();

      const results: EmailSummary[] = [];
      for await (const message of client.fetch(
        selected,
        { envelope: true, flags: true, uid: true },
        { uid: true }
      )) {
        results.push(summarize(message));
      }
      return results;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

function summarize(message: FetchMessageObject): EmailSummary {
  return {
    uid: message.uid,
    subject: message.envelope?.subject ?? "(sans objet)",
    from: message.envelope?.from?.[0]?.address ?? "inconnu",
    date: message.envelope?.date ? message.envelope.date.toISOString() : null,
    seen: message.flags?.has("\\Seen") ?? false,
  };
}

export async function getEmail(account: MailboxConfig, uid: number, folder = "INBOX") {
  const client = await getConnectedClient(account);
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const message = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
      if (!message || !message.source) return null;

      const parsed = await simpleParser(message.source);
      return {
        uid,
        subject: parsed.subject ?? "(sans objet)",
        from: parsed.from?.text ?? "inconnu",
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(", ") : parsed.to.text) : "",
        date: parsed.date ? parsed.date.toISOString() : null,
        text: (parsed.text ?? "").slice(0, 5000),
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function setSeenFlag(account: MailboxConfig, uid: number, folder = "INBOX", seen = true) {
  const client = await getConnectedClient(account);
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      if (seen) {
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
