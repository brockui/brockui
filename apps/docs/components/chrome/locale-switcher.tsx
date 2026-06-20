"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Header language switcher — a soft segmented RU/EN pill (both languages
 * visible, the active one filled), matching the kasymzhanov.com blog chrome.
 *
 * URL-based: each segment links to the same path under the other locale, so a
 * link shared from /ru stays Russian and search engines index both languages.
 * Each segment is labelled in its OWN language (the universal i18n convention:
 * a person who doesn't read the current UI language must still recognise theirs).
 */
const LOCALES = [
  { code: "ru", label: "RU", aria: "Русская версия" },
  { code: "en", label: "EN", aria: "English version" },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5">
      {LOCALES.map(({ code, label, aria }) => {
        const active = code === locale;
        return (
          <Link
            key={code}
            href={pathname}
            locale={code}
            aria-label={aria}
            aria-current={active ? "true" : undefined}
            className={[
              "inline-flex h-6 cursor-pointer items-center justify-center rounded-[5px] px-2 font-mono text-[11px] font-bold transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
