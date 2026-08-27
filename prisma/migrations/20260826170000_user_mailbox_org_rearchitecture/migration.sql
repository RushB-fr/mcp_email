-- Full rearchitecture: identity (User) is decoupled from mailbox connections
-- (Mailbox), and a granular Organization/sharing model replaces the old
-- flat MailAccount + OrganizationMembership pair. Pure DDL only, safe to run
-- on a fresh install (no pre-existing data). If this database already has
-- `mail_accounts` rows from before this migration (this app's pre-
-- rearchitecture data model), run scripts/migrate-legacy-mail-accounts.ts
-- FIRST (after the "Phase 1" CREATE statements below, before "Phase 3")
-- to carry that data over into User/Mailbox/Organization rather than
-- silently dropping it - see that script's header comment for the exact
-- procedure. A fresh install has no such data and doesn't need it.

-- ============================================================
-- Phase 1: brand new tables (purely additive, nothing dropped yet)
-- ============================================================

CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "defaultMailboxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable (Auth.js/@auth/prisma-adapter standard model)
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable (Auth.js/@auth/prisma-adapter standard model)
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable (Auth.js/@auth/prisma-adapter standard model)
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 465,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "mcpToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mailboxes_mcpToken_key" ON "mailboxes"("mcpToken");
CREATE UNIQUE INDEX "mailboxes_userId_email_key" ON "mailboxes"("userId", "email");

ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: User.defaultMailboxId, now that "mailboxes" exists
ALTER TABLE "users" ADD CONSTRAINT "users_defaultMailboxId_fkey" FOREIGN KEY ("defaultMailboxId") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "organization_mailboxes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_mailboxes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_mailboxes_organizationId_mailboxId_key" ON "organization_mailboxes"("organizationId", "mailboxId");

ALTER TABLE "organization_mailboxes" ADD CONSTRAINT "organization_mailboxes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_mailboxes" ADD CONSTRAINT "organization_mailboxes_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "mailbox_groups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mailbox_groups" ADD CONSTRAINT "mailbox_groups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "mailbox_group_mailboxes" (
    "id" TEXT NOT NULL,
    "mailboxGroupId" TEXT NOT NULL,
    "organizationMailboxId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_group_mailboxes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mailbox_group_mailboxes_mailboxGroupId_organizationMailboxI_key" ON "mailbox_group_mailboxes"("mailboxGroupId", "organizationMailboxId");

ALTER TABLE "mailbox_group_mailboxes" ADD CONSTRAINT "mailbox_group_mailboxes_mailboxGroupId_fkey" FOREIGN KEY ("mailboxGroupId") REFERENCES "mailbox_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mailbox_group_mailboxes" ADD CONSTRAINT "mailbox_group_mailboxes_organizationMailboxId_fkey" FOREIGN KEY ("organizationMailboxId") REFERENCES "organization_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "organization_mailbox_grants" (
    "id" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "mailboxGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_mailbox_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_mailbox_grants_organizationMemberId_mailboxId_key" ON "organization_mailbox_grants"("organizationMemberId", "mailboxId");
CREATE UNIQUE INDEX "organization_mailbox_grants_organizationMemberId_mailboxGro_key" ON "organization_mailbox_grants"("organizationMemberId", "mailboxGroupId");

ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_mailboxGroupId_fkey" FOREIGN KEY ("mailboxGroupId") REFERENCES "mailbox_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one of mailboxId / mailboxGroupId must be set - see schema.prisma's doc comment on this model.
ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_exactly_one_target" CHECK (("mailboxId" IS NOT NULL) <> ("mailboxGroupId" IS NOT NULL));

-- CreateTable
CREATE TABLE "organization_invites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invites_token_key" ON "organization_invites"("token");

ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Phase 2 (manual, existing data only): if this database has pre-existing
-- `mail_accounts` / `organization_memberships` rows, run
-- scripts/migrate-legacy-mail-accounts.ts now, before Phase 3 below drops
-- them. A fresh install has none and can proceed straight to Phase 3.
-- ============================================================

-- ============================================================
-- Phase 3: rescope OAuth grants from accountId (a mailbox login) to userId
-- (an identity), and drop the tables this migration replaces.
-- ============================================================

ALTER TABLE "oauth_authorization_codes" DROP CONSTRAINT IF EXISTS "oauth_authorization_codes_accountId_fkey";
ALTER TABLE "oauth_authorization_codes" RENAME COLUMN "accountId" TO "userId";
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_refresh_tokens" DROP CONSTRAINT IF EXISTS "oauth_refresh_tokens_accountId_fkey";
ALTER TABLE "oauth_refresh_tokens" RENAME COLUMN "accountId" TO "userId";
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable: replaced by organizations/organization_members/organization_mailboxes
DROP TABLE "organization_memberships";

-- DropTable: replaced by User (identity) + Mailbox (connection)
DROP TABLE "mail_accounts";
