"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { setupMailbox } from "@/lib/actions/setup";
import type { Dictionary } from "@/lib/i18n/locale";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

type DefaultValues = {
  email?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
};

type Props = {
  /** Editing an existing mailbox (credentials update) vs attaching a brand new one. */
  mailboxId?: string;
  defaultValues?: DefaultValues;
  onSuccess?: () => void;
  dict: Pick<Dictionary, "common"> & { auth: { setup: Dictionary["auth"]["setup"] } };
};

/** Attaches a new mailbox to the logged-in user, or edits an existing one's credentials (mailboxId given) - see lib/actions/setup.ts. */
export function SetupForm({ mailboxId, defaultValues, onSuccess, dict }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
      imapHost: formData.get("imapHost"),
      imapPort: formData.get("imapPort"),
      imapSecure: formData.get("imapSecure"),
      smtpHost: formData.get("smtpHost"),
      smtpPort: formData.get("smtpPort"),
      smtpSecure: formData.get("smtpSecure"),
    };
    const result = await setupMailbox(payload, mailboxId);
    if (result?.error) {
      setError(result.error);
    } else if (mailboxId) {
      setSuccess(true);
    } else {
      onSuccess?.();
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{dict.common.emailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultValues?.email}
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{dict.auth.setup.passwordLabel}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </div>

      <CollapsibleSection
        summary={<span className="text-muted-foreground">{dict.auth.setup.serverSettingsSummary}</span>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="imapHost">{dict.auth.setup.imapHostLabel}</Label>
              <Input id="imapHost" name="imapHost" defaultValue={defaultValues?.imapHost ?? "imap.mail.ovh.net"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imapPort">{dict.auth.setup.imapPortLabel}</Label>
              <Input
                id="imapPort"
                name="imapPort"
                type="number"
                defaultValue={defaultValues?.imapPort ?? 993}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="imapSecure"
              defaultChecked={defaultValues?.imapSecure ?? true}
              className="h-4 w-4"
            />
            {dict.auth.setup.imapSecureLabel}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">{dict.auth.setup.smtpHostLabel}</Label>
              <Input id="smtpHost" name="smtpHost" defaultValue={defaultValues?.smtpHost ?? "smtp.mail.ovh.net"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">{dict.auth.setup.smtpPortLabel}</Label>
              <Input
                id="smtpPort"
                name="smtpPort"
                type="number"
                defaultValue={defaultValues?.smtpPort ?? 465}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="smtpSecure"
              defaultChecked={defaultValues?.smtpSecure ?? true}
              className="h-4 w-4"
            />
            {dict.auth.setup.smtpSecureLabel}
          </label>
        </div>
      </CollapsibleSection>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{dict.auth.setup.updateSuccess}</p>
      )}
      <SubmitButton
        label={mailboxId ? dict.auth.setup.submitUpdate : dict.auth.setup.submitAdd}
        pendingLabel={dict.auth.setup.submitPending}
      />
    </form>
  );
}
