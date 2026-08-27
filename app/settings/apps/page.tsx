import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/actions/session";
import { getAppBaseUrl } from "@/lib/http";
import { OAuthClientsList } from "@/components/settings/oauth-clients-list";
import { McpTokenCard } from "@/components/settings/mcp-token-card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

export default async function AppsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const mcpUrl = `${await getAppBaseUrl()}/api/mcp`;

  const activeGrants = await prisma.oAuthRefreshToken.findMany({
    where: { userId: user.id, revoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    include: { client: true },
  });
  const seenClientIds = new Set<string>();
  const oauthConnections = activeGrants.filter((grant) => {
    if (seenClientIds.has(grant.clientId)) return false;
    seenClientIds.add(grant.clientId);
    return true;
  });

  return (
    <div className="mx-auto max-w-[780px] px-6 py-9 md:px-11">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.settings.oauthClients.title}</h1>
          <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            {dict.settings.oauthClients.description}
          </p>
        </div>
        <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
      </div>

      <section className="mb-10">
        <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {dict.settings.mcpToken.title}
        </p>
        <div className="rounded-lg border border-border p-4">
          <McpTokenCard initialToken={user.mcpToken} mcpUrl={mcpUrl} dict={dict.settings.mcpToken} />
          <p className="mt-3 text-[0.76rem] leading-relaxed text-muted-foreground">
            {dict.settings.mcpToken.intro}
          </p>
        </div>
      </section>

      <section>
        <OAuthClientsList
          clients={oauthConnections.map((grant) => ({
            id: grant.clientId,
            clientName: grant.client.clientName,
            createdAt: grant.createdAt.toISOString(),
            lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
          }))}
          locale={locale}
          dict={{ ...dict.settings.oauthClients, unknownApp: dict.oauth.unknownApp }}
        />
      </section>
    </div>
  );
}
