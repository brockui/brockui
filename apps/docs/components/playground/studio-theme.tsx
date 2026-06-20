"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Shared studio chart-preview theme — extracted once a third studio arrived
 * (Rule of Three). The preview can follow the site theme (`auto`, live via a
 * class observer) or be pinned to `light` / `dark` to demo both renderings.
 * The toggle mirrors the header switcher: a soft segmented Auto / Light / Dark
 * pill with the active segment tinted in --brock-accent.
 */
export type StudioPreviewMode = "auto" | "light" | "dark";

export function useStudioPreviewTheme() {
  const [mode, setMode] = useState<StudioPreviewMode>("auto");
  const [siteTheme, setSiteTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setSiteTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const previewTheme: "light" | "dark" = mode === "auto" ? siteTheme : mode;
  return { mode, setMode, previewTheme };
}

export function StudioThemeToggle({
  mode,
  onChange,
}: {
  mode: StudioPreviewMode;
  onChange: (mode: StudioPreviewMode) => void;
}) {
  const t = useTranslations("studio");
  const items: { m: StudioPreviewMode; label: string; icon: ReactNode }[] = [
    { m: "auto", label: t("aria.previewAuto"), icon: <MonitorIcon /> },
    { m: "light", label: t("aria.previewLight"), icon: <SunIcon /> },
    { m: "dark", label: t("aria.previewDark"), icon: <MoonIcon /> },
  ];
  return (
    <div
      className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5"
      role="group"
      aria-label={t("aria.previewTheme")}
    >
      {items.map(({ m, label, icon }) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          aria-label={label}
          title={label}
          className={[
            "inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] transition-colors",
            mode === m
              ? "bg-background text-brock-accent shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

/* ─── Icons (shared with the header theme switcher) ──────────────────── */

function MonitorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
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

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
