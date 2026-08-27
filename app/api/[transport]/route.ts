import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import * as tools from "@/lib/mcp/tools";
import type { ToolResult } from "@/lib/mcp/tools";
import { listAccessibleMailboxes, resolveAccessibleMailbox, type Mailbox } from "@/lib/mail/mailbox";
import { getUserByMcpToken } from "@/lib/user/user";
import { verifyAccessToken } from "@/lib/oauth/tokens";

export const runtime = "nodejs";

/**
 * What verifyToken() below stashes in AuthInfo.extra: always a `userId`,
 * regardless of how the bearer token authenticated. The static bearer token
 * (User.mcpToken) is a single per-account credential - see its doc comment
 * in schema.prisma. Both it and an OAuth access token resolve against the
 * exact same full set: this user's own mailboxes plus whatever it can reach
 * via an organization (see lib/mail/mailbox.ts's listAccessibleMailboxes).
 */
type AuthExtra = { userId: string };

function isAuthExtra(value: unknown): value is AuthExtra {
  return !!value && typeof value === "object" && "userId" in value;
}

const mailboxParam = z
  .string()
  .email()
  .optional()
  .describe(
    "Boîte mail sur laquelle agir, si ce connecteur en gère plusieurs (voir list_mailboxes). Par défaut : la boîte par défaut du connecteur."
  );

async function resolveMailboxForCall(
  extra: { authInfo?: AuthInfo },
  mailboxSelector: string | undefined
): Promise<{ mailbox: Mailbox } | { error: string }> {
  const info = extra.authInfo?.extra;
  if (!isAuthExtra(info)) {
    return { error: "Compte introuvable pour ce jeton." };
  }

  const resolved = await resolveAccessibleMailbox(info.userId, mailboxSelector);
  if (!resolved) {
    return mailboxSelector
      ? { error: `"${mailboxSelector}" n'est pas une boîte accessible depuis ce connecteur.` }
      : { error: "Aucune boîte mail accessible depuis ce compte. Attachez-en une depuis Réglages." };
  }
  return { mailbox: resolved.mailbox };
}

/**
 * Every tool call is scoped to exactly one mailbox, resolved from the
 * bearer token's auth info (see verifyToken below) plus the optional
 * `mailbox` selector - see resolveMailboxForCall().
 */
async function withAccount(
  extra: { authInfo?: AuthInfo },
  mailbox: string | undefined,
  fn: (mailbox: Mailbox) => Promise<ToolResult>
): Promise<ToolResult> {
  const result = await resolveMailboxForCall(extra, mailbox);
  if ("error" in result) {
    return { content: [{ type: "text", text: result.error }], isError: true };
  }
  return fn(result.mailbox);
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_mailboxes",
      {
        title: "Lister les boîtes mail accessibles",
        description:
          "Liste les boîtes mail accessibles depuis ce connecteur : ses boîtes propres, plus celles partagées via une organisation.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const info = extra.authInfo?.extra;
        if (!isAuthExtra(info)) {
          return { content: [{ type: "text", text: "Compte introuvable pour ce jeton." }], isError: true };
        }

        const [accessible, user] = await Promise.all([
          listAccessibleMailboxes(info.userId),
          prisma.user.findUnique({ where: { id: info.userId }, select: { defaultMailboxId: true } }),
        ]);
        return tools.listMailboxesTool(
          accessible.map((m) => ({ email: m.email, isDefault: m.id === user?.defaultMailboxId }))
        );
      }
    );

    server.registerTool(
      "list_folders",
      {
        title: "Lister les dossiers",
        description: "Liste les dossiers de la boite mail (INBOX, Sent, etc.).",
        inputSchema: { mailbox: mailboxParam },
      },
      async (args, extra) => withAccount(extra, args.mailbox, (mailbox) => tools.listFoldersTool(mailbox))
    );

    server.registerTool(
      "search_emails",
      {
        title: "Chercher des emails",
        description: "Cherche des emails par expediteur, sujet, contenu, ou non lus uniquement.",
        inputSchema: {
          mailbox: mailboxParam,
          folder: z.string().optional().describe("Dossier a chercher, INBOX par defaut"),
          from: z.string().optional().describe("Filtrer par expediteur"),
          subject: z.string().optional().describe("Filtrer par sujet"),
          bodyContains: z.string().optional().describe("Recherche dans le corps du message"),
          unreadOnly: z.boolean().optional().describe("Seulement les non lus"),
          sinceDays: z.number().int().min(1).max(365).optional().describe("Emails des N derniers jours"),
          limit: z.number().int().min(1).max(100).optional().describe("Nombre max de resultats, 20 par defaut"),
        },
      },
      async (args, extra) =>
        withAccount(extra, args.mailbox, (mailbox) => tools.searchEmailsTool(mailbox, args))
    );

    server.registerTool(
      "get_email",
      {
        title: "Lire un email",
        description: "Recupere le contenu complet d'un email par son uid (voir search_emails).",
        inputSchema: {
          mailbox: mailboxParam,
          uid: z.number().int().describe("uid de l'email, obtenu via search_emails"),
          folder: z.string().optional().describe("Dossier, INBOX par defaut"),
        },
      },
      async (args, extra) => withAccount(extra, args.mailbox, (mailbox) => tools.getEmailTool(mailbox, args))
    );

    server.registerTool(
      "send_email",
      {
        title: "Envoyer un email",
        description: "Envoie un email depuis la boite mail configuree.",
        inputSchema: {
          mailbox: mailboxParam,
          to: z.string().email(),
          subject: z.string().min(1),
          text: z.string().min(1),
          cc: z.string().optional(),
          bcc: z.string().optional(),
        },
      },
      async (args, extra) => withAccount(extra, args.mailbox, (mailbox) => tools.sendEmailTool(mailbox, args))
    );

    server.registerTool(
      "mark_as_read",
      {
        title: "Marquer comme lu/non lu",
        description: "Marque un email comme lu ou non lu.",
        inputSchema: {
          mailbox: mailboxParam,
          uid: z.number().int(),
          folder: z.string().optional(),
          seen: z.boolean().optional().describe("true = marquer lu (defaut), false = marquer non lu"),
        },
      },
      async (args, extra) =>
        withAccount(extra, args.mailbox, (mailbox) => tools.markAsReadTool(mailbox, args))
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
  }
);

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  // OAuth access token: beyond the JWT signature/expiry, confirm the grant
  // is still active for this (client, user) pair so revoking a connection
  // (Réglages) takes effect immediately instead of waiting up to 1h for the
  // JWT to expire.
  const oauthResult = verifyAccessToken(bearerToken);
  if (oauthResult) {
    const activeGrant = await prisma.oAuthRefreshToken.findFirst({
      where: {
        clientId: oauthResult.clientId,
        userId: oauthResult.userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!activeGrant) return undefined;
    const extra: AuthExtra = { userId: oauthResult.userId };
    return { token: bearerToken, scopes: [], clientId: oauthResult.clientId, extra };
  }

  // Static bearer token, managed from Réglages > Applications - one per
  // account (see AuthExtra's doc comment above), resolves the user's full
  // accessible set exactly like an OAuth connector does.
  const user = await getUserByMcpToken(bearerToken);
  if (!user) return undefined;
  const extra: AuthExtra = { userId: user.id };
  return { token: bearerToken, scopes: [], clientId: "mail-mcp", extra };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
