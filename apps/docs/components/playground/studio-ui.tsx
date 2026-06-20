"use client";

/**
 * studio-ui — shared chrome primitives for the chart Studios.
 *
 * Rule-of-Three extraction: PanelHeader / Accordion / Field / TextInput /
 * NumberInput / Segmented / Select / Toggle / Swatch / ColorPalette /
 * ColorCustomInput (+ the pure colour helpers PALETTE / DEFAULT_ACCENT /
 * HEX_RE / normalizeHex / isInPalette) were copy-pasted near-identically into
 * column-, bar-, and line-chart-studio. The third copy triggered extraction —
 * they now live here once, imported by all three Studios with unchanged prop
 * signatures so the call sites need no edits.
 *
 * Enterprise canon (Resend / Vercel / Linear spirit), anchored on the
 * studio-theme.tsx switcher:
 *  - Radius: controls `rounded-md`, larger wrappers `rounded-lg`. No
 *    `rounded-[2px]` / `rounded-none` here.
 *  - Labels: sentence-case Geist sans (`font-sans`), no mono/uppercase/tracking.
 *    NUMERIC values keep Hack mono (`font-mono tabular-nums`).
 *  - Surfaces: input/track `bg-muted/40`; a control's active/selected state is
 *    `bg-background text-foreground shadow-sm` on a `bg-muted/50` track.
 *  - `--brock-accent` is reserved for selected-segment text/icon, checked
 *    toggles, and focus rings — never borders or hover.
 *  - Focus: soft `focus-visible:ring-2 ring-brock-accent/40`, no hard outlines.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { useTranslations } from "next-intl";

/* ─── Shared colour constants + helpers ──────────────────────────────── */

/**
 * Curated 18-swatch palette in Tailwind 500-range hues. Brock orange is first
 * so the Studio always opens on brand. Hover title shows the human name.
 */
