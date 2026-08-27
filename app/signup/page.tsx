import { Mail } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
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
          <CardDescription>{dict.auth.signup.title}</CardDescription>
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

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  if (!token) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.auth.signup.missingInviteLink}</p>
      </Shell>
    );
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.auth.signup.invalidOrExpiredInvite}</p>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} dict={dict}>
      <SignupForm token={token} dict={{ common: dict.common, auth: dict.auth }} />
    </Shell>
  );
}
