import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/locale";

/**
 * Built per-request from the resolved locale's dictionary so Zod's own
 * error messages come out in the right language - see lib/i18n/locale.ts.
 *
 * Identity signup: just email + password, no IMAP/SMTP fields - see
 * lib/validations/mail-account.ts for the (separate) mailbox-attachment
 * form.
 */
export function buildSignupSchema(dict: Dictionary) {
  return z.object({
    email: z.string().trim().email(dict.validation.emailInvalid),
    password: z.string().min(8, dict.validation.passwordMinLength),
    token: z.string().min(1, dict.validation.inviteMissing),
  });
}

export type SignupInput = z.infer<ReturnType<typeof buildSignupSchema>>;

export function buildOrganizationNameSchema(dict: Dictionary) {
  return z.object({
    name: z.string().trim().min(1, dict.validation.nameRequired).max(100),
  });
}

export function buildOrganizationInviteSchema(dict: Dictionary) {
  return z.object({
    organizationId: z.string().min(1),
    email: z.string().trim().email(dict.validation.emailInvalid),
  });
}

export function buildMailboxGroupNameSchema(dict: Dictionary) {
  return z.object({
    organizationId: z.string().min(1),
    name: z.string().trim().min(1, dict.validation.nameRequired).max(100),
  });
}

/** Same name validation rule as buildMailboxGroupNameSchema, for renaming an existing group (no organizationId needed - the group already has one). */
export function buildMailboxGroupRenameSchema(dict: Dictionary) {
  return z.object({
    mailboxGroupId: z.string().min(1),
    name: z.string().trim().min(1, dict.validation.nameRequired).max(100),
  });
}