export const PALETTE = [
  { name: "Brock", value: "#F54900" },
  { name: "Red", value: "#EF4444" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Lime", value: "#84CC16" },
  { name: "Green", value: "#10B981" },
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Sky", value: "#0EA5E9" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Purple", value: "#A855F7" },
  { name: "Fuchsia", value: "#D946EF" },
  { name: "Pink", value: "#EC4899" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Zinc", value: "#71717A" },
] as const;

export const DEFAULT_ACCENT = "#F54900";

export const HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_RE.test(withHash)) return null;
  if (withHash.length === 4) {
    // Expand #rgb → #rrggbb
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

export function isInPalette(hex: string): boolean {
  const normalized = hex.toLowerCase();
  return PALETTE.some((c) => c.value.toLowerCase() === normalized);
}

/* ─── Panel/section primitives ───────────────────────────────────────── */

export function PanelHeader({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-border px-3">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Accordion({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brock-accent/40"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

export function Swatch({
  color,
  selected,
  onClick,
  title,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  title: string;
}) {
  const t = useTranslations("studio");
  return (
    <button
      onClick={onClick}
      className={`h-6 w-6 cursor-pointer rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brock-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
        selected
          ? "ring-2 ring-offset-2 ring-offset-card"
          : "opacity-70 hover:opacity-100"
      }`}
      style={
        {
          backgroundColor: color,
          ...(selected
            ? ({ "--tw-ring-color": color } as React.CSSProperties)
            : {}),
        } as React.CSSProperties
      }
      aria-label={t("aria.color", { name: title })}
      aria-pressed={selected}
      title={title}
    />
  );
}

export function ColorPalette({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (hex: string) => void;
}) {
  const lower = value.toLowerCase();
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {PALETTE.map((c) => (
        <Swatch
          key={c.name}
          color={c.value}
          selected={c.value.toLowerCase() === lower}
          onClick={() => onSelect(c.value)}
          title={c.name}
        />
      ))}
    </div>
  );
}

/** Eyedropper / pipette glyph (founder-supplied) — fill/currentColor. */
function PipetteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 68 68"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M30.8 44.5c-1 0-1.9.4-2.5 1-.8.8-1.7 1.2-2.8 1.4.1 2 .1 4.5-.9 5.9-1.8 2.7-5.4 3.5-8.1 1.7-2.7-1.7-3.5-5.3-1.7-8.1 1-1.5 3.5-2.6 5.4-3.3-.1-.3-.1-.7-.1-1 0-1.3.5-2.5 1.4-3.4.5-.5.8-1 .9-1.6-1.5-.5-3.1-.8-4.8-.8-8.1.1-14.7 6.7-14.7 14.9S9.5 66 17.7 66c8.2 0 14.8-6.6 14.8-14.8 0-2.4-.6-4.7-1.6-6.7h-.1zM63.5 3.7c-2.2-2.2-5.8-2.2-8 0l-7.6 7.6 8 8 7.6-7.6c2.2-2.3 2.2-5.8 0-8z" />
      <path d="M46.2 11.6c-1.1-1.1-2.8-1.1-3.9 0l-.2.2c-1.1 1.1-1.1 2.8 0 3.9l.2.2-16.4 16.2a6.55 6.55 0 0 0-1.9 4.2c-.1 1.4-.6 2.6-1.5 3.5-1.3 1.3-1.3 3.3 0 4.6 1.3 1.3 3.3 1.3 4.7 0 .9-.9 2.1-1.4 3.5-1.5 1.6-.1 3.1-.7 4.2-1.9l16.3-16.3c1.1 1 2.7 1 3.8-.1l.2-.2c1.1-1.1 1.1-2.8 0-3.9l-9-8.9zM35 25.2l8.4-8.4 6.9 6.9-5.6 5.6-9.7-4.1zM16.1 47.3c-1.3 2-.7 4.7 1.3 6 2.1 1.3 4.7.7 6-1.3.7-1.1.7-3.4.6-5.2-1.4-.3-2.6-1.2-3.2-2.3-1.7.7-3.9 1.6-4.7 2.8z" />
    </svg>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v || 0)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Brock-styled colour picker. Replaces the OS-native `<input type=color>`
 *  popup (whose huge, square RGB fields clashed with our canon) with a custom
 *  popover: react-colorful saturation/hue + rounded R/G/B chips + a screen
 *  eyedropper (EyeDropper API, where supported). The palette above covers the
 *  common picks; this is the precise/expressive path. */
export function ColorCustomInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useTranslations("studio");
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [hasEyeDropper, setHasEyeDropper] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasEyeDropper(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  // Close the popover on outside click / Escape.
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

  // Keep the text field in sync when accent changes from outside (palette click).
  if (
    text.toLowerCase() !== value.toLowerCase() &&
    document.activeElement?.tagName !== "INPUT"
  ) {
    setText(value);
  }

  function commit(raw: string) {
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
  }

  const rgb = hexToRgb(value);
  const setChannel = (ch: "r" | "g" | "b", raw: string) => {
    const v = Number(raw);
    if (Number.isNaN(v)) return;
    onChange(rgbToHex(ch === "r" ? v : rgb.r, ch === "g" ? v : rgb.g, ch === "b" ? v : rgb.b));
  };

  async function pickFromScreen() {
    const ED = (
      window as unknown as {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!ED) return;
    try {
      const res = await new ED().open();
      if (res?.sRGBHex) onChange(res.sRGBHex.toUpperCase());
    } catch {
      /* user dismissed the eyedropper */
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-1.5">
        {/* swatch trigger — opens the popover */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t("aria.colorPicker")}
          title={t("aria.colorPicker")}
          className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border outline-none transition-all focus-visible:ring-2 focus-visible:ring-brock-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          placeholder={t("placeholders.hex")}
          spellCheck={false}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus-visible:border-brock-accent/40 focus-visible:ring-2 focus-visible:ring-brock-accent/40"
        />
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={t("aria.colorPicker")}
          className="absolute start-0 top-[34px] z-50 w-[224px] space-y-2.5 rounded-lg border border-border bg-popover p-2.5 shadow-md"
        >
          <HexColorPicker
            color={value}
            onChange={onChange}
            className="brock-colorful"
          />
          <div className="flex items-center gap-1.5">
            {hasEyeDropper && (
              <button
                type="button"
                onClick={pickFromScreen}
                aria-label={t("aria.pickFromScreen")}
                title={t("aria.pickFromScreen")}
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brock-accent/40"
              >
                <PipetteIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {(["r", "g", "b"] as const).map((ch) => (
              <div
                key={ch}
                className="flex h-7 min-w-0 flex-1 items-center rounded-md border border-border bg-muted/40 transition-colors has-[:focus-visible]:border-brock-accent/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brock-accent/40"
              >
                <span className="ps-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {ch}
                </span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb[ch]}
                  onChange={(e) => setChannel(ch, e.target.value)}
                  aria-label={`${ch.toUpperCase()} 0–255`}
                  className="w-full min-w-0 bg-transparent px-1 text-center font-mono text-xs text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 font-sans text-xs text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus-visible:border-brock-accent/40 focus-visible:ring-2 focus-visible:ring-brock-accent/40"
    />
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (!Number.isNaN(next)) onChange(next);
      }}
      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs tabular-nums text-foreground outline-none transition-colors focus-visible:border-brock-accent/40 focus-visible:ring-2 focus-visible:ring-brock-accent/40"
    />
  );
}

export function Segmented({
  options,
  selectedIndex,
  onSelect,
}: {
  options: readonly string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="inline-flex w-full items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5">
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={opt}
            onClick={() => onSelect(i)}
            title={opt}
            className={`min-w-0 flex-1 cursor-pointer truncate rounded-[5px] px-1.5 py-1 text-center font-sans text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brock-accent/40 ${
              selected
                ? "bg-background text-brock-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={selected}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact native-select dropdown for option lists too long or too wordy for a
 * Segmented control in the 260px settings rail.
 */
export function Select({
  options,
  selectedIndex,
  onSelect,
}: {
  options: readonly string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="relative">
      <select
        value={selectedIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full cursor-pointer appearance-none rounded-md border border-border bg-muted/40 py-1.5 pr-7 pl-2 font-sans text-xs text-foreground outline-none transition-colors focus-visible:border-brock-accent/40 focus-visible:ring-2 focus-visible:ring-brock-accent/40"
      >
        {options.map((opt, i) => (
          <option key={`${opt}-${i}`} value={i}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-sans text-xs text-muted-foreground hover:text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brock-accent/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-card ${
          checked
            ? "border-brock-accent bg-brock-accent"
            : "border-muted-foreground/50 bg-transparent"
        }`}
      >
        {checked && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-2.5 w-2.5 text-primary-foreground"
            aria-hidden
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </label>
  );
}
