-- Organization membership becomes many-to-many: an account can be a member
-- of several owners' organizations at once, and independently own its own
-- members (mutual/chained ownership is fine - resolution only ever looks
-- one level deep, see lib/mail/account.ts).

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_memberships_ownerId_memberId_key" ON "organization_memberships"("ownerId", "memberId");

ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: migrate any existing single-owner membership (previous schema)
-- into the new join table before dropping the column.
INSERT INTO "organization_memberships" ("id", "ownerId", "memberId")
SELECT md5(random()::text || clock_timestamp()::text) || md5(random()::text), "ownerAccountId", "id"
FROM "mail_accounts"
WHERE "ownerAccountId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "mail_accounts" DROP CONSTRAINT IF EXISTS "mail_accounts_ownerAccountId_fkey";

-- AlterTable
ALTER TABLE "mail_accounts" DROP COLUMN "ownerAccountId";
