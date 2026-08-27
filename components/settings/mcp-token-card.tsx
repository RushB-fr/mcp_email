"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateMcpToken } from "@/lib/actions/mcp-token";

type McpTokenDict = {
  urlLabel: string;
  copied: string;
  regenerateButton: string;
  regeneratePending: string;
  confirmRegenerate: string;
};

export function McpTokenCard({
  initialToken,
  mcpUrl,
  dict,
}: {
  initialToken: string;
  mcpUrl: string;
  dict: McpTokenDict;
}) {
  const [token, setToken] = useState(initialToken);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    const confirmed = window.confirm(dict.confirmRegenerate);
    if (!confirmed) return;

    setRegenerating(true);
    const newToken = await regenerateMcpToken();
    setToken(newToken);
    setRevealed(true);
    setRegenerating(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-mono text-[0.78rem] text-muted-foreground">{dict.urlLabel}</p>
        <p className="font-mono text-[0.85rem]">{mcpUrl}</p>
      </div>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-muted/40 px-2.5 py-2">
        <span className="flex-1 truncate font-mono text-sm text-muted-foreground">
          {revealed ? token : "•".repeat(24)}
        </span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setRevealed((v) => !v)}>
          {revealed ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopy}>
          <Copy className="h-[14px] w-[14px]" />
        </Button>
      </div>
      {copied && <p className="text-xs text-success">{dict.copied}</p>}
      <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
        <RotateCw className="h-4 w-4" /> {regenerating ? dict.regeneratePending : dict.regenerateButton}
      </Button>
    </div>
  );
}
