import "server-only";
import { cookies } from "next/headers";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { en } from "@/lib/i18n/dictionaries/en";

export type Locale = "fr" | "en";

/** Inferred from dictionaries/fr.ts (the reference dictionary) - see that file for why. */
export type Dictionary = typeof fr;

export const LOCALE_COOKIE = "locale";

const LOCALES: readonly Locale[] = ["fr", "en"];

function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolves the current request's UI locale from the `locale` cookie.
 * Defaults to "fr" when the cookie is absent or holds an unknown value -
 * every existing user has no such cookie yet, so this preserves today's
 * behavior for them unchanged.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "fr";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : fr;
}
