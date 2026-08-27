import Link from "next/link";
import { Mail } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { getUserByEmail } from "@/lib/user/user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptOrgInviteButton } from "@/components/organization/accept-invite-button";
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
          <CardDescription>{dict.orgInvite.title}</CardDescription>
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

export default async function AcceptOrgInvitePage({
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
        <p className="text-sm text-destructive">{dict.orgInvite.missingLink}</p>
      </Shell>
    );
  }

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.orgInvite.invalidOrExpired}</p>
      </Shell>
    );
  }

  const session = await auth();

  // Logged in, but under a different email than the one invited - checked
  // first regardless of whether that email has a platform account, since
  // it's the most specific/actionable explanation for a mismatch.
  if (session?.user && session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-destructive">{dict.orgInvite.mismatch(invite.email, session.user.email)}</p>
      </Shell>
    );
  }

  // The invited email has no platform account yet: org membership never
  // creates a User (see OrganizationInvite's doc comment in
  // schema.prisma) - the platform's own invite-gated signup is a fully
  // separate flow. Documented limitation: there is currently no combined
  // "org invite doubles as a platform invite" flow. Checked before the
  // "not logged in -> log in" branch below: sending someone toward /login
  // when there is nothing for them to log into yet is a dead end.
  const existingUser = await getUserByEmail(invite.email);
  if (!existingUser) {
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-muted-foreground">
          {dict.orgInvite.noAccountYet(invite.email, invite.organization.name)}
        </p>
      </Shell>
    );
  }

  // A platform account exists for this email, but this browser isn't logged
  // in as it yet: send through /login, then back here.
  if (!session?.user) {
    const callbackUrl = `/org-invite/accept?token=${token}`;
    return (
      <Shell locale={locale} dict={dict}>
        <p className="text-sm text-muted-foreground">
          {dict.orgInvite.loginPrompt.prefix} <span className="font-medium text-foreground">{invite.email}</span>{" "}
          {dict.orgInvite.loginPrompt.suffix(invite.organization.name)}
        </p>
        <Button asChild className="w-full">
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>{dict.common.login}</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} dict={dict}>
      <p className="text-sm text-muted-foreground">
        {dict.orgInvite.joinPrompt.prefix}{" "}
        <span className="font-medium text-foreground">{invite.organization.name}</span> {dict.orgInvite.joinPrompt.suffix}
      </p>
      <AcceptOrgInviteButton
        token={token}
        dict={{ acceptButton: dict.orgInvite.acceptButton, acceptPending: dict.orgInvite.acceptPending }}
      />
    </Shell>
  );
}
