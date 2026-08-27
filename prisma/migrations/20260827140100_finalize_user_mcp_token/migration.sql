-- Second half of the User.mcpToken migration - see
-- 20260827140000_add_user_mcp_token/migration.sql's header. By the time this
-- runs, scripts/migrate-mailbox-tokens-to-user.ts must already have backfilled
-- every user's "mcpToken" column (run manually between the two migrations,
-- same pattern as the original User/Mailbox/Organization rearchitecture).

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "mcpToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_mcpToken_key" ON "users"("mcpToken");

-- AlterTable: mailboxes no longer carry their own token - see schema.prisma.
ALTER TABLE "mailboxes" DROP COLUMN "mcpToken";
