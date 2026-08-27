"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persists the UI language choice as a plain cookie (no DB column, no
 * migration - see lib/i18n/locale.ts). The client component calling this
 * still needs to follow up with router.refresh() itself: a server action
 * can mutate cookies, but doesn't by itself re-render the Server Components
 * already mounted in the browser.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
