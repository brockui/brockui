"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";
const STORAGE_KEY = "brockui-theme";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Theme switcher — a soft segmented sun/moon pill (both options visible, the
 * active one filled), matching the kasymzhanov.com blog chrome. Friendlier
 * than a single cryptic toggle: a reader sees both choices and which is on.
 */
export function ThemeSwitcher() {
  const t = useTranslations("chrome");
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // After mount, sync from the class set by the inline pre-hydration script.
  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore (private mode etc.)
    }
  }

  // Until mounted, highlight neither (avoids a hydration class mismatch).
  const active: Theme | undefined = mounted ? theme : undefined;

  return (
    <div className="inline-flex h-8 items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5">
      <button
        type="button"
        onClick={() => apply("light")}
        aria-label={t("themeToLight")}
        aria-pressed={active === "light"}
        className={segmentClass(active === "light")}
      >
        <SunIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => apply("dark")}
        aria-label={t("themeToDark")}
        aria-pressed={active === "dark"}
        className={segmentClass(active === "dark")}
      >
        <MoonIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function segmentClass(active: boolean): string {
  return [
    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  ].join(" ");
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
