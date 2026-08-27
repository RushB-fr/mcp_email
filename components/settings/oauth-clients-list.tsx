"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Rows, Row, RowMain, RowActions } from "@/components/ui/list-row";
import { revokeOAuthConnection } from "@/lib/actions/oauth";
import type { Locale } from "@/lib/i18n/locale";

type ClientRow = {
  id: string;
  clientName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

type OAuthClientsDict = {
  empty: string;
  connectedOnPrefix: string;
  lastUsedOnPrefix: string;
  revokeButton: string;
  revokePending: string;
  confirmRevoke: string;
  unknownApp: string;
};

const DATE_FNS_LOCALES: Record<Locale, typeof fr> = { fr, en: enUS };

export function OAuthClientsList({
  clients,
  locale,
  dict,
}: {
  clients: ClientRow[];
  locale: Locale;
  dict: OAuthClientsDict;
}) {
  const [items, setItems] = useState(clients);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dateFnsLocale = DATE_FNS_LOCALES[locale];

  function handleRevoke(id: string) {
    const confirmed = window.confirm(dict.confirmRevoke);
    if (!confirmed) return;

    setPendingId(id);
    startTransition(async () => {
      await revokeOAuthConnection(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      setPendingId(null);
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground">
        <ShieldOff className="h-[18px] w-[18px] shrink-0" /> {dict.empty}
      </div>
    );
  }

  return (
    <Rows>
      {items.map((client) => (
        <Row key={client.id}>
          <RowMain>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{client.clientName ?? dict.unknownApp}</p>
              <p className="truncate text-[0.78rem] text-muted-foreground">
                {dict.connectedOnPrefix}
                {format(new Date(client.createdAt), "d MMMM yyyy", { locale: dateFnsLocale })}
                {client.lastUsedAt
                  ? `${dict.lastUsedOnPrefix}${format(new Date(client.lastUsedAt), "d MMMM yyyy", { locale: dateFnsLocale })}`
                  : ""}
              </p>
            </div>
          </RowMain>
          <RowActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRevoke(client.id)}
              disabled={pendingId === client.id}
            >
              {pendingId === client.id ? dict.revokePending : dict.revokeButton}
            </Button>
          </RowActions>
        </Row>
      ))}
    </Rows>
  );
}
