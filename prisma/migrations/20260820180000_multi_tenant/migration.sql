-- Multi-tenant: MailAccount is no longer a singleton. Every account gets
-- its own MCP token, and OAuth grants (auth codes / refresh tokens) are
-- scoped to the account that approved them instead of being global.

-- AlterTable: give every account its own MCP token
ALTER TABLE "mail_accounts" ADD COLUMN "mcpToken" TEXT;

-- Backfill: migrate the existing global static token onto the (at most one)
-- pre-existing account so its already-configured Claude connection keeps working.
UPDATE "mail_accounts" SET "mcpToken" = (SELECT "value" FROM "app_settings" WHERE "key" = 'mcp_api_token' LIMIT 1)
WHERE "mcpToken" IS NULL;

-- Any account somehow left without a token (no app_settings row) gets a
-- random fallback so the NOT NULL constraint below can be applied cleanly.
-- Built from core functions only (no pgcrypto dependency).
UPDATE "mail_accounts" SET "mcpToken" = md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
WHERE "mcpToken" IS NULL;

ALTER TABLE "mail_accounts" ALTER COLUMN "mcpToken" SET NOT NULL;
CREATE UNIQUE INDEX "mail_accounts_mcpToken_key" ON "mail_accounts"("mcpToken");

-- CreateTable: one-time invite links gating new account creation
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- AlterTable: scope OAuth grants to the account that approved them
ALTER TABLE "oauth_authorization_codes" ADD COLUMN "accountId" TEXT;
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "accountId" TEXT;

-- Backfill: with today's single-account install, any existing grant belongs
-- to that one account.
UPDATE "oauth_authorization_codes" SET "accountId" = (SELECT "id" FROM "mail_accounts" LIMIT 1)
WHERE "accountId" IS NULL;
UPDATE "oauth_refresh_tokens" SET "accountId" = (SELECT "id" FROM "mail_accounts" LIMIT 1)
WHERE "accountId" IS NULL;

-- Orphans (no account at all to backfill onto, i.e. a totally fresh install)
-- can't be assigned an owner: auth codes are short-lived (10 min) and
-- already expired by the time a migration runs, refresh tokens would be
-- unreachable without an account anyway. Safe to drop.
DELETE FROM "oauth_authorization_codes" WHERE "accountId" IS NULL;
DELETE FROM "oauth_refresh_tokens" WHERE "accountId" IS NULL;

ALTER TABLE "oauth_authorization_codes" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "oauth_refresh_tokens" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable: replaced by MailAccount.mcpToken (per-account, not global)
DROP TABLE "app_settings";
