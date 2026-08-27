"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Building2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { mail: Mail, building: Building2, shield: Shield } as const;

type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
};

/**
 * Sidebar nav from design-proposal-v2.html: active item gets the indigo
 * `--ring` treatment (bg-ring/10 text-ring - reusing the existing ring
 * token rather than introducing the mockup's standalone --accent), inactive
 * items are muted with a light hover. Needs usePathname() (client) to know
 * which of the three settings routes is current; rendered twice by
 * app/settings/layout.tsx (vertical in the desktop sidebar, horizontal in a
 * mobile-only top bar - the mockup itself has no mobile nav, since its
 * sidebar simply disappears below 860px, but hiding the only way to switch
 * sections on small screens would be a functional regression).
 */
export function SettingsNav({ items, orientation = "vertical" }: { items: NavItem[]; orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-0.5", orientation === "vertical" ? "flex-col" : "flex-row overflow-x-auto")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-[0.86rem] font-medium transition-colors",
              active ? "bg-ring/10 text-ring" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
