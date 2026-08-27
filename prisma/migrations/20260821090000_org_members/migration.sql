-- Any account can attach member mailboxes under it (Réglages > Organisation).
-- Purely additive and nullable: every existing account stays a standalone
-- account (NULL = no owner) with no behavior change.
ALTER TABLE "mail_accounts" ADD COLUMN "ownerAccountId" TEXT;

ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
