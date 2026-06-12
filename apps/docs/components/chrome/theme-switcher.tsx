"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";
const STORAGE_KEY = "brockui-theme";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeSwitcher() {
  const t = useTranslations("chrome");
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // After mount, sync from the actual class set by the inline pre-hydration script
  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
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

  // Avoid mismatch during hydration — render a neutral button until mounted
  const ariaLabel = mounted
    ? theme === "dark"
      ? t("themeToLight")
      : t("themeToDark")
    : "Toggle theme";

  return (
    <button
      onClick={toggle}
      aria-label={ariaLabel}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-brock-accent/60 hover:bg-muted hover:text-foreground"
    >
      {mounted ? (
        theme === "dark" ? (
          <SunIcon className="h-3.5 w-3.5" />
        ) : (
          <MoonIcon className="h-3.5 w-3.5" />
        )
      ) : (
        <span className="block h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
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
      strokeLinecap="square"
      className={className}
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
