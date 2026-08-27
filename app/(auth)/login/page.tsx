import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-dvh items-center justify-center auth-backdrop px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Mail MCP</CardTitle>
          <CardDescription>{dict.auth.login.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm
            callbackUrl={callbackUrl}
            googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
            githubEnabled={Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
            dict={{ common: dict.common, auth: dict.auth }}
          />
          <div className="flex justify-center">
            <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
