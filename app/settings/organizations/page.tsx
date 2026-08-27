import { getMyMailboxes } from "@/lib/actions/mailbox";
import { listMyOrganizations, getOrganizationDetail } from "@/lib/actions/organization";
import { OrganizationCard } from "@/components/settings/organization-card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

export default async function OrganizationsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [mailboxes, orgSummaries] = await Promise.all([getMyMailboxes(), listMyOrganizations()]);
  const organizations = await Promise.all(orgSummaries.map((o) => getOrganizationDetail(o.id)));

  return (
    <div className="mx-auto max-w-[780px] px-6 py-9 md:px-11">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.settings.organizations.title}</h1>
          <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            {dict.settings.organizations.description}
          </p>
        </div>
        <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
      </div>

      <OrganizationCard
        ownMailboxes={mailboxes.map((m) => ({ id: m.id, email: m.email }))}
        organizations={organizations}
        dict={{ common: dict.common, organizations: dict.settings.organizations }}
      />
    </div>
  );
}
