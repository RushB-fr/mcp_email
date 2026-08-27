import "server-only";
import type { Dictionary } from "@/lib/i18n/locale";

/**
 * IMAP/SMTP credentials aren't self-refreshing like a session token: if the
 * password gets changed on the mail provider's side, the stored one just
 * goes stale with no automatic signal. Since generic connection errors ("Command
 * failed") don't tell you *why*, this distinguishes "wrong credentials -
 * go reconnect in Réglages" from any other failure (network, wrong host...).
 */
export function describeMailError(error: unknown, dict: Dictionary): string {
  const err = error as {
    authenticationFailed?: boolean;
    responseCode?: number;
    responseText?: string;
    code?: string;
    message?: string;
  };

  const looksLikeAuthFailure =
    err?.authenticationFailed === true ||
    err?.responseCode === 535 ||
    err?.code === "EAUTH" ||
    /auth|credentials|invalid login|password/i.test(err?.responseText ?? err?.message ?? "");

  if (looksLikeAuthFailure) {
    return dict.mail.authFailed;
  }

  return err?.message ?? dict.mail.connectionError;
}
