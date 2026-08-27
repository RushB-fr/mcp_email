import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small status/role label - shadcn/cva pattern, same as button.tsx.
 * Colors and case-treatment ported from design-proposal-v2.html's
 * `.badge`/`.badge.{success,warning,neutral,outline}`: the solid variants
 * are uppercase pills, `outline` alone drops back to normal case/weight
 * (v2's `.badge.outline` override). "En attente" moved from `warning` to
 * `neutral` here to match the mockup - v2 reserves amber for the
 * "dernier propriétaire" warning, not for a routine pending state.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide leading-normal",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        neutral: "bg-muted text-muted-foreground",
        outline: "border-input bg-transparent text-muted-foreground normal-case tracking-normal font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
