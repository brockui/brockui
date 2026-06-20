"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Mode = "system" | "light" | "dark";
const STORAGE_KEY = "brockui-theme";

function readStoredMode(): Mode {
  if (typeof localStorage === "undefined") return "light";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "dark" || v === "system" ? v : "light";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Apply a mode to <html> (add/remove `.dark`) — system resolves live. */
function applyMode(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Theme switcher — a soft segmented System / Light / Dark control (all three
 * visible, the active one filled). Matches the kasymzhanov.com blog chrome and
 * Highcharts' "Auto · Light · Dark" pattern. System follows the OS and updates
 * live when the OS theme changes.
 */
export function ThemeSwitcher() {
  const t = useTranslations("chrome");
  const [mode, setMode] = useState<Mode>("light");
  const [mounted, setMounted] = useState(false);

  // Sync from storage after mount (the inline pre-hydration script already set
  // the class; here we light up the matching segment).
  useEffect(() => {
    setMode(readStoredMode());
    setMounted(true);
  }, []);

  // While in system mode, follow OS theme changes live.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  function choose(next: Mode) {
    setMode(next);
    applyMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore (private mode etc.)
    }
  }

  const active = mounted ? mode : undefined;

  return (
    <div className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5">
      <Segment
        active={active === "system"}
        label={t("themeSystem")}
        onClick={() => choose("system")}
      >
        <MonitorIcon className="h-3.5 w-3.5" />
      </Segment>
      <Segment
        active={active === "light"}
        label={t("themeToLight")}
        onClick={() => choose("light")}
      >
        <SunIcon className="h-3.5 w-3.5" />
      </Segment>
      <Segment
        active={active === "dark"}
        label={t("themeToDark")}
        onClick={() => choose("dark")}
      >
        <MoonIcon className="h-3.5 w-3.5" />
      </Segment>
    </div>
  );
}

function Segment({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={[
        "inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] transition-colors",
        active
          ? "bg-background text-brock-accent shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────────── */

/** Monitor (system / auto) — filled, supplied by the founder. */
function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.25 6.2892C2.25 4.21494 3.93254 2.53271 6.00746 2.53271H17.9935C20.0688 2.53271 21.75 4.21525 21.75 6.2892V13.7899C21.75 15.8646 20.0689 17.5473 17.9935 17.5473H6.00746C3.93238 17.5473 2.25 15.8649 2.25 13.7899V6.2892ZM6.00746 4.03271C4.76065 4.03271 3.75 5.04368 3.75 6.2892V13.7899C3.75 15.0365 4.76081 16.0473 6.00746 16.0473H17.9935C19.2398 16.0473 20.25 15.0368 20.25 13.7899V6.2892C20.25 5.04336 19.24 4.03271 17.9935 4.03271H6.00746Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.30469 20.7168C7.30469 20.3026 7.64047 19.9668 8.05469 19.9668H15.9445C16.3587 19.9668 16.6945 20.3026 16.6945 20.7168C16.6945 21.131 16.3587 21.4668 15.9445 21.4668H8.05469C7.64047 21.4668 7.30469 21.131 7.30469 20.7168Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 16.2539C12.4142 16.2539 12.75 16.5897 12.75 17.0039V20.7168C12.75 21.131 12.4142 21.4668 12 21.4668C11.5858 21.4668 11.25 21.131 11.25 20.7168V17.0039C11.25 16.5897 11.5858 16.2539 12 16.2539Z"
      />
    </svg>
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
