import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/locale";

/** Built per-request from the resolved locale's dictionary so Zod's own error messages come out in the right language - see lib/i18n/locale.ts. */
export function buildMailAccountSchema(dict: Dictionary) {
  return z.object({
    email: z.string().trim().email(dict.validation.emailInvalid),
    password: z.string().min(1, dict.validation.passwordRequired),
    imapHost: z.string().trim().min(1, dict.validation.imapHostRequired),
    imapPort: z.coerce.number().int().min(1).max(65535).default(993),
    imapSecure: z.coerce.boolean().default(true),
    smtpHost: z.string().trim().min(1, dict.validation.smtpHostRequired),
    smtpPort: z.coerce.number().int().min(1).max(65535).default(465),
    smtpSecure: z.coerce.boolean().default(true),
  });
}

export type MailAccountInput = z.infer<ReturnType<typeof buildMailAccountSchema>>;
