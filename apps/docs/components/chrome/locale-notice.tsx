"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const DISMISS_KEY = "brockui-locale-notice-dismissed";

/**
 * Soft language suggestion — NOT a redirect. Content is always served by
 * URL (Accept-Language redirects are an SEO anti-pattern: Googlebot crawls
 * with EN headers and would never discover /ru; a user who clicked an EN
 * link must get the EN page). This banner only OFFERS the other language
 * when the browser's language doesn't match the page, once, dismissible.
 */
export function LocaleNotice() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("banner");
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    const langs = navigator.languages ?? [navigator.language];
    const wantsRu = langs.some((l) => l?.toLowerCase().startsWith("ru"));
    // EN page + RU browser → offer Russian; RU page + non-RU browser → offer English.
    if ((locale === "en" && wantsRu) || (locale === "ru" && !wantsRu)) {
      setShow(true);
    }
  }, [locale]);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode — banner will reappear next visit, acceptable
    }
  };

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg"
    >
      <span>{t("text")}</span>
      <Link
        href={pathname}
        locale={locale === "en" ? "ru" : "en"}
        onClick={dismiss}
        className="font-medium text-brock-accent hover:underline"
      >
        {t("open")}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="cursor-pointer font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}
