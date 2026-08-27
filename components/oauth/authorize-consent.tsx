"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveAuthorization, denyAuthorization } from "@/lib/actions/oauth";

type Params = {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

type ConsentDict = {
  consent: { middle: string; suffix: string };
  deny: string;
  approve: string;
  approvePending: string;
};

export function AuthorizeConsent({
  clientName,
  accountEmail,
  params,
  dict,
}: {
  clientName: string;
  accountEmail: string;
  params: Params;
  dict: ConsentDict;
}) {
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);

  async function handleApprove() {
    setPending("approve");
    await approveAuthorization(params);
  }

  async function handleDeny() {
    setPending("deny");
    await denyAuthorization({ redirectUri: params.redirectUri, state: params.state });
  }

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{clientName}</span> {dict.consent.middle}{" "}
        <span className="font-medium text-foreground">{accountEmail}</span> {dict.consent.suffix}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={handleDeny} disabled={pending !== null}>
          {dict.deny}
        </Button>
        <Button type="button" className="flex-1" onClick={handleApprove} disabled={pending !== null}>
          {pending === "approve" ? dict.approvePending : dict.approve}
        </Button>
      </div>
    </div>
  );
}
