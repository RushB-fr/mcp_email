"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/actions/locale";
import type { Dictionary, Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

/**
 * Simple FR/EN toggle. Takes the current locale (and its own two labels)
 * as props from a Server Component ancestor - see lib/i18n/locale.ts - so it
 * never has to read the `locale` cookie itself. Setting the cookie is a
 * server action; router.refresh() is what actually makes the already-
 * mounted Server Components re-render in the new language.
 */
export function LanguageSwitcher({ locale, labels }: { locale: Locale; labels: Dictionary["languageSwitcher"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSelect(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  const options: { value: Locale; label: string }[] = [
    { value: "fr", label: labels.fr },
    { value: "en", label: labels.en },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5 text-xs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleSelect(option.value)}
          disabled={pending}
          aria-current={locale === option.value}
          className={cn(
            "rounded px-2 py-1 font-medium transition-colors disabled:pointer-events-none",
            locale === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
