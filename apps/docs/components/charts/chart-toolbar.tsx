"use client";

import { Fragment, useEffect, useRef, useState } from "react";

/**
 * Chart export menu — the default top-right toolbar shared by every Brock UI
 * chart. A single hamburger button opens a dropdown of export actions
 * (Highcharts pattern) instead of a row of always-on chips: less ink over the
 * data, and it scales as more formats arrive.
 *
 * Generic by design (no chart-specific types) so all charts ship the same file
 * through the registry. Consumers who want a fully custom bar still use the
 * `slots.toolbar` override on the chart.
 */
export type ChartExportConfig = {
  png: boolean;
  svg: boolean;
  csv: boolean;
  copy: boolean;
};

type Kind = "png" | "svg" | "csv" | "copy";

export function ChartExportMenu({
  config,
  onPNG,
  onSVG,
  onCSV,
  onCopy,
  label = "Export chart",
}: {
  config: ChartExportConfig;
  onPNG: () => void | Promise<void>;
  onSVG: () => void | Promise<void>;
  onCSV: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  /** Accessible label for the trigger (override for localization). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (kind: Kind, action: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await action();
      if (kind === "copy") {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
      // Downloads dismiss the menu; copy keeps it so the ✓ is seen briefly.
      if (kind !== "copy") setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  // Items grouped: image downloads · data download · clipboard. A divider is
  // drawn whenever the group index changes.
  const items: { kind: Kind; group: number; text: string; action: () => void | Promise<void> }[] =
    [
      config.png && { kind: "png" as const, group: 0, text: "Download PNG", action: onPNG },
      config.svg && { kind: "svg" as const, group: 0, text: "Download SVG", action: onSVG },
      config.csv && { kind: "csv" as const, group: 1, text: "Download CSV", action: onCSV },
      config.copy && {
        kind: "copy" as const,
        group: 2,
        text: copied ? "Copied" : "Copy image",
        action: onCopy,
      },
    ].filter(Boolean) as typeof items;

  return (
    <div
      ref={rootRef}
      className="brock-toolbar absolute top-0 end-0 z-30"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-brock-accent/60 hover:text-foreground"
      >
        <HamburgerIcon />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute end-0 top-[34px] z-40 min-w-44 overflow-hidden rounded-md border border-border bg-background py-1 shadow-md"
        >
          {items.map((item, i) => (
            <Fragment key={item.kind}>
              {i > 0 && item.group !== items[i - 1].group && (
                <div className="my-1 border-t border-border" role="separator" />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={!!busy}
                onClick={() => run(item.kind, item.action)}
                className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left font-sans text-[13px] text-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-50"
              >
                <span>{item.text}</span>
                {item.kind === "copy" ? (
                  copied ? (
                    <CheckGlyph className="h-3.5 w-3.5 shrink-0 text-brock-accent" />
                  ) : (
                    <CopyGlyph className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    {item.kind}
                  </span>
                )}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/** Copy glyph (founder-supplied, Iconly) — stroke/currentColor so it themes
 *  itself. Matches the code-block copy button for a consistent "copy" mark. */
function CopyGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14.9572 5.47322C14.7283 3.9968 13.6651 3 12.0629 3H6.86577C5.0565 3 3.91992 4.28509 3.91992 6.10048V12.7954C3.91992 14.4491 4.86518 15.6678 6.41498 15.86" />
      <path d="M17.1354 8.11328H11.94C10.1298 8.11328 8.99414 9.39488 8.99414 11.2094V17.9043C8.99414 19.7188 10.1237 21.0004 11.94 21.0004H17.1345C18.9517 21.0004 20.0812 19.7188 20.0812 17.9043V11.2094C20.0812 9.39488 18.9517 8.11328 17.1354 8.11328Z" />
    </svg>
  );
}

/** Check mark shown briefly after a successful copy. */
function CheckGlyph({ className }: { className?: string }) {
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
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/** Hamburger / menu icon (filled, supplied by the founder). */
function HamburgerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.25 19C3.25 18.5858 3.58579 18.25 4 18.25H20C20.4142 18.25 20.75 18.5858 20.75 19C20.75 19.4142 20.4142 19.75 20 19.75H4C3.58579 19.75 3.25 19.4142 3.25 19Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.25 5C3.25 4.58579 3.58579 4.25 4 4.25H20C20.4142 4.25 20.75 4.58579 20.75 5C20.75 5.41421 20.4142 5.75 20 5.75H4C3.58579 5.75 3.25 5.41421 3.25 5Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.25 12C3.25 11.5858 3.58579 11.25 4 11.25H20C20.4142 11.25 20.75 11.5858 20.75 12C20.75 12.4142 20.4142 12.75 20 12.75H4C3.58579 12.75 3.25 12.4142 3.25 12Z"
      />
    </svg>
  );
}
