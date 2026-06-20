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

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
        className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
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
      className={`h-6 w-6 cursor-pointer rounded-md transition-all ${
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

export function ColorCustomInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useTranslations("studio");
  const [text, setText] = useState(value);

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

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        aria-label={t("aria.pickCustomColor")}
        title={t("aria.colorPicker")}
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
        className="flex-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus-visible:border-brock-accent/40 focus-visible:ring-2 focus-visible:ring-brock-accent/40"
      />
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
            className={`min-w-0 flex-1 cursor-pointer truncate rounded-[5px] px-1.5 py-1 text-center font-sans text-[11px] transition-colors ${
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
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
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
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span>{label}</span>
    </label>
  );
}
