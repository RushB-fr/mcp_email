-- Moves the MCP static bearer token from Mailbox to User (see schema.prisma's
-- doc comment on User.mcpToken): one token per account, not per mailbox.
-- Expand/contract, two migrations with a data backfill in between (see
-- scripts/migrate-mailbox-tokens-to-user.ts, run after this one and before
-- 20260827140100_finalize_user_mcp_token):
--   1. (this migration) add the new column, nullable
--   2. (script) backfill every existing user's token from their default (or
--      first) owned mailbox's token, generating a fresh one for users with
--      no mailbox at all
--   3. (next migration) make it NOT NULL + unique, drop mailboxes.mcpToken

-- AlterTable
ALTER TABLE "users" ADD COLUMN "mcpToken" TEXT;
