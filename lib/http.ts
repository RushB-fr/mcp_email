import "server-only";
import { headers } from "next/headers";

/**
 * Resolves the public base URL (scheme + host, no trailing slash) this
 * instance is reachable at. Prefers an explicit APP_BASE_URL (most
 * reliable, recommended behind a reverse proxy), then the standard
 * X-Forwarded-* headers a proxy like Traefik sets, then the plain Host
 * header as a last resort before defaulting to localhost.
 */
export async function getAppBaseUrl(): Promise<string> {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }

  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host");
  const forwardedProto = headersList.get("x-forwarded-proto");
  const host = forwardedHost ?? headersList.get("host") ?? "localhost:3000";
  const protocol = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

/**
 * Like getAppBaseUrl(), but for a URL embedded in content sent to a THIRD
 * PARTY (a transactional email: signup verification, org invite) rather
 * than shown back to whoever is currently making the request. The fallback
 * in getAppBaseUrl() trusts X-Forwarded-Host/Host, which are
 * client-controllable in general - harmless for a URL a user only ever
 * sees rendered in their own browser, but a real host-header-injection risk
 * for a link mailed to someone else (an attacker submitting the signup or
 * "invite a member" form with a spoofed Host could get the app's own
 * legitimate sender to mail a victim a link pointing at an attacker-chosen
 * domain instead). Requires APP_BASE_URL explicitly - fails loudly instead
 * of silently falling back to a spoofable header for this specific purpose.
 */
export class AppBaseUrlNotConfiguredError extends Error {
  constructor() {
    super("APP_BASE_URL doit être configuré pour envoyer des liens par email (vérification, invitations) - voir .env.example.");
    this.name = "AppBaseUrlNotConfiguredError";
  }
}

export async function getTrustedAppBaseUrl(): Promise<string> {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    throw new AppBaseUrlNotConfiguredError();
  }
  return base.replace(/\/$/, "");
}
