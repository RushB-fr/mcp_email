/**
 * One-off data migration for the User/Mailbox/Organization rearchitecture
 * (see prisma/migrations/20260826170000_user_mailbox_org_rearchitecture).
 * Only relevant to a database that still has data in the old `mail_accounts`
 * / `organization_memberships` tables (this app's pre-rearchitecture
 * model) - a fresh install has neither and this script is a no-op for it.
 *
 * Must run AFTER that migration's "Phase 1" (new tables created) and
 * BEFORE its "Phase 3" (old tables dropped) - see the migration.sql header.
 * Needs MCP_MASTER_KEY set (to decrypt existing mailbox passwords) exactly
 * like the running app does.
 *
 * What it does, per existing `mail_accounts` row:
 *  - Creates a User, REUSING the mail_account's id as the new User.id. This
 *    is deliberate: oauth_authorization_codes/oauth_refresh_tokens.accountId
 *    already store that same id, and are being rescoped to `userId` by the
 *    same migration - reusing the id means every live OAuth connection
 *    (Claude connectors) keeps working with zero extra bookkeeping.
 *  - Sets the new User's passwordHash by decrypting the mail_account's
 *    stored password (which, in the old model, doubled as both the IMAP
 *    password and the Réglages login password) and bcrypt-hashing it - so
 *    existing users can keep logging in with the same password. Also marks
 *    emailVerified now (grandfathered in; there is no verification history
 *    for pre-existing accounts and they're already trusted).
 *  - Creates a Mailbox owned by that User with a FRESH id (Mailbox is a new
 *    concept, not a reuse) but the SAME mcpToken - so any already-configured
 *    static MCP connector URL keeps working unchanged too.
 * Per existing `organization_memberships` row (ownerId, memberId):
 *  - Creates an Organization owned by ownerId (OWNER), and shares memberId's
 *    new Mailbox into it - replicating the old "owner's connector can also
 *    act on member's mailbox" behavior via the new OWNER-gets-full-access
 *    rule, without needing memberId to become an OrganizationMember itself
 *    (it wasn't one in the old model either - it just kept a separately
 *    manageable mailbox).
 *
 * Idempotent-ish: re-running after mail_accounts/organization_memberships
 * have already been migrated (or dropped) is a safe no-op - it checks the
 * source tables exist and have rows first.
 */
import { randomUUID, createDecipheriv, scryptSync } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inlined rather than imported from lib/mail/crypto.ts / lib/user/user.ts:
// those files import the "server-only" package, which Next.js's bundler
// resolves specially but which isn't installed as a real dependency (it's
// not needed outside the Next.js build) - plain tsx/node can't resolve it.
// Logic kept identical to lib/mail/crypto.ts's decryptSecret and
// lib/user/user.ts's hashPassword.
function decryptSecret(encoded: string): string {
  const secret = process.env.MCP_MASTER_KEY;
  if (!secret) throw new Error("MCP_MASTER_KEY must be set");
  const key = scryptSync(secret, "mail-mcp-account-encryption", 32);
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plain.toString("utf8");
}

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

type LegacyMailAccount = {
  id: string;
  email: string;
  encryptedPassword: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  mcpToken: string;
  createdAt: Date;
  updatedAt: Date;
};

type LegacyMembership = { id: string; ownerId: string; memberId: string; createdAt: Date };

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    name
  );
  return rows[0]?.exists ?? false;
}

async function main() {
  if (!(await tableExists("mail_accounts"))) {
    console.log("No mail_accounts table found - nothing to migrate (fresh install?). Skipping.");
    return;
  }

  const accounts = await prisma.$queryRawUnsafe<LegacyMailAccount[]>(`SELECT * FROM "mail_accounts"`);
  if (accounts.length === 0) {
    console.log("mail_accounts is empty - nothing to migrate.");
  }

  const mailboxIdByAccountId = new Map<string, string>();

  for (const account of accounts) {
    const plainPassword = decryptSecret(account.encryptedPassword);
    const passwordHash = await hashPassword(plainPassword);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "users" ("id", "email", "passwordHash", "emailVerified", "createdAt")
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT ("id") DO NOTHING`,
      account.id,
      account.email,
      passwordHash,
      account.createdAt
    );

    const mailboxId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "mailboxes"
         ("id", "userId", "email", "encryptedPassword", "imapHost", "imapPort", "imapSecure", "smtpHost", "smtpPort", "smtpSecure", "mcpToken", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT ("id") DO NOTHING`,
      mailboxId,
      account.id,
      account.email,
      account.encryptedPassword,
      account.imapHost,
      account.imapPort,
      account.imapSecure,
      account.smtpHost,
      account.smtpPort,
      account.smtpSecure,
      account.mcpToken,
      account.createdAt,
      account.updatedAt
    );
    mailboxIdByAccountId.set(account.id, mailboxId);

    // First (and, per account, only) mailbox: make it the default.
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET "defaultMailboxId" = $1 WHERE "id" = $2 AND "defaultMailboxId" IS NULL`,
      mailboxId,
      account.id
    );

    console.log(`Migrated mail_account ${account.email} -> user ${account.id} + mailbox ${mailboxId}`);
  }

  if (await tableExists("organization_memberships")) {
    const memberships = await prisma.$queryRawUnsafe<LegacyMembership[]>(
      `SELECT * FROM "organization_memberships"`
    );

    for (const membership of memberships) {
      const ownerEmailRows = await prisma.$queryRawUnsafe<{ email: string }[]>(
        `SELECT "email" FROM "users" WHERE "id" = $1`,
        membership.ownerId
      );
      const ownerEmail = ownerEmailRows[0]?.email ?? membership.ownerId;
      const memberMailboxId = mailboxIdByAccountId.get(membership.memberId);
      if (!memberMailboxId) {
        console.warn(`Skipping membership ${membership.id}: member mailbox not found (already migrated?).`);
        continue;
      }

      const organizationId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "organizations" ("id", "name", "createdByUserId", "createdAt") VALUES ($1, $2, $3, $4)`,
        organizationId,
        `Organisation de ${ownerEmail}`,
        membership.ownerId,
        membership.createdAt
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO "organization_members" ("id", "organizationId", "userId", "role", "createdAt") VALUES ($1, $2, $3, 'OWNER', $4)`,
        randomUUID(),
        organizationId,
        membership.ownerId,
        membership.createdAt
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO "organization_mailboxes" ("id", "organizationId", "mailboxId", "createdAt") VALUES ($1, $2, $3, $4)`,
        randomUUID(),
        organizationId,
        memberMailboxId,
        membership.createdAt
      );

      console.log(`Migrated membership ${membership.ownerId} -> ${membership.memberId} as organization ${organizationId}`);
    }
  }

  console.log("Done. Proceed with Phase 3 of the migration (rename oauth accountId->userId, drop old tables).");
}

main()
  .catch((error) => {
    console.error("Legacy data migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
