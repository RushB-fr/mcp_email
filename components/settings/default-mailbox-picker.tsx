"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { setDefaultMailbox } from "@/lib/actions/mailbox";

export function DefaultMailboxPicker({
  mailboxes,
  dict,
}: {
  mailboxes: { id: string; email: string; isDefault: boolean }[];
  dict: { label: string; saveButton: string; saveSuccess: string };
}) {
  const current = mailboxes.find((m) => m.isDefault)?.id ?? mailboxes[0]?.id ?? "";
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (mailboxes.length === 0) return null;

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await setDefaultMailbox(value);
      setMessage(result.error ?? dict.saveSuccess);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{dict.label}</p>
      <div className="flex gap-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mailboxes.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={pending || value === current}>
          {dict.saveButton}
        </Button>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
