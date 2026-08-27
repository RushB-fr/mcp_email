import type { ReactNode } from "react";
import { requireUser } from "@/lib/actions/session";
import { getLocale, getDictionary } from "@/lib/i18n/locale";
import { LogoutButton } from "@/components/auth/logout-button";
import { SettingsNav } from "@/components/settings/settings-nav";

/**
 * Real routes (app/settings/{mailboxes,organizations,apps}/page.tsx)
 * instead of one long page or a client-side section switch - see
 * design-proposal-v2.html's sidebar. `requireUser()` lives here once, so
 * every settings route is protected without each page re-declaring it (the
 * redirect-to-/login behavior is unchanged from the previous single-page
 * /settings).
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const initials = user.email.slice(0, 2).toUpperCase();

  const navItems = [
    { href: "/settings/mailboxes", label: dict.settings.nav.mailboxes, icon: "mail" as const },
    { href: "/settings/organizations", label: dict.settings.nav.organizations, icon: "building" as const },
    { href: "/settings/apps", label: dict.settings.nav.apps, icon: "shield" as const },
  ];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface px-3.5 py-5 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-2 pb-5 text-[0.95rem] font-bold tracking-tight">
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary text-[13px] text-primary-foreground">
            M
          </span>
          Mail MCP
        </div>

        <SettingsNav items={navItems} />

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-ring/10 text-[0.7rem] font-bold text-ring">
              {initials}
            </span>
            <span className="truncate text-[0.78rem] text-muted-foreground">{user.email}</span>
          </div>
          <LogoutButton label={dict.auth.logout.label} iconOnly />
        </div>
      </aside>

      <nav className="border-b border-border px-4 py-2 md:hidden">
        <SettingsNav items={navItems} orientation="horizontal" />
      </nav>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
