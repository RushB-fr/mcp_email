import {
  getMyMailboxes,
  getMyAccessibleMailboxes,
  getMyOrganizationsForSharing,
} from "@/lib/actions/mailbox";
import { MailboxesCard } from "@/components/settings/mailboxes-card";
import { DefaultMailboxPicker } from "@/components/settings/default-mailbox-picker";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

export default async function MailboxesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [mailboxes, accessibleMailboxes, orgsForSharing] = await Promise.all([
    getMyMailboxes(),
    getMyAccessibleMailboxes(),
    getMyOrganizationsForSharing(),
  ]);

  return (
    <div className="mx-auto max-w-[780px] px-6 py-9 md:px-11">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.settings.mailboxes.title}</h1>
          <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            {dict.settings.mailboxes.description}
          </p>
        </div>
        <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
      </div>

      {accessibleMailboxes.length > 1 && (
        <div className="mb-8">
          <DefaultMailboxPicker mailboxes={accessibleMailboxes} dict={dict.settings.mailboxes.defaultPicker} />
        </div>
      )}

      <section className="mb-10">
        <MailboxesCard
          mailboxes={mailboxes}
          organizations={orgsForSharing}
          defaultHosts={{
            imapHost: process.env.DEFAULT_IMAP_HOST,
            smtpHost: process.env.DEFAULT_SMTP_HOST,
          }}
          dict={{
            common: dict.common,
            mailboxes: dict.settings.mailboxes,
            auth: { setup: dict.auth.setup },
          }}
        />
      </section>
    </div>
  );
}
