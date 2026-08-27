import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // bg-primary is near-black post design-v2 (see globals.css) - this
        // is the only variant change needed to get design-proposal-v2's
        // .btn-primary look, the token does the work.
        default: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-muted text-foreground hover:bg-accent",
        // border-input (not border-border): v2's .btn-secondary uses the
        // stronger field/button gray, not the faint row-separator one.
        outline: "border border-input bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent",
        // v2's .btn-danger-ghost: transparent/muted at rest, red tint on
        // hover - for icon-only destructive row actions (delete, revoke,
        // cancel invite) instead of a solid red button on every row.
        "destructive-ghost": "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-12 rounded-sm px-6 text-base",
        icon: "h-10 w-10",
        // v2's row-action icon buttons are compact (~28px) - the default
        // icon size (40px) is too heavy for a dense list of inline actions.
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
