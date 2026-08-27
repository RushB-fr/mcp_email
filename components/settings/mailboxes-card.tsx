"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, Star, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rows, Row, RowMain, RowActions } from "@/components/ui/list-row";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MailConnectionTest } from "@/components/settings/mail-connection-test";
import { SetupForm } from "@/components/auth/setup-form";
import { setDefaultMailbox, deleteMyMailbox } from "@/lib/actions/mailbox";
import { shareMailboxToOrganization } from "@/lib/actions/organization";
import type { Dictionary } from "@/lib/i18n/locale";

type Mailbox = {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  isDefault: boolean;
};

type MailboxesCardDict = {
  common: Dictionary["common"];
  mailboxes: Dictionary["settings"]["mailboxes"];
  auth: { setup: Dictionary["auth"]["setup"] };
};

/**
 * Row-per-mailbox list from design-proposal-v2.html (`.rows`/`.row`),
 * replacing one `CollapsibleSection` per mailbox. "Modifier" now toggles an
 * expanded detail panel below the row instead of the whole row being one
 * giant clickable summary - the mockup's "Modifier" and delete icon sit
 * side by side in the row itself, which a single all-encompassing toggle
 * button (nesting a delete <button> inside it) can't express in valid HTML.
 * All the mutations below (setDefaultMailbox/deleteMyMailbox/share) are the
 * same server actions as before - only the surrounding markup changed.
 */
export function MailboxesCard({
  mailboxes,
  organizations,
  defaultHosts,
  dict,
}: {
  mailboxes: Mailbox[];
  organizations: { id: string; name: string }[];
  defaultHosts?: { imapHost?: string; smtpHost?: string };
  dict: MailboxesCardDict;
}) {
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleSetDefault(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await setDefaultMailbox(id);
      setPendingId(null);
    });
  }

  async function handleDelete(id: string, email: string) {
    const confirmed = window.confirm(
      `${dict.mailboxes.confirmDeletePrefix}${email}${dict.mailboxes.confirmDeleteSuffix}`
    );
    if (!confirmed) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteMyMailbox(id);
      setPendingId(null);
      setExpandedId((current) => (current === id ? null : current));
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{dict.mailboxes.intro}</p>

      {mailboxes.length > 0 && (
        <Rows>
          {mailboxes.map((mailbox) => {
            const isExpanded = expandedId === mailbox.id;
            const isRowPending = pending && pendingId === mailbox.id;
            return (
              <div key={mailbox.id}>
                <Row>
                  <RowMain>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{mailbox.email}</div>
                      <div className="truncate font-mono text-[0.78rem] text-muted-foreground">
                        {mailbox.imapHost} · {mailbox.imapPort}
                      </div>
                    </div>
                    {mailbox.isDefault && <Badge variant="success">{dict.mailboxes.defaultBadge}</Badge>}
                  </RowMain>
                  <RowActions>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : mailbox.id)}
                      aria-expanded={isExpanded}
                    >
                      {dict.common.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive-ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(mailbox.id, mailbox.email)}
                      disabled={isRowPending}
                      title={dict.mailboxes.deleteButton}
                      aria-label={dict.mailboxes.deleteButton}
                    >
                      <Trash2 className="h-[15px] w-[15px]" />
                    </Button>
                  </RowActions>
                </Row>

                {isExpanded && (
                  <div className="mb-3 space-y-4 rounded-lg border border-border p-4">
                    <MailConnectionTest
                      mailboxId={mailbox.id}
                      dict={{
                        testButton: dict.mailboxes.testButton,
                        testPending: dict.mailboxes.testPending,
                        testSuccessPrefix: dict.mailboxes.testSuccessPrefix,
                      }}
                    />

                    <SetupForm
                      mailboxId={mailbox.id}
                      defaultValues={{
                        email: mailbox.email,
                        imapHost: mailbox.imapHost,
                        imapPort: mailbox.imapPort,
                        imapSecure: mailbox.imapSecure,
                        smtpHost: mailbox.smtpHost,
                        smtpPort: mailbox.smtpPort,
                        smtpSecure: mailbox.smtpSecure,
                      }}
                      dict={{ common: dict.common, auth: dict.auth }}
                    />

                    {organizations.length > 0 && (
                      <SharePicker
                        mailboxId={mailbox.id}
                        organizations={organizations}
                        dict={{ share: dict.common.share, ...dict.mailboxes.share }}
                      />
                    )}

                    {!mailbox.isDefault && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(mailbox.id)}
                        disabled={isRowPending}
                      >
                        <Star className="h-4 w-4" /> {dict.mailboxes.setDefaultButton}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Rows>
      )}

      {mailboxes.length === 0 && !adding && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground">
          <Inbox className="h-4 w-4 shrink-0" /> {dict.mailboxes.noMailboxes}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <SetupForm
            onSuccess={() => setAdding(false)}
            defaultHosts={defaultHosts}
            dict={{ common: dict.common, auth: dict.auth }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
            {dict.common.cancel}
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {dict.mailboxes.addButton}
        </Button>
      )}
    </div>
  );
}

function SharePicker({
  mailboxId,
  organizations,
  dict,
}: {
  mailboxId: string;
  organizations: { id: string; name: string }[];
  dict: { title: string; share: string; success: string };
}) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // `organizations` can change (a new one created) without this component
  // remounting - derive the effective value at render time rather than an
  // effect (React's own guidance for clamping state derived from changing
  // props).
  const effectiveOrganizationId = organizations.some((o) => o.id === organizationId)
    ? organizationId
    : organizations[0]?.id ?? "";

  function handleShare() {
    if (!effectiveOrganizationId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await shareMailboxToOrganization(effectiveOrganizationId, mailboxId);
      setMessage(result.error ?? dict.success);
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm text-muted-foreground">{dict.title}</p>
      <div className="flex gap-2">
        <Select value={effectiveOrganizationId} onValueChange={setOrganizationId}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={handleShare} disabled={pending}>
          {dict.share}
        </Button>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
