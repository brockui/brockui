"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Header language switcher. Canon for docs sites: always visible in the
 * header (not buried in settings — there are no settings on a docs site),
 * URL-based (the locale lives in the path, so links shared from /ru stay
 * Russian and search engines index both languages).
 *
 * The label shows the TARGET language in its own language ("Русская версия"
 * on the EN site) — the universal i18n convention: a person who doesn't read
 * the current language must still recognize their own.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("chrome");
  const target = locale === "en" ? "ru" : "en";

  return (
    <Link
      href={pathname}
      locale={target}
      aria-label={t("localeSwitchAria")}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-border bg-muted/40 px-2.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:bg-muted hover:text-foreground"
    >
      <GlobeIcon className="h-3.5 w-3.5" />
      {target}
    </Link>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}
