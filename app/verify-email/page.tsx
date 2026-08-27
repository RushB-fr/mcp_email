import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/actions/signup";
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
          <CardDescription>{dict.auth.verifyEmail.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {children}
          <div className="flex justify-center">
            <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  if (!token || !email) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.auth.verifyEmail.invalidLink}</p>
      </Shell>
    );
  }

  const { error } = await verifyEmail(token, email);

  if (error) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{error}</p>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} dict={dict}>
      <p className="text-sm text-success">{dict.auth.verifyEmail.confirmed}</p>
      <Button asChild className="w-full">
        <Link href="/login">{dict.common.login}</Link>
      </Button>
    </Shell>
  );
}
