"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { testMailConnection } from "@/lib/actions/mail-test";

export function MailConnectionTest({
  mailboxId,
  dict,
}: {
  mailboxId: string;
  dict: { testButton: string; testPending: string; testSuccessPrefix: string };
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ error: string | null; folders?: string[] } | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    const outcome = await testMailConnection(mailboxId);
    setResult(outcome);
    setTesting(false);
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
        {testing ? dict.testPending : dict.testButton}
      </Button>
      {result?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{result.error}</p>
      )}
      {result?.folders && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {dict.testSuccessPrefix}
          {result.folders.join(", ")}
        </p>
      )}
    </div>
  );
}
