"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth/auth";
import { getUserByEmail } from "@/lib/user/user";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

function resolveRedirectTo(rawCallback: FormDataEntryValue | null): string {
  return typeof rawCallback === "string" && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
    ? rawCallback
    : "/settings";
}

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = resolveRedirectTo(formData.get("callbackUrl"));
  const dict = getDictionary(await getLocale());

  if (typeof email === "string") {
    const existing = await getUserByEmail(email);
    if (existing && !existing.passwordHash) {
      return { error: dict.auth.login.errors.oauthOnly };
    }
    if (existing && !existing.emailVerified) {
      return { error: dict.auth.login.errors.unverifiedEmail };
    }
  }

  try {
    await signIn("credentials", { email, password, redirectTo });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: dict.auth.login.errors.invalidCredentials };
    }
    throw error;
  }
}

/** Google/GitHub buttons on the login page - both providers are optional, see lib/auth/auth.ts. */
export async function oauthSignInAction(provider: "google" | "github", callbackUrl?: string) {
  await signIn(provider, { redirectTo: resolveRedirectTo(callbackUrl ?? null) });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
