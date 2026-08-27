"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";

export function LogoutButton({ label, iconOnly = false }: { label: string; iconOnly?: boolean }) {
  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={label}
        aria-label={label}
        onClick={() => {
          void logoutAction();
        }}
      >
        <LogOut className="h-[15px] w-[15px]" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void logoutAction();
      }}
    >
      <LogOut className="h-4 w-4" /> {label}
    </Button>
  );
}
