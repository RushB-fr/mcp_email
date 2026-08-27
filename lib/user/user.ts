import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import type { User } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

export type { User };

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Exported so signup/setup flows can generate one inside their own transaction when needed. */
export function generateMcpToken(): string {
  return randomBytes(32).toString("base64url");
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

/** Static per-account bearer token lookup - see User.mcpToken's doc comment in schema.prisma. */
export async function getUserByMcpToken(mcpToken: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { mcpToken } });
}

export async function regenerateUserMcpToken(userId: string): Promise<string> {
  const mcpToken = generateMcpToken();
  await prisma.user.update({ where: { id: userId }, data: { mcpToken } });
  return mcpToken;
}

/**
 * Creates a brand new identity (credentials signup). No mailbox, no IMAP
 * test here - attaching a Mailbox is a separate, later step done from
 * Réglages once the user is authenticated (see lib/mail/mailbox.ts). The
 * account can't log in via credentials until emailVerified is set (see
 * lib/actions/signup.ts / verify-email.ts). mcpToken is generated
 * immediately: it's an identity-level credential now, not something that
 * only exists once a mailbox happens to get attached.
 */
export async function createUser(config: { email: string; passwordHash: string }): Promise<User> {
  return prisma.user.create({
    data: {
      email: config.email,
      passwordHash: config.passwordHash,
      mcpToken: generateMcpToken(),
    },
  });
}

export async function markEmailVerified(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/**
 * Sets the mailbox MCP tools default to when a call doesn't name one
 * explicitly. Doesn't check the mailbox is actually accessible to the user
 * - callers (server actions) are expected to have already resolved that via
 * lib/mail/mailbox.ts before calling this.
 */
export async function setDefaultMailbox(userId: string, mailboxId: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { defaultMailboxId: mailboxId } });
}
