import { Mail } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/actions/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuthorizeConsent } from "@/components/oauth/authorize-consent";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale, getDictionary } from "@/lib/i18n/locale";
import type { Locale, Dictionary } from "@/lib/i18n/locale";

function Shell({ children, locale, dict }: { children: React.ReactNode; locale: Locale; dict: Dictionary }) {
  return (
    <div className="flex min-h-dvh items-center justify-center auth-backdrop px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Mail MCP</CardTitle>
          <CardDescription>{dict.oauth.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <div className="flex justify-center">
            <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  // Reaching this page at all means proxy.ts already confirmed a session;
  // the actual grant is created by approveAuthorization() on "Autoriser",
  // scoped to whichever account is currently logged in.
  const account = await requireUser();
  const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method } =
    await searchParams;

  if (response_type !== "code" || !client_id || !redirect_uri || !code_challenge) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.oauth.invalidRequest}</p>
      </Shell>
    );
  }

  // Only S256 is actually implemented at the token endpoint (see
  // app/api/oauth/token/route.ts) - reject "plain" (or anything else) up
  // front instead of silently accepting it here and failing later with a
  // confusing PKCE mismatch, which would also invite a future "fix" that
  // makes this endpoint actually honor a weaker declared method.
  if (code_challenge_method && code_challenge_method !== "S256") {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.oauth.unsupportedPkce(code_challenge_method)}</p>
      </Shell>
    );
  }

  const client = await prisma.oAuthClient.findUnique({ where: { id: client_id } });
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.oauth.unknownClientOrRedirect}</p>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} dict={dict}>
      <AuthorizeConsent
        clientName={client.clientName ?? dict.oauth.unknownApp}
        accountEmail={account.email}
        params={{
          clientId: client.id,
          redirectUri: redirect_uri,
          state,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method ?? "S256",
        }}
        dict={{ consent: dict.oauth.consent, deny: dict.oauth.deny, approve: dict.oauth.approve, approvePending: dict.oauth.approvePending }}
      />
    </Shell>
  );
}
