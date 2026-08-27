"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptOrganizationInvite } from "@/lib/actions/organization";

export function AcceptOrgInviteButton({
  token,
  dict,
}: {
  token: string;
  dict: { acceptButton: string; acceptPending: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptOrganizationInvite(token);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/settings");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={handleAccept} disabled={pending}>
        {pending ? dict.acceptPending : dict.acceptButton}
      </Button>
    </div>
  );
}
