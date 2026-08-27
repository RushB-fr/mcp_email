"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { redeemInvite } from "@/lib/actions/signup";
import type { Dictionary } from "@/lib/i18n/locale";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Identity-only signup: email + password, no IMAP/SMTP fields - attaching a mailbox happens later from Réglages (see components/auth/setup-form.tsx). */
export function SignupForm({ token, dict }: { token: string; dict: Pick<Dictionary, "common" | "auth"> }) {
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await redeemInvite({
      email: formData.get("email"),
      password: formData.get("password"),
      token,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setVerifying(true);
    }
  }

  if (verifying) {
    return (
      <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{dict.auth.signup.verifyingMessage}</p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{dict.common.emailLabel}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{dict.common.passwordLabel}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <SubmitButton label={dict.auth.signup.submit} pendingLabel={dict.auth.signup.submitPending} />
    </form>
  );
}
