/**
 * One-off data migration for the User.mcpToken move (see
 * prisma/migrations/20260827140000_add_user_mcp_token and
 * .../20260827140100_finalize_user_mcp_token). Run AFTER the first of those
 * two migrations (adds the nullable column) and BEFORE the second (makes it
 * NOT NULL + unique, drops mailboxes.mcpToken) - same two-migrations-plus-
 * script pattern as scripts/migrate-legacy-mail-accounts.ts.
 *
 * For each User, picks the token that's most likely already configured in a
 * live MCP connector so nothing needs reconfiguring:
 *  - the token of their default mailbox, if they have one
 *  - otherwise their oldest owned mailbox's token
 *  - otherwise (no mailbox at all) a freshly generated one
 *
 * Idempotent-ish: only ever touches users whose "mcpToken" is still NULL, so
 * re-running after a partial failure is safe.
 */
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function generateMcpToken(): string {
  return randomBytes(32).toString("base64url");
}

async function main() {
  const users = await prisma.$queryRawUnsafe<{ id: string; defaultMailboxId: string | null }[]>(
    `SELECT "id", "defaultMailboxId" FROM "users" WHERE "mcpToken" IS NULL`
  );

  if (users.length === 0) {
    console.log("No users with a NULL mcpToken - nothing to do (fresh install, or already migrated).");
    return;
  }

  for (const user of users) {
    let token: string | null = null;

    if (user.defaultMailboxId) {
      const rows = await prisma.$queryRawUnsafe<{ mcpToken: string }[]>(
        `SELECT "mcpToken" FROM "mailboxes" WHERE "id" = $1 AND "userId" = $2`,
        user.defaultMailboxId,
        user.id
      );
      token = rows[0]?.mcpToken ?? null;
    }

    if (!token) {
      const rows = await prisma.$queryRawUnsafe<{ mcpToken: string }[]>(
        `SELECT "mcpToken" FROM "mailboxes" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
        user.id
      );
      token = rows[0]?.mcpToken ?? null;
    }

    if (!token) {
      token = generateMcpToken();
    }

    await prisma.$executeRawUnsafe(`UPDATE "users" SET "mcpToken" = $1 WHERE "id" = $2`, token, user.id);
    console.log(`User ${user.id} -> mcpToken backfilled (${token.slice(0, 8)}...)`);
  }

  console.log(`Done: ${users.length} user(s) backfilled. Proceed with the finalize migration.`);
}

main()
  .catch((error) => {
    console.error("mcpToken backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
