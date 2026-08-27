"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, oauthSignInAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/locale";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function OAuthButton({ label, action }: { label: string; action: () => Promise<void> }) {
  return (
    <form action={action}>
      <Button type="submit" variant="outline" className="w-full">
        {label}
      </Button>
    </form>
  );
}

export function LoginForm({
  callbackUrl,
  googleEnabled,
  githubEnabled,
  dict,
}: {
  callbackUrl?: string;
  googleEnabled: boolean;
  githubEnabled: boolean;
  dict: Pick<Dictionary, "common" | "auth">;
}) {
  const [state, formAction] = useFormState(loginAction, { error: null });

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
        <div className="space-y-2">
          <Label htmlFor="email">{dict.common.emailLabel}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{dict.common.passwordLabel}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
        )}
        <SubmitButton label={dict.common.login} pendingLabel={dict.auth.login.submitPending} />
      </form>

      {(googleEnabled || githubEnabled) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {dict.auth.login.orDivider}{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          {googleEnabled && (
            <OAuthButton
              label={dict.auth.login.continueWithGoogle}
              action={oauthSignInAction.bind(null, "google", callbackUrl)}
            />
          )}
          {githubEnabled && (
            <OAuthButton
              label={dict.auth.login.continueWithGithub}
              action={oauthSignInAction.bind(null, "github", callbackUrl)}
            />
          )}
        </div>
      )}
    </div>
  );
}
