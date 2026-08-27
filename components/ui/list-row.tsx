import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * The "rows" pattern from design-proposal-v2.html (`.rows`/`.row`): a list
 * of items separated by a hairline border instead of one `Card` per item.
 * Used for mailboxes, organization members, pending invites, shared
 * mailboxes, mailbox groups and grants (see app/settings/*).
 */
export function Rows({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-border", className)} {...props} />;
}

export function Row({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-border py-3.5", className)}
      {...props}
    />
  );
}

export function RowMain({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", className)} {...props} />;
}

export function RowActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex shrink-0 items-center gap-1", className)} {...props} />;
}
