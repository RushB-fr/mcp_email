-- Lets an OWNER grant (and revoke) mailbox/group access to a still-pending
-- OrganizationInvite, not just to an already-enrolled OrganizationMember -
-- see schema.prisma's doc comment on OrganizationMailboxGrant. When the
-- invite is later accepted, lib/actions/organization.ts's
-- acceptOrganizationInvite() migrates these grants over to the new
-- OrganizationMember.

-- organizationMemberId is no longer always required: a grant can now target
-- an OrganizationInvite instead.
ALTER TABLE "organization_mailbox_grants" ALTER COLUMN "organizationMemberId" DROP NOT NULL;

-- AddColumn
ALTER TABLE "organization_mailbox_grants" ADD COLUMN "organizationInviteId" TEXT;

-- AddForeignKey
ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_organizationInviteId_fkey" FOREIGN KEY ("organizationInviteId") REFERENCES "organization_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace the old single "exactly one resource" CHECK (still needed, just
-- renamed for clarity now that there are two "exactly one of" rules) and
-- add the new "exactly one target" rule.
ALTER TABLE "organization_mailbox_grants" DROP CONSTRAINT "organization_mailbox_grants_exactly_one_target";
ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_exactly_one_resource" CHECK (("mailboxId" IS NOT NULL) <> ("mailboxGroupId" IS NOT NULL));
ALTER TABLE "organization_mailbox_grants" ADD CONSTRAINT "organization_mailbox_grants_exactly_one_target" CHECK (("organizationMemberId" IS NOT NULL) <> ("organizationInviteId" IS NOT NULL));

-- CreateIndex: same dedupe rule as the existing member-scoped ones, mirrored
-- for the invite-scoped side (Postgres treats NULLs as distinct, so these
-- only ever dedupe rows that actually target an invite).
CREATE UNIQUE INDEX "organization_mailbox_grants_organizationInviteId_mailboxId_key" ON "organization_mailbox_grants"("organizationInviteId", "mailboxId");
CREATE UNIQUE INDEX "organization_mailbox_grants_organizationInviteId_mailboxGroupId_key" ON "organization_mailbox_grants"("organizationInviteId", "mailboxGroupId");
