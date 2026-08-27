import "server-only";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db/prisma";

export const OAUTH_ISSUER = "mail-mcp";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

function getJwtSecret(): string {
  const secret = process.env.OAUTH_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("OAUTH_JWT_SECRET or AUTH_SECRET must be set");
  return secret;
}

/**
 * Scoped to a userId, not a single mailbox: the resulting connector can act
 * on the full set of mailboxes that user has access to (own + shared via an
 * organization - see lib/mail/mailbox.ts's listAccessibleMailboxes), the
 * same way the `mailbox` selector in lib/mcp/tools.ts expects.
 */
export function issueAccessToken(clientId: string, userId: string): string {
  return jwt.sign({ client_id: clientId, user_id: userId }, getJwtSecret(), {
    algorithm: "HS256",
    subject: "mail-mcp",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: OAUTH_ISSUER,
  });
}

/**
 * Verifies the JWT signature/expiry only. The caller (route.ts) additionally
 * confirms an active refresh token grant still exists for this client and
 * user, so revoking a connection from Réglages takes effect immediately
 * instead of waiting up to 1h for the JWT to expire.
 */
export function verifyAccessToken(token: string): { clientId: string; userId: string } | null {
  try {
    // Pin the algorithm explicitly: without this, jwt.verify() accepts
    // whatever alg the token itself declares. Only one secret is ever used
    // here (no asymmetric key exposed anywhere in this app) so classic
    // alg-confusion isn't currently exploitable, but pinning is the
    // standard hardening and costs nothing.
    const decoded = jwt.verify(token, getJwtSecret(), { issuer: OAUTH_ISSUER, algorithms: ["HS256"] }) as {
      client_id?: string;
      user_id?: string;
    };
    if (!decoded.client_id || !decoded.user_id) return null;
    return { clientId: decoded.client_id, userId: decoded.user_id };
  } catch {
    return null;
  }
}

export async function issueRefreshToken(clientId: string, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.oAuthRefreshToken.create({
    data: {
      token,
      clientId,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      lastUsedAt: new Date(),
    },
  });
  return token;
}
