"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Replaces native <details>/<summary> in the settings cards: functionally
 * identical (a header that toggles a hidden body) but with a rotating
 * lucide-react chevron and a smooth height transition instead of the
 * browser's abrupt, unstyled default disclosure triangle.
 *
 * The height transition uses the CSS grid-rows trick (0fr <-> 1fr on a
 * wrapper, overflow-hidden on its only child) rather than max-height, since
 * that animates to the content's actual height without ever needing to
 * measure it in JS.
 */
export function CollapsibleSection({
  summary,
  defaultOpen = false,
  className,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-in-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="p-3 pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
