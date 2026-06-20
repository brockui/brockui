/**
 * Bar Chart — horizontal ranking bars, editorial-grade.
 *
 * Second component of the Brock UI chart family, inheriting the canonical
 * template from Column Chart (see docs/canon-spec.md §13). Everything in the
 * template-core column is implemented 1:1; the column-specific surface was
 * consciously re-decided for the horizontal shape.
 *
 * The Brock UI signature moves:
 *
 *  1. Hack mono value axis with tabular-nums; --brock-accent for the bar fill
 *     (single color, no gradient/glow); 1px vertical zero baseline only — no
 *     gridlines (Tufte data-ink).
 *  2. Pixel-font tooltip badge (Departure Mono) + Hack value; staggered
 *     CSS-only entry animation (bars grow from the baseline: scaleX,
 *     origin-left for positives, origin-right for negatives) that honors
 *     prefers-reduced-motion.
 *  3. ASCII "no data" empty state; dashed horizontal ghost-bar skeleton with
 *     LOADING badge; ▲▲▲ error state with optional Retry button — same
 *     Tufte-friendly visual language as Column Chart.
 *  4. Hatching as a Tufte encoding via per-bar `pattern: 'hatched'` + 5
 *     pattern styles (diagonal / reverse / vertical / horizontal / dots).
 *  5. Per-bar editorial overrides via the object-form `data` shape:
 *     { label, value, pattern, color, highlight, note } — emphasis without a
 *     separate annotations API. `sort` (asc/desc) + `topN` (with an "Other"
 *     bucket) turn the chart into a ranking without reshaping data — the
 *     horizontal bar IS the ranking shape, so these earn their keep here.
 *  6. Reference line (fixed value or computed mean/median stat) drawn as a
 *     VERTICAL dashed line that participates in the scale on both sides,
 *     with its label chip at the top.
 *  7. Editorial extras: short `caption` below source; diagonal `watermark`
 *     overlay for DRAFT / CONFIDENTIAL; both reproduced in SVG export.
 *  8. Native export: PNG / SVG / CSV / Copy via the Toolbar slot or the
 *     imperative ref. Zero external deps. Patterns + per-bar colors survive
 *     the round-trip.
 *  9. Print stylesheet (@media print) strips toolbar/overlays, forces solid
 *     bg, prevents page-breaks inside the figure, prints the watermark darker.
 * 10. Event callbacks: onBarClick / onBarHover / onBarFocus. Imperative ref
 *     API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }.
 *     Touch: tap pins a bar's tooltip; re-tap dismisses, tapping another switches.
 * 11. Full slot system for headless customization: tooltip / empty / loading /
 *     error / toolbar / caption / watermark — each typed with its own props.
 * 12. Forward-compat for Python / WordPress / static embeds: chartType +
 *     dataDescription AI metadata, toJSON() / fromJSON() with a versioned
 *     $schema ("brock-ui/bar-chart/v1"), and renderToHTMLString().
 *
 * The axis inversion (what changed vs Column, per canon §13 pre-decisions):
 *
 *  - Categories on Y (top→bottom, input order), values on X. The zero
 *    baseline is a VERTICAL 1px line; positive bars grow RIGHT, negative
 *    bars grow LEFT — first-class, same single accent, never clamped.
 *  - Component height DERIVES from the item count: N * barThickness +
 *    (N-1) * gap. There is no `height` prop — the data decides. Optional
 *    `maxHeight` + scroll="auto" turn overflow into a VERTICAL scroll with
 *    the value axis pinned below (sticky value axis).
 *  - Category labels live in a LEFT label column with an explicit
 *    `labelWidth` (default 96px) and a CSS-only truncation policy decided
 *    BEFORE the first line of code (canon §11): ellipsis → full text in the
 *    tooltip + sr-table → container-query clamping (≤420px clamps the column
 *    to 64px; ≤240px hides it entirely). Labels render in Hack mono text-xs;
 *    values always in Hack tabular-nums.
 *  - Value (X) ticks render BELOW the bars area, value-positioned:
 *    [max, mid, 0] normally, [max, 0, min] with negatives.
 *  - dataLabels "auto" (DEFAULT, the thesis as a default): ≤ 8 bars → value
 *    labels at each bar's OUTER end (right of positives, left of negatives;
 *    bars deeper than 86% of the range flip the label INSIDE in background
 *    color) AND the X tick row hides. Explicit `xAxis.hideTicks` always wins.
 *  - Roving-tabindex arrows: ↑/↓ are the primary axis; ←/→ also work.
 *
 * Deliberate v1 scope cuts (canon §13 — column-specific, re-decided OUT):
 *
 *  - NO `trend` prop — trend is temporal semantics; a ranked categorical
 *    bar chart has no time axis to trend over.
 *  - NO `hatchUntilIndex` / `hatchFromIndex` — historical-vs-projected is a
 *    time concept. Per-datum `pattern: 'hatched'` stays (it is core).
 *  - NO `bands` — index-zone highlighting suits ordered time buckets
 *    ("Q3", "deployment window"), not rankings.
 *  - NO free-floating `annotations` in v1 — the per-datum `note` (rendered
 *    at the bar's end, beyond the value label) covers the ranking-callout
 *    use case without a second positioning API.
 *  - NO `minBarWidth` — bar thickness is an explicit prop here, so the
 *    WCAG 2.5.8 pointer-target check fires directly on `barThickness`.
 *
 * Accessibility:
 *  - Container: role="figure" with aria-labelledby
 *  - Bars: role="graphics-symbol", roving tabindex, Arrow/Home/End keyboard nav
 *  - Enter / Space on a focused bar invokes onBarClick
 *  - Hidden <table class="sr-only"> summary in display order, announcing
 *    sort/topN transformations and the "Other" aggregate
 *  - Loading: role="status" aria-live="polite" + aria-busy
 *  - Error:   role="alert"  aria-live="assertive"
 *  - forced-colors stylesheet (CanvasText bars, GrayText "Other")
 *  - prefers-reduced-motion honored across bar-grow + skeleton + spinner
 */

"use client";

import type {
  ComponentType,
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";
import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import {
  computeStat,
  copyImageToClipboard,
  downloadBlob,
  pointsToCSV,
  resolveTopNConfig,
  svgToPNG,
  synthesizeSVG,
  transformDataPoints,
  type ExportPoint,
  type SynthesisContext,
} from "./bar-chart-export";
import { ChartExportMenu } from "./chart-toolbar";

/** Fill pattern for a bar — solid accent fill, or hatched stripe pattern. */
export type BarChartPattern = "solid" | "hatched";

/**
 * Visual style of hatched fills at the chart level. Controls the *kind* of
 * stripe, while `pattern` controls whether a given bar uses any stripe at all.
 *
 *  - `diagonal`         — 45° stripes (default)
 *  - `diagonal-reverse` — −45° stripes (mirror)
 *  - `dots`             — radial-gradient dot grid (better for print/grayscale)
 *  - `vertical`         — 90° stripes
 *  - `horizontal`       — 0° stripes
 */
export type BarChartPatternStyle =
  | "diagonal"
  | "diagonal-reverse"
  | "dots"
  | "vertical"
  | "horizontal";

/** One data point in object form. Easier to map from DataFrames / SQL rows. */
export type BarChartDataPoint = {
  /** Category label rendered in the left label column (Hack mono). Optional. */
  label?: string;
  /**
   * Bar value (X axis). Negative values are first-class: bars grow LEFT from
   * an always-visible zero baseline (profit/loss, YoY change, anomalies — the
   * data-journalism staple). Silently distorting them would violate the
   * library's honesty thesis.
   */
  value: number;
  /**
   * Fill pattern override for this specific bar. When omitted, falls back to the
   * chart-level `pattern` prop (default "solid"). Use "hatched" to mark
   * estimated or in-progress values — Tufte-style encoding without spending
   * a second color.
   */
  pattern?: BarChartPattern;
  /**
   * Per-bar fill color override (any CSS color). Use sparingly — Tufte data-ink
   * discipline says one accent should rule. Reserve this for editorial cases:
   * a single anomaly, a "you are here" marker, the leader of the ranking.
   */
  color?: string;
  /**
   * Marks this bar as visually emphasized — a darker outline + slight brightness
   * boost. Combine with `note` for the classic "this one matters" annotation.
   */
  highlight?: boolean;
  /**
   * Short annotation rendered at the bar's outer end, beyond the value label,
   * in Hack mono (e.g. "← leader", "anomaly", "you"). Editorial / FT-style
   * markup that travels with the data, not with chart-level config. This is
   * the v1 ranking-callout surface (free-floating annotations are a deliberate
   * scope cut — see the file header).
   */
  note?: string;
  /**
   * Stable addressing key for this datum. Defaults to `label` (or the input
   * index for plain `number[]` data). Used by `focusBar(key)` and
   * `getSelection()`. Survives `sort` / `topN` because it travels with the
   * datum, unlike a display position.
   */
  key?: string;
  /**
   * Arbitrary consumer payload (e.g. the original DataFrame row / API object).
   * Passed through untouched and returned on every callback datum — wire
   * `onBarClick` to a detail panel without re-joining by label. Must be
   * JSON-safe if you plan to round-trip configs through `toJSON()`.
   */
  meta?: unknown;
  /**
   * OUTPUT-ONLY — set by the component on the synthetic "Other" bar created by
   * `topN`. Ignored on input. An aggregate is not a category: callbacks receive
   * this flag so consumers can branch ("open drill-down list" vs "open detail").
   */
  isOther?: boolean;
  /**
   * OUTPUT-ONLY — the collapsed tail behind the "Other" bar, in input order.
   * Present only when `isOther` is true. Ignored on input.
   */
  items?: readonly BarChartDataPoint[];
};

/**
 * Object form of `topN`. The number shorthand `topN={5}` is equivalent to
 * `topN={{ n: 5 }}` with all defaults.
 */
export type BarChartTopN = {
  /** Keep the N largest bars by value; the rest collapse into one "Other" bar. */
  n: number;
  /** Label for the aggregate bar. Default `"Other"`. */
  label?: string;
  /**
   * Keep the "Other" bar pinned at the end regardless of `sort`. Default `true` —
   * an aggregate standing mid-ranking reads as a category, which it is not.
   * Set `false` to let it participate in the sort by its summed value.
   */
  pinned?: boolean;
  /**
   * Render the "Other" bar in a muted fill (`--brock-other` token) so the
   * aggregate is visually distinct from real categories. Default `true` —
   * Tufte: an aggregate carries less ink. Hatching is NOT used here; that
   * encoding is reserved for estimated/in-progress semantics.
   */
  distinct?: boolean;
};

/**
 * Reference line drawn across the chart — a fixed threshold/goal, or a
 * computed statistic. The data-journalism workhorse: "40% above the mean".
 * On a horizontal bar chart this is a VERTICAL dashed line.
 */
export type BarChartReferenceLine = {
  /**
   * A fixed value, or `{ stat: "mean" | "median" }` to compute it from the
   * ORIGINAL input data (before `sort`/`topN` — bucketing must not move a
   * statistic). Included in the scale calculation on both sides so the line
   * stays visible.
   */
  value: number | { stat: "mean" | "median" };
  /**
   * Optional label (e.g. "Industry avg"). Stats auto-label as "Mean"/"Median"
   * when omitted. Rendered with the value in Hack mono in a chip at the top
   * of the line.
   */
  label?: string;
};

/* ─── Slot prop types ──────────────────────────────────────────────── */

/**
 * Props passed to a custom `slots.tooltip` component. Replaces the default
 * pixel-badge + Hack-mono tooltip anchored to the focused bar's row.
 * Position is already handled by the wrapper — the slot only needs to render
 * its content.
 */
export type BarChartTooltipSlotProps = {
  /** The bar this tooltip is for. */
  point: BarChartDataPoint;
  /** 0-based index within the data array. */
  index: number;
  /** Already-formatted value string (respects numberFormat / formatValue). */
  value: string;
  /** Category label, if the bar has one. */
  label?: string;
  /**
   * Which vertical edge the row sits on — "top" rows show the tooltip below
   * the row (so it never clips the figure top), the rest above.
   */
  edge: "top" | "middle" | "bottom";
};

/** Props passed to a custom `slots.empty` component. */
export type BarChartEmptySlotProps = {
  /**
   * Height the slot should occupy. Since the chart has no `height` prop,
   * this is the skeleton-equivalent derived height (7 ghost rows of
   * `barThickness` + `gap`).
   */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
};

/** Props passed to a custom `slots.loading` component. */
export type BarChartLoadingSlotProps = {
  /** Height the slot should occupy (derived — see BarChartEmptySlotProps). */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
  /** Localized "Loading…" label. */
  label: string;
};

/** Props passed to a custom `slots.error` component. */
export type BarChartErrorSlotProps = {
  /** Height the slot should occupy (derived — see BarChartEmptySlotProps). */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
  /** Localized "Error" label. */
  label: string;
  /** Normalized error message string. */
  message: string;
  /** The full normalized Error instance for richer rendering. */
  error: Error;
  /** Retry callback, if `onRetry` was passed to BarChart. */
  onRetry?: () => void;
  /** Localized "Retry" label. */
  retryLabel: string;
};

/**
 * Props passed to a custom `slots.toolbar` component. Replaces the default
 * top-right PNG/SVG/CSV/COPY chip bar. The custom toolbar gets bound actions
 * that fire the same export pipeline (so onExport callbacks still fire) plus
 * an `enabled` map matching the `exportable` prop so the slot can hide
 * actions the consumer disabled.
 */
export type BarChartToolbarSlotProps = {
  exportPNG: () => Promise<void>;
  exportSVG: () => void;
  exportCSV: () => void;
  copyImage: () => Promise<void>;
  enabled: { png: boolean; svg: boolean; csv: boolean; copy: boolean };
};

/**
 * Slot props passed to `slots.caption`. Rendered below the source line. No
 * props by default — the slot has full control over its content.
 */
export type BarChartCaptionSlotProps = Record<string, never>;

/**
 * Slot props for a `slots.watermark`. Rendered as an absolute-positioned
 * overlay over the chart figure (after the chart, before tooltip). Use for
 * subtle branding without competing with data ink.
 */
export type BarChartWatermarkSlotProps = Record<string, never>;

/**
 * The full slot dictionary. Every slot is optional; provide only the ones
 * you want to override. Defaults stay in place for the rest.
 */
export type BarChartSlots = {
  tooltip?: ComponentType<BarChartTooltipSlotProps>;
  empty?: ComponentType<BarChartEmptySlotProps>;
  loading?: ComponentType<BarChartLoadingSlotProps>;
  error?: ComponentType<BarChartErrorSlotProps>;
  toolbar?: ComponentType<BarChartToolbarSlotProps>;
  caption?: ComponentType<BarChartCaptionSlotProps>;
  watermark?: ComponentType<BarChartWatermarkSlotProps>;
};

export type BarChartProps = {
  /**
   * Bar data. Two forms accepted:
   *  - `number[]` — values only; pair with `labels` prop for category text
   *  - `BarChartDataPoint[]` — object form with `value` + optional `label`
   */
  data: readonly number[] | readonly BarChartDataPoint[];

  /** Category labels (only used when `data` is `number[]`). */
  labels?: readonly string[];

  /**
   * Height of each bar row in pixels. Default 24 — which is also exactly the
   * WCAG 2.5.8 pointer-target floor, so the default is click-safe. The total
   * chart height DERIVES from this: N * barThickness + (N-1) * gap. There is
   * deliberately no `height` prop — the data decides how tall the chart is
   * (canon §13 pre-decision).
   */
  barThickness?: number;

  /** Pixel gap between bar rows. Default 8. */
  gap?: number;

  /**
   * Cap on the bars-area height in pixels. When the derived content height
   * exceeds it AND `scroll="auto"`, the rows scroll vertically inside a
   * keyboard-focusable container while the value axis stays pinned below
   * (sticky value axis). Without `scroll="auto"` this prop has no effect —
   * the honest default is to show every category.
   */
  maxHeight?: number;

  /**
   * Width of the left category-label column in pixels. Default 96.
   *
   * The truncation policy is CSS-only (canon §11), decided up front:
   * labels truncate with an ellipsis at this width; the FULL text always
   * remains available in the hover tooltip and the sr-only data table.
   * In narrow containers the column clamps to 64px (≤420px) and hides
   * entirely (≤240px) via container queries — see the stylesheet below.
   */
  labelWidth?: number;

  /**
   * Reference line — a dashed VERTICAL line at a fixed value ("Quota")
   * or a computed statistic (`{ stat: "mean" }` / `{ stat: "median" }`,
   * calculated over the original input data). Included in the scale on both
   * sides so the line stays visible; its label chip renders at the top.
   */
  referenceLine?: BarChartReferenceLine;

  /** Source attribution rendered below the chart (FT/Bloomberg pattern). */
  source?: string;

  /**
   * Override the accent color (any CSS color or var). Defaults to `--brock-accent`
   * (Brock UI orange). Use for theming or playground / preview UIs.
   */
  accent?: string;

  /**
   * Bar outer-corner radius in pixels. Default 0 (sharp).
   * Baseline-side corners stay flat (bars are anchored to the zero line);
   * positive bars round their RIGHT corners, negative bars their LEFT.
   * Common values: 0 (sharp), 2 (subtle), 6 (rounded).
   */
  barRadius?: number;

  /**
   * Accessible description of the chart for screen readers.
   * Used as `aria-label` on the chart container and the visually-hidden
   * `<caption>` of the data table summary. Default: "Bar chart with N data points".
   */
  description?: string;

  /**
   * Custom formatter for value-axis (X) tick labels. Default uses
   * `toLocaleString`. Named for the axis the VALUES live on — the horizontal
   * mirror of Column Chart's `yAxisFormat` (canon §5 formatter signatures).
   */
  xAxisFormat?: (value: number) => string;

  /** Custom formatter for hover-tooltip value. Default uses `toLocaleString`. */
  formatValue?: (value: number, datum?: BarChartDataPoint) => string;

  /** Pass-through className for the outer wrapper. */
  className?: string;

  /**
   * Header rendered above the chart. Title in foreground, subtitle in muted.
   * Both optional — pass either, both, or omit `header` entirely.
   */
  header?: {
    title?: string;
    subtitle?: string;
  };

  /**
   * X-axis (VALUE axis) configuration.
   *
   * There is deliberately no `min`: a bar chart's baseline is always zero.
   * A truncated baseline turns bar length into a lie (the one thing the entire
   * canon — Tufte's lie factor, Datawrapper's hard rule — agrees on). For data
   * where deviation-from-a-baseline is the story, use a different chart shape.
   */
  xAxis?: {
    /** Title rendered centered below the X-axis tick labels. */
    title?: string;
    /**
     * Extend the max value beyond the data (headroom — e.g. to align scales
     * across a series of charts). EXTEND-ONLY: a value below the data max
     * would clip bars, so it is ignored with a dev warning.
     */
    max?: number;
    /**
     * Hide X-axis tick labels. Explicit values here always win over the
     * `dataLabels: "auto"` behavior (which hides ticks when direct labels
     * are shown).
     */
    hideTicks?: boolean;
  };

  /** Y-axis (CATEGORY axis) configuration. */
  yAxis?: {
    /** Title rendered rotated -90° to the left of the label column. */
    title?: string;
    /** Hide the category label column (default: show when labels exist). */
    hideTicks?: boolean;
  };

  /**
   * Number formatting applied to X-axis ticks, tooltip values, and inline data labels.
   * If both `numberFormat` and explicit `formatValue` / `xAxisFormat` are given,
   * the explicit ones win.
   */
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    /** Decimal places (default 0). */
    decimals?: number;
    /**
     * BCP-47 locale tag (e.g. "en-US", "ru-RU", "de-DE"). Controls thousand
     * and decimal separators. Defaults to the host locale.
     */
    locale?: string;
    /**
     * Number notation. `"compact"` shrinks long values ("1.2K", "1.5M") — ideal
     * for dense dashboards. Default `"standard"`.
     */
    notation?: "standard" | "compact" | "scientific" | "engineering";
    /** Numeric style — `"decimal"` (default), `"currency"`, or `"percent"`. */
    style?: "decimal" | "currency" | "percent";
    /** ISO 4217 currency code (e.g. "USD", "EUR"). Required when style="currency". */
    currency?: string;
  };

  /**
   * Inline value labels at each bar's OUTER end (Hack mono).
   *
   *  - `"auto"` (DEFAULT) — the editorial mode (Datawrapper/FT direct
   *    labeling): when the chart has ≤ 8 bars, labels are shown AND the
   *    X-axis ticks hide — the axis is redundant ink once every value is
   *    printed (Tufte; this default is the thesis made visible). An explicit
   *    `xAxis.hideTicks` always wins over the auto behavior.
   *  - `true` / `false` — always / never show.
   *
   * Labels sit to the RIGHT of positive bars and to the LEFT of negative
   * ones. Bars deeper than 86% of the range flip the label INSIDE the bar
   * in background color so it never clips the track edge.
   */
  dataLabels?: {
    show?: boolean | "auto";
    /** Optional override of the value formatter for these labels. */
    format?: (value: number, datum?: BarChartDataPoint) => string;
  };

  /** Animation configuration. */
  animation?: {
    /** Enable the staggered bar-grow animation on mount (default true). */
    enabled?: boolean;
    /** Per-bar animation duration in ms (default 400). */
    duration?: number;
  };

  /**
   * Default fill pattern for all bars. Per-point `pattern` on a data point wins
   * over this. Default "solid".
   *
   * Hatched bars use a diagonal stripe pattern at the accent color — ideal for
   * encoding *estimated vs actual* or *in-progress vs done* without spending
   * a second color (Tufte data-ink). Note: the positional hatch shortcuts
   * (`hatchUntilIndex` / `hatchFromIndex`) are Column-specific time concepts
   * and deliberately do NOT exist here (canon §13).
   */
  pattern?: BarChartPattern;

  /**
   * Visual style of hatched bars (chart-level). Per-bar `pattern: 'hatched'`
   * still controls *whether* a bar is hatched; this prop controls *how* every
   * hatched bar looks. Default `"diagonal"`.
   */
  patternStyle?: BarChartPatternStyle;

  /**
   * Overflow behavior when the derived content height exceeds `maxHeight`.
   *
   *  - `"none"` (default) — the chart is as tall as the data; no scrolling.
   *    The honest default: every category visible.
   *  - `"auto"` — the rows area is capped at `maxHeight` and scrolls
   *    VERTICALLY inside a keyboard-focusable container (tabIndex=0,
   *    role=group — WCAG 2.1.1). The X-axis tick row stays pinned below the
   *    scroll area so the value scale is always readable while you scroll
   *    through a long ranking.
   */
  scroll?: "none" | "auto";

  /**
   * Reorder bars by value before rendering.
   *
   *  - `"none"` (default) — preserve input / DataFrame order (top→bottom,
   *    categorical-as-given). The honest default.
   *  - `"asc"` / `"desc"` — sort by value. Turns the chart into a ranking
   *    (the natural reading of a horizontal bar chart — Datawrapper /
   *    Flourish "sorted bar" pattern; `desc` reads leader-first).
   *
   * Sorting is applied AFTER `topN` bucketing, so an "Other" bar participates
   * in the sort like any other bar (unless pinned). The sort is stable
   * (ties keep input order).
   */
  sort?: "none" | "asc" | "desc";

  /**
   * Keep only the N largest bars by value and roll the remainder into a single
   * "Other" bar (sum of the dropped values). The long-tail-compression pattern
   * from Datawrapper / editorial ranking charts. `n <= 0` or `n >= data.length`
   * is a no-op.
   *
   * The aggregate is NOT a category, and the defaults treat it honestly:
   * pinned last regardless of `sort`, rendered in a muted fill
   * (`--brock-other`), and carrying `isOther: true` + the collapsed `items`
   * in every callback payload. Number shorthand `topN={5}` = all defaults;
   * object form `topN={{ n, label, pinned, distinct }}` for control.
   */
  topN?: number | BarChartTopN;

  /**
   * Mark the chart as loading. Behavior depends on whether data is also present:
   *
   *  - `loading=true` + empty data → **full skeleton** (dashed horizontal
   *    ghost bars, pixel-font LOADING badge, ARIA `role="status"
   *    aria-live="polite"`). Use for initial fetch.
   *  - `loading=true` + populated data → **dim overlay** on top of the existing
   *    chart with a small corner spinner. Use for background refresh / polling.
   *  - `loading=false` (default) → rendered normally.
   *
   * Skeleton animation honors `prefers-reduced-motion`.
   */
  loading?: boolean;

  /**
   * Render the error state. Accepts an `Error` instance, a string message, or
   * any falsy value (treated as "no error"). When set, the error state replaces
   * the chart entirely — even if data is also present — because stale data next
   * to an error is misleading.
   *
   * Renders the ASCII warning pattern + the message + an optional retry button
   * (only when `onRetry` is also provided). ARIA `role="alert"` so screen
   * readers announce it immediately.
   */
  error?: Error | string | null;

  /**
   * Callback invoked when the user clicks the retry button inside the default
   * error state. The button is shown only when this callback is provided.
   */
  onRetry?: () => void;

  /**
   * Label rendered next to the LOADING pixel badge and used as the ARIA label
   * for the skeleton state. Default `"Loading…"`. Override for localization.
   */
  loadingLabel?: string;

  /**
   * Label rendered above the error message and used as the ARIA label for the
   * error state. Default `"Error"`. Override for localization.
   */
  errorLabel?: string;

  /**
   * Label of the retry button in the default error state. Default `"Retry"`.
   * Override for localization.
   */
  retryLabel?: string;

  /**
   * Full override of the default skeleton/loading UI. When provided, replaces
   * both the full skeleton (no-data case) and the overlay (with-data case).
   * Use this for a custom-branded loading experience.
   */
  loadingFallback?: ReactNode;

  /**
   * Full override of the default error UI. May be a React node or a function
   * that receives the normalized `Error` and returns a node.
   */
  errorFallback?: ReactNode | ((error: Error) => ReactNode);

  /**
   * Enable export and sharing. Three forms:
   *
   *  - `false` (default) — no toolbar, no exports. Imperative ref methods still
   *    work, but the user-facing UI is hidden.
   *  - `true` — show the toolbar with all four actions: PNG, SVG, CSV, Copy.
   *  - object form — show the toolbar with only the chosen actions.
   *
   * Even when `exportable=false`, the imperative ref API (`ref.current.exportPNG()`
   * etc.) is always available — so dashboards can wire their own export menus.
   */
  exportable?:
    | boolean
    | { png?: boolean; svg?: boolean; csv?: boolean; copy?: boolean };

  /**
   * Base file name for downloads. Pass a string for a fixed name, or a function
   * `(format) => string` for per-format control. The right extension (.png,
   * .svg, .csv) is appended automatically if missing.
   * Default `"chart"`.
   */
  exportFileName?: string | ((format: "png" | "svg" | "csv") => string);

  /**
   * Fired AFTER an export completes (download or copy). Receives the format
   * and the produced artifact: a `Blob` for png/copy, a `string` for svg/csv.
   * Useful for analytics or for piping exports into a custom share flow.
   */
  onExport?: (
    format: "png" | "svg" | "csv" | "copy",
    artifact: Blob | string,
  ) => void;

  /** Ref handle for imperative exports — see `BarChartHandle`. */
  ref?: Ref<BarChartHandle>;

  /**
   * Fired when the user clicks a bar (mouse, touch, or Enter/Space on a
   * focused bar). Receives the normalized data point, its 0-based index, and
   * the originating event.
   *
   * The callback is purely a notification — the chart does not change focus or
   * selection state. Combine with the imperative `focusBar(i)` method on the
   * ref if you want a controlled-selection pattern.
   */
  onBarClick?: (
    point: BarChartDataPoint,
    index: number,
    event:
      | ReactMouseEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>,
  ) => void;

  /**
   * Fired on mouse enter / leave of a bar. On `leave`, both `point` and
   * `index` are `null`. Useful for syncing custom legend / tooltip / detail
   * panels with the hovered datum.
   */
  onBarHover?: (
    point: BarChartDataPoint | null,
    index: number | null,
  ) => void;

  /**
   * Fired when keyboard focus moves between bars (arrow keys, Home/End, Tab
   * into chart). Tracks the roving-tabindex focus position. Use for "show
   * details for the focused bar" patterns in keyboard-only workflows.
   */
  onBarFocus?: (point: BarChartDataPoint, index: number) => void;

  /**
   * Slot dictionary for headless customization. Each slot replaces a specific
   * default sub-component:
   *
   *  - `tooltip`   — hover/focus tooltip anchored to the focused bar's row
   *  - `empty`     — replaces the ASCII empty state
   *  - `loading`   — replaces the dashed skeleton (no-data + loading case)
   *  - `error`     — replaces the ▲▲▲ error UI
   *  - `toolbar`   — replaces the PNG/SVG/CSV/COPY chip bar (slot receives
   *                  bound action handlers + an `enabled` map)
   *  - `caption`   — extra editorial caption rendered below the source line
   *  - `watermark` — absolute-positioned overlay over the figure (subtle
   *                  branding)
   *
   * Slots take precedence over the shortcut props (`loadingFallback`,
   * `errorFallback`) when both are set.
   */
  slots?: BarChartSlots;

  /**
   * Short editorial caption rendered below the source line. Italic, muted,
   * left-bordered — borrows the print-margin annotation pattern from FT /
   * Stripe Letters. Use for reading notes ("Self-reported figures"), context
   * ("Excludes inactive accounts"), or methodology ("Includes agent retries").
   *
   * `slots.caption` takes precedence and replaces the default rendering.
   */
  caption?: string;

  /**
   * Diagonal watermark text rendered as a faint overlay over the chart.
   * Default opacity is low (≈6%) so it never competes with data ink. Use
   * for "DRAFT", "CONFIDENTIAL" — a document-lifecycle marker, not branding.
   * Prints darker so it survives on paper.
   *
   * `slots.watermark` takes precedence and replaces the default rendering.
   */
  watermark?: string;

  /**
   * Machine-readable identifier for this chart type. Stamped onto the figure
   * as `data-chart-type` and included in `toJSON()` output. Default
   * `"bar"`. Useful for AI / LLM tooling that wants to reason about what
   * the chart represents — and for analytics that need a stable type tag.
   */
  chartType?: string;

  /**
   * Natural-language description of what the data represents. Different from
   * `description` (which auto-generates a count-based screen-reader label).
   * Stamped onto the figure as `data-description` and included in `toJSON()`
   * output. Use for AI prompts ("Revenue by region, FY2026, sorted") or for
   * editorial provenance.
   */
  dataDescription?: string;

  /**
   * Test selector hook. Forwarded to the outer `<figure>` as `data-testid`.
   * Convention from Testing Library / Playwright — keeps automation stable
   * across className refactors.
   */
  "data-testid"?: string;
};

/**
 * Imperative API exposed via `ref`. Always available — works even while the
 * chart is showing the loading/error/empty state, because the synthesis pulls
 * from the same props the React render uses.
 */
export type BarChartHandle = {
  /** Build and return a standalone SVG string. Optionally downloads it. */
  exportSVG: (options?: {
    fileName?: string;
    download?: boolean;
    width?: number;
    height?: number;
  }) => string;
  /** Rasterize the SVG to PNG via Canvas. Resolves to a Blob; optionally downloads. */
  exportPNG: (options?: {
    fileName?: string;
    download?: boolean;
    scale?: number;
    width?: number;
    height?: number;
  }) => Promise<Blob>;
  /** Serialize the bars to RFC-4180 CSV. Returns the string; optionally downloads. */
  exportCSV: (options?: { fileName?: string; download?: boolean }) => string;
  /** Build a PNG and write it to the system clipboard via the async Clipboard API. */
  copyImage: (options?: {
    scale?: number;
    width?: number;
    height?: number;
  }) => Promise<void>;
  /**
   * Move keyboard focus to a specific bar — by 0-based DISPLAY index (the
   * on-screen position; out-of-range clamps into the data range) or by stable
   * `key` (defaults to the datum's label; unknown keys return `-1` without
   * moving focus). Returns the display index that received focus, or `-1` if
   * no bars are rendered (loading/error/empty states).
   *
   * Use this for "drive focus from external UI" patterns — e.g. when the user
   * clicks an entry in a side panel, you want the corresponding bar to focus
   * so a screen reader announces it.
   */
  focusBar: (target: number | string) => number;
  /**
   * Return the currently keyboard-focused bar, or `null` if no bars are
   * rendered. `index` is the DISPLAY position (changes under sort/topN);
   * `key` is the stable datum identifier. Mirrors the internal
   * roving-tabindex position regardless of whether the chart has DOM focus.
   */
  getSelection: () => {
    point: BarChartDataPoint;
    index: number;
    key: string;
  } | null;
};

type NormalizedPoint = {
  label?: string;
  value: number;
  pattern: BarChartPattern;
  color?: string;
  highlight?: boolean;
  note?: string;
  /** Stable addressing key — datum.key ?? label ?? String(inputIndex). */
  key: string;
  /** Position in the ORIGINAL input array (pre sort/topN). -1 for "Other". */
  inputIndex: number;
  /** Consumer payload passed through untouched. */
  meta?: unknown;
  /** Set on the synthetic "Other" bar created by topN. */
  isOther?: boolean;
  /** Collapsed tail behind "Other", in input order (public shape). */
  items?: BarChartDataPoint[];
  /** "Other" with distinct=true renders in the muted --brock-other fill. */
  muted?: boolean;
};

/**
 * Strip the internal NormalizedPoint down to the public datum shape handed to
 * callbacks, exports, and the imperative API. Single source of truth — every
 * surface that exposes a datum goes through here.
 */
function toPublicPoint(p: NormalizedPoint): BarChartDataPoint {
  return {
    label: p.label,
    value: p.value,
    pattern: p.pattern,
    color: p.color,
    highlight: p.highlight,
    note: p.note,
    key: p.key,
    ...(p.meta !== undefined ? { meta: p.meta } : {}),
    ...(p.isOther ? { isOther: true, items: p.items } : {}),
  };
}

const defaultFormat = (v: number): string => v.toLocaleString();

/** Build a formatter from a numberFormat config object. */
function makeFormatter(config?: {
  prefix?: string;
  suffix?: string;
  decimals?: number;
  locale?: string;
  notation?: "standard" | "compact" | "scientific" | "engineering";
  style?: "decimal" | "currency" | "percent";
  currency?: string;
}): (v: number) => string {
  if (!config) return defaultFormat;
  const {
    prefix = "",
    suffix = "",
    decimals,
    locale,
    notation = "standard",
    style = "decimal",
    currency,
  } = config;

  const options: Intl.NumberFormatOptions = {
    notation,
    style,
    ...(style === "currency" && currency ? { currency } : {}),
    ...(decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {}),
  };

  return (v: number) => {
    // Sign placement: a prefixed format must read −$28k, not $-28k. Format
    // the magnitude and re-attach a typographic minus (U+2212) up front.
    if (prefix && v < 0) {
      return `−${prefix}${Math.abs(v).toLocaleString(locale, options)}${suffix}`;
    }
    return `${prefix}${v.toLocaleString(locale, options)}${suffix}`;
  };
}

function isObjectForm(
  data: readonly number[] | readonly BarChartDataPoint[],
): data is readonly BarChartDataPoint[] {
  return data.length > 0 && typeof data[0] === "object" && data[0] !== null;
}

function normalize(
  data: readonly number[] | readonly BarChartDataPoint[],
  labels: readonly string[] | undefined,
  defaultPattern: BarChartPattern,
  sort: "none" | "asc" | "desc",
  topN: number | BarChartTopN | undefined,
): { points: NormalizedPoint[]; inputValues: number[] } {
  const raw: NormalizedPoint[] = isObjectForm(data)
    ? data.map((d, i) => ({
        label: d.label,
        value: d.value,
        pattern: d.pattern ?? defaultPattern,
        color: d.color,
        highlight: d.highlight,
        note: d.note,
        meta: d.meta,
        key: d.key ?? d.label ?? String(i),
        inputIndex: i,
      }))
    : (data as readonly number[]).map((value, i) => ({
        label: labels?.[i],
        value,
        pattern: defaultPattern,
        key: labels?.[i] ?? String(i),
        inputIndex: i,
      }));

  let invalidCount = 0;

  const cleaned: NormalizedPoint[] = [];
  for (const point of raw) {
    if (
      typeof point.value !== "number" ||
      Number.isNaN(point.value) ||
      !Number.isFinite(point.value)
    ) {
      invalidCount += 1;
      continue;
    }
    cleaned.push(point);
  }

  if (process.env.NODE_ENV !== "production" && invalidCount > 0) {
    console.warn(
      `[brock-ui] BarChart: skipped ${invalidCount} non-finite value(s) (NaN/Infinity).`,
    );
  }

  // Duplicate keys break string addressing (focusBar matches the FIRST hit) —
  // warn so the consumer can set explicit `key`s.
  if (process.env.NODE_ENV !== "production") {
    const seen = new Set<string>();
    for (const p of cleaned) {
      const k = p.key.toLowerCase();
      if (seen.has(k)) {
        console.warn(
          `[brock-ui] BarChart: duplicate key "${p.key}". String addressing (focusBar) matches the first occurrence — set an explicit \`key\` on each datum to disambiguate.`,
        );
        break;
      }
      seen.add(k);
    }
  }

  // Long-tail compression first, then ranking — via the SAME shared transform
  // the static render path uses (no fidelity drift, canon §4). The "Other"
  // aggregate is pinned last by default; with pinned=false it ranks by its
  // summed value.
  const points = transformDataPoints(
    cleaned,
    sort,
    resolveTopNConfig(topN),
    (sum, collapsed, config): NormalizedPoint => ({
      label: config.label,
      value: sum,
      pattern: defaultPattern,
      key: config.label,
      inputIndex: -1,
      isOther: true,
      items: collapsed.map(toPublicPoint),
      muted: config.distinct,
    }),
  );
  return { points, inputValues: cleaned.map((p) => p.value) };
}

/**
 * Auto-generated accessible description following the Amy Cesal alt-text
 * formula: chart type + data + what it shows. Insight (highest/lowest) is
 * computed over the DISPLAYED points so screen-reader users get the same
 * picture as sighted ones.
 */
function autoDescription(
  points: NormalizedPoint[],
  source: string | undefined,
  formatValue: (v: number, d?: BarChartDataPoint) => string,
): string {
  const base = `Bar chart with ${points.length} data point${
    points.length === 1 ? "" : "s"
  }`;
  let insight = "";
  if (points.length > 1) {
    const highest = points.reduce((a, b) => (b.value > a.value ? b : a));
    const lowest = points.reduce((a, b) => (b.value < a.value ? b : a));
    if (highest.value !== lowest.value) {
      const name = (pt: NormalizedPoint) => pt.label ?? pt.key;
      insight = `. Highest: ${name(highest)} (${formatValue(
        highest.value,
        toPublicPoint(highest),
      )}); lowest: ${name(lowest)} (${formatValue(
        lowest.value,
        toPublicPoint(lowest),
      )})`;
    }
  }
  return `${base}${insight}${source ? `. Source: ${source}.` : "."}`;
}

export function BarChart({
  data,
  labels,
  barThickness = 24,
  gap = 8,
  maxHeight,
  labelWidth = 96,
  referenceLine,
  source,
  accent,
  barRadius = 0,
  description,
  xAxisFormat,
  formatValue,
  className,
  header,
  xAxis,
  yAxis,
  numberFormat,
  dataLabels,
  animation,
  pattern = "solid",
  patternStyle = "diagonal",
  scroll = "none",
  sort = "none",
  topN,
  loading = false,
  error,
  onRetry,
  loadingLabel = "Loading…",
  errorLabel = "Error",
  retryLabel = "Retry",
  loadingFallback,
  errorFallback,
  exportable = false,
  exportFileName = "chart",
  onExport,
  ref,
  onBarClick,
  onBarHover,
  onBarFocus,
  slots,
  caption,
  watermark,
  chartType = "bar",
  dataDescription,
  "data-testid": dataTestId,
}: BarChartProps) {
  const { points, inputValues } = normalize(data, labels, pattern, sort, topN);
  // Resolve the reference line to a number once: stats are computed over the
  // ORIGINAL input values (pre sort/topN), and auto-label as Mean/Median.
  const resolvedReference = referenceLine
    ? {
        value:
          typeof referenceLine.value === "number"
            ? referenceLine.value
            : computeStat(inputValues, referenceLine.value.stat),
        label:
          referenceLine.label ??
          (typeof referenceLine.value === "object"
            ? referenceLine.value.stat === "mean"
              ? "Mean"
              : "Median"
            : undefined),
      }
    : undefined;
  const captionId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [focusIndex, setFocusIndexState] = useState(0);
  // Ref mirror of focusIndex so the imperative `getSelection` / `focusBar`
  // can read the latest value synchronously, before React flushes state.
  const focusIndexRef = useRef(0);
  const setFocusIndex = (i: number) => {
    focusIndexRef.current = i;
    setFocusIndexState(i);
  };

  // Snap focus into the data range if data shrank/grew under us.
  if (points.length > 0 && focusIndex >= points.length) {
    setFocusIndex(points.length - 1);
  }

  // Dev-only diagnostic: bars are pointer targets when onBarClick is wired,
  // and WCAG 2.5.8 (Target Size Minimum) wants >= 24px. Unlike Column Chart
  // (where bar width is layout-derived and must be measured), the pointer
  // dimension here IS the `barThickness` prop — so the check is direct. The
  // default (24) passes by construction; we warn the consumer who shrank it.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !onBarClick) return;
    if (barThickness < 24) {
      console.warn(
        `[brock-ui] BarChart: barThickness is ${barThickness}px and onBarClick is wired — pointer targets under 24px fail WCAG 2.5.8 (Target Size Minimum). Consider barThickness={24} or larger. Keyboard access is unaffected.`,
      );
    }
  }, [barThickness, onBarClick]);

  // Number formatting cascade: explicit overrides > numberFormat > default
  const baseFormatter = makeFormatter(numberFormat);
  const effectiveFormatValue = formatValue ?? baseFormatter;
  const effectiveXAxisFormat = xAxisFormat ?? baseFormatter;
  const effectiveLabelFormat = dataLabels?.format ?? effectiveFormatValue;

  // ─── Derived values (lifted above the state machine so the imperative
  //     export API can synthesize an SVG even from loading/error/empty). ───
  const dataMax = points.reduce((m, p) => Math.max(m, p.value), 0);
  const dataMin = points.reduce((m, p) => Math.min(m, p.value), 0);
  // The reference line participates in the scale on BOTH sides so it always
  // stays visible — a positive ref extends the right, a negative one the left.
  const refValue =
    resolvedReference && Number.isFinite(resolvedReference.value)
      ? resolvedReference.value
      : undefined;
  const refBased =
    refValue !== undefined && refValue > 0
      ? Math.max(dataMax, refValue)
      : dataMax;
  // xAxis.max is extend-only: a max below the data would clip bars (the
  // truncated-bar lie). Ignore + warn instead of silently distorting.
  const max =
    xAxis?.max !== undefined ? Math.max(xAxis.max, refBased) : refBased;
  if (
    process.env.NODE_ENV !== "production" &&
    xAxis?.max !== undefined &&
    xAxis.max < refBased
  ) {
    console.warn(
      `[brock-ui] BarChart: xAxis.max (${xAxis.max}) is below the data/reference max (${refBased}) and was ignored — a clipped baseline-zero chart would distort bar lengths. xAxis.max can only extend the scale.`,
    );
  }
  const min =
    refValue !== undefined && refValue < 0
      ? Math.min(dataMin, refValue)
      : dataMin;
  const allZero = max === 0 && min === 0;
  // Tufte-sparse ticks: [max, mid, 0] normally; [max, 0, min] with negatives
  // (the 0-tick then sits exactly on the baseline). Value-positioned below
  // the bars area: 0 lands on the left edge for all-positive data.
  const xTicks = allZero
    ? [0]
    : min < 0
      ? [max, 0, min]
      : [max, Math.round(max / 2), 0];
  // dataLabels "auto" — the editorial mode: direct labels for small N, and the
  // X (value) axis hides (redundant ink once every value is printed). An
  // explicit xAxis.hideTicks always wins.
  // "auto" is the DEFAULT — direct labeling is the thesis made visible.
  const labelsMode = dataLabels?.show ?? "auto";
  const autoLabels = labelsMode === "auto";
  const showLabels =
    labelsMode === true ||
    (autoLabels && points.length > 0 && points.length <= 8);
  const showXTicks =
    xAxis?.hideTicks !== undefined
      ? !xAxis.hideTicks
      : !(autoLabels && showLabels);
  // Category labels: shown when any datum has one and yAxis.hideTicks is off.
  // The full text always survives in the tooltip + sr-table (canon §11).
  const hasAnyLabel = points.some((p) => p.label !== undefined);
  const showCategoryLabels = hasAnyLabel && !yAxis?.hideTicks;
  const accessibleDescription =
    description ?? autoDescription(points, source, effectiveFormatValue);
  // Screen-reader note about local data transformations — a blind user must
  // not get a silently different picture than a sighted one (sorting and
  // bucketing change what the chart claims).
  const otherPoint = points.find((pt) => pt.isOther);
  const transformNote = [
    sort !== "none"
      ? `Sorted by value, ${sort === "asc" ? "ascending" : "descending"}.`
      : "",
    otherPoint
      ? `${otherPoint.items?.length ?? 0} categories combined into "${otherPoint.label}".`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Height DERIVES from the item count — the canon §13 pre-decision. This is
  // the bars-area height; header/axis/source add their own natural flow height.
  const contentHeight =
    points.length > 0
      ? points.length * barThickness + (points.length - 1) * gap
      : 0;
  // States (skeleton/empty/error) have no data to derive from — use the
  // skeleton's own footprint (7 ghost rows) so all three states line up.
  const stateHeight = 7 * barThickness + 6 * gap;

  // ─── Single context-builder reused by the imperative API AND the Toolbar.
  //     Captures the current render's props/derived values; both call sites
  //     get exactly what's on screen at click time. ───
  const getExportContext = (width: number, height: number): SynthesisContext => {
    // Resolve CSS-var-driven theme colors at the figure (or document fallback)
    // so the SVG/PNG embeds resolved hex/rgb — no CSS vars leak into the
    // exported file. Falls back to safe defaults if running outside a browser.
    const resolve = (varName: string, fallback: string): string => {
      if (typeof window === "undefined") return fallback;
      const root = figureRef.current ?? document.documentElement;
      const v = getComputedStyle(root).getPropertyValue(varName).trim();
      return v || fallback;
    };
    const resolvedAccent = accent ?? resolve("--brock-accent", "#F54900");
    // The muted "Other" fill resolves to a concrete color at export time so
    // the SVG/PNG reproduces the aggregate's visual distinction.
    const otherFill = points.some((p) => p.muted)
      ? resolve("--brock-other", "#a1a1aa")
      : undefined;
    const exportPoints: ExportPoint[] = points.map((p) => ({
      label: p.label,
      value: p.value,
      pattern: p.pattern,
      color: p.muted ? (p.color ?? otherFill) : p.color,
      highlight: p.highlight,
      note: p.note,
      key: p.key,
      inputIndex: p.inputIndex,
    }));
    return {
      width,
      height,
      points: exportPoints,
      max,
      min,
      allZero,
      gap,
      barRadius,
      patternStyle,
      labelWidth,
      accent: resolvedAccent,
      foreground: resolve("--foreground", "#0a0a0a"),
      muted: resolve("--muted-foreground", "#666666"),
      border: resolve("--border", "#e5e5e5"),
      background: resolve("--background", "#ffffff"),
      xTicks,
      xAxisFormat: effectiveXAxisFormat,
      formatValue: effectiveFormatValue,
      labelFormat: effectiveLabelFormat,
      showLabels,
      showXTicks,
      showCategoryLabels,
      xAxisTitle: xAxis?.title,
      yAxisTitle: yAxis?.title,
      headerTitle: header?.title,
      headerSubtitle: header?.subtitle,
      referenceLine: resolvedReference,
      source,
      caption,
      watermark,
      description: accessibleDescription,
    };
  };

  /**
   * Use figure-rect when available; fall back to 800 × derived for export-only
   * flows. Unlike Column (fixed 400 fallback), the height fallback derives
   * from the item count — same rule the live render lives by.
   */
  const getExportDimensions = (
    opts?: { width?: number; height?: number },
  ): { width: number; height: number } => {
    const live = figureRef.current?.getBoundingClientRect();
    const w = opts?.width ?? (live && live.width > 0 ? live.width : 800);
    const derived = Math.max(200, contentHeight + 140);
    const h = opts?.height ?? (live && live.height > 0 ? live.height : derived);
    return { width: Math.round(w), height: Math.round(h) };
  };

  /** Resolve the right file name for a format, with extension fix-up. */
  const resolveDownloadName = (
    format: "png" | "svg" | "csv",
    override?: string,
  ): string => {
    if (override) return ensureExt(override, format);
    const base =
      typeof exportFileName === "function"
        ? exportFileName(format)
        : exportFileName;
    return ensureExt(base, format);
  };

  // ─── Imperative export API ───
  useImperativeHandle(
    ref,
    () => ({
      exportSVG: (opts) => {
        const { width, height: hgt } = getExportDimensions(opts);
        const svg = synthesizeSVG(getExportContext(width, hgt));
        if (opts?.download !== false) {
          const blob = new Blob([svg], { type: "image/svg+xml" });
          downloadBlob(blob, resolveDownloadName("svg", opts?.fileName));
        }
        onExport?.("svg", svg);
        return svg;
      },
      exportPNG: async (opts) => {
        const { width, height: hgt } = getExportDimensions(opts);
        const ctx = getExportContext(width, hgt);
        const svg = synthesizeSVG(ctx);
        const blob = await svgToPNG(svg, opts?.scale ?? 2, ctx.background);
        if (opts?.download !== false) {
          downloadBlob(blob, resolveDownloadName("png", opts?.fileName));
        }
        onExport?.("png", blob);
        return blob;
      },
      exportCSV: (opts) => {
        const csv = pointsToCSV(
          points.map((p) => ({ ...toPublicPoint(p), pattern: p.pattern })),
        );
        if (opts?.download !== false) {
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          downloadBlob(blob, resolveDownloadName("csv", opts?.fileName));
        }
        onExport?.("csv", csv);
        return csv;
      },
      copyImage: async (opts) => {
        const { width, height: hgt } = getExportDimensions(opts);
        const ctx = getExportContext(width, hgt);
        const svg = synthesizeSVG(ctx);
        const blob = await svgToPNG(svg, opts?.scale ?? 2, ctx.background);
        await copyImageToClipboard(blob);
        onExport?.("copy", blob);
      },
      focusBar: (target) => {
        if (points.length === 0) return -1;
        let clamped: number;
        if (typeof target === "string") {
          const t = target.toLowerCase();
          clamped = points.findIndex((p) => p.key.toLowerCase() === t);
          if (clamped === -1) return -1; // unknown key — don't move focus
        } else {
          clamped = Math.max(0, Math.min(points.length - 1, target));
        }
        setFocusIndex(clamped);
        // Defer DOM focus so the post-render barRefs map is up to date.
        if (typeof window !== "undefined") {
          requestAnimationFrame(() => {
            barRefs.current[clamped]?.focus();
          });
        }
        onBarFocus?.(toPublicPoint(points[clamped]), clamped);
        return clamped;
      },
      getSelection: () => {
        if (points.length === 0) return null;
        const i = Math.max(
          0,
          Math.min(points.length - 1, focusIndexRef.current),
        );
        return { index: i, key: points[i].key, point: toPublicPoint(points[i]) };
      },
    }),
    // Closure captures the latest props/derived values on every render —
    // intentional, so exports always reflect the current chart state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accent,
      barRadius,
      barThickness,
      gap,
      labelWidth,
      dataLabels?.show,
      effectiveFormatValue,
      effectiveLabelFormat,
      effectiveXAxisFormat,
      exportFileName,
      header?.subtitle,
      header?.title,
      max,
      min,
      allZero,
      resolvedReference,
      onExport,
      patternStyle,
      points,
      source,
      xAxis?.hideTicks,
      xAxis?.title,
      yAxis?.hideTicks,
      yAxis?.title,
      xTicks,
      accessibleDescription,
      // focus/event refresh — keeps getSelection() / focusBar() reading fresh state
      focusIndex,
      onBarFocus,
      // editorial layers — must refresh export snapshot when these change
      caption,
      watermark,
    ],
  );

  // ─── State machine priority (canon §6) ───
  // 1. error → terminal, replaces the chart (stale data next to an error
  //    message is misleading).
  // 2. loading + no data → full skeleton (initial fetch).
  // 3. data empty → existing empty state.
  // 4. data ready + loading → render the chart with a refresh overlay.
  // 5. data ready, not loading → normal chart.
  const normalizedError = toError(error);
  if (normalizedError) {
    // Slot wins over shortcut fallback wins over default.
    if (slots?.error) {
      const ErrSlot = slots.error;
      return (
        <>
          <ErrSlot
            height={stateHeight}
            source={source}
            label={errorLabel}
            message={normalizedError.message}
            error={normalizedError}
            onRetry={onRetry}
            retryLabel={retryLabel}
          />
          <HBarAnimationStyles />
        </>
      );
    }
    if (errorFallback !== undefined) {
      return (
        <>
          {typeof errorFallback === "function"
            ? errorFallback(normalizedError)
            : errorFallback}
        </>
      );
    }
    return (
      <>
        <ErrorState
          height={stateHeight}
          source={source}
          label={errorLabel}
          message={normalizedError.message}
          onRetry={onRetry}
          retryLabel={retryLabel}
          className={className}
        />
        <HBarAnimationStyles />
      </>
    );
  }

  if (loading && points.length === 0) {
    if (slots?.loading) {
      const LoadingSlot = slots.loading;
      return (
        <>
          <LoadingSlot
            height={stateHeight}
            source={source}
            label={loadingLabel}
          />
          <HBarAnimationStyles />
        </>
      );
    }
    if (loadingFallback !== undefined) {
      return <>{loadingFallback}</>;
    }
    return (
      <>
        <LoadingState
          barThickness={barThickness}
          gap={gap}
          source={source}
          label={loadingLabel}
          className={className}
        />
        <HBarAnimationStyles />
      </>
    );
  }

  if (points.length === 0) {
    if (slots?.empty) {
      const EmptySlot = slots.empty;
      return (
        <>
          <EmptySlot height={stateHeight} source={source} />
          <HBarAnimationStyles />
        </>
      );
    }
    return (
      <>
        <EmptyState height={stateHeight} source={source} className={className} />
        <HBarAnimationStyles />
      </>
    );
  }

  const figureStyle = {
    ...(accent ? { "--brock-accent": accent } : {}),
    ...(animation?.duration !== undefined
      ? { "--brock-hbar-duration": `${animation.duration}ms` }
      : {}),
    // The label column width travels as a CSS variable (not an inline width
    // on the cells) so the container queries below can clamp/hide the column
    // in narrow containers — inline styles would win over @container rules.
    "--brock-hbar-label-width": `${showCategoryLabels ? labelWidth : 0}px`,
  } as CSSProperties;
  const animationEnabled = animation?.enabled !== false;

  const hasCategoryTitle = !!yAxis?.title;

  const toolbarConfig = resolveToolbar(exportable);
  const runPNG = async () => {
    const { width, height: hgt } = getExportDimensions();
    const ctx = getExportContext(width, hgt);
    const svg = synthesizeSVG(ctx);
    const blob = await svgToPNG(svg, 2, ctx.background);
    downloadBlob(blob, resolveDownloadName("png"));
    onExport?.("png", blob);
  };
  const runSVG = () => {
    const { width, height: hgt } = getExportDimensions();
    const svg = synthesizeSVG(getExportContext(width, hgt));
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadBlob(blob, resolveDownloadName("svg"));
    onExport?.("svg", svg);
  };
  const runCSV = () => {
    const csv = pointsToCSV(
      points.map((p) => ({
        label: p.label,
        value: p.value,
        pattern: p.pattern,
        color: p.color,
        highlight: p.highlight,
        note: p.note,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, resolveDownloadName("csv"));
    onExport?.("csv", csv);
  };
  const runCopy = async () => {
    const { width, height: hgt } = getExportDimensions();
    const ctx = getExportContext(width, hgt);
    const svg = synthesizeSVG(ctx);
    const blob = await svgToPNG(svg, 2, ctx.background);
    await copyImageToClipboard(blob);
    onExport?.("copy", blob);
  };

  return (
    <figure
      ref={figureRef}
      className={`brock-hbars-figure relative ${className ?? ""}`}
      style={{ ...figureStyle, containerType: "inline-size" }}
      role="figure"
      aria-labelledby={captionId}
      aria-busy={loading || undefined}
      data-chart-type={chartType}
      data-description={dataDescription || undefined}
      data-testid={dataTestId}
    >
      {toolbarConfig &&
        (slots?.toolbar ? (
          (() => {
            const ToolbarSlot = slots.toolbar;
            return (
              <ToolbarSlot
                exportPNG={runPNG}
                exportSVG={runSVG}
                exportCSV={runCSV}
                copyImage={runCopy}
                enabled={toolbarConfig}
              />
            );
          })()
        ) : (
          <ChartExportMenu
            config={toolbarConfig}
            onPNG={runPNG}
            onSVG={runSVG}
            onCSV={runCSV}
            onCopy={runCopy}
          />
        ))}
      {slots?.watermark
        ? (() => {
            const WatermarkSlot = slots.watermark;
            return (
              <div className="pointer-events-none absolute inset-0 z-10">
                <WatermarkSlot />
              </div>
            );
          })()
        : watermark
          ? <Watermark text={watermark} />
          : null}
      {loading && <LoadingOverlay label={loadingLabel} />}
      {(header?.title || header?.subtitle) && (
        <Header title={header.title} subtitle={header.subtitle} />
      )}

      <div className="flex">
        {hasCategoryTitle && <CategoryAxisTitle title={yAxis!.title!} />}

        <ScrollableRowsArea scroll={scroll} maxHeight={maxHeight}>
          {/* The bars-area height derives from the data — N rows of
              barThickness plus the gaps. No height prop exists (canon §13). */}
          <div className="brock-hbar-rows flex flex-1" style={{ height: contentHeight }}>
            {showCategoryLabels && (
              <LabelColumn
                points={points}
                gap={gap}
                barThickness={barThickness}
              />
            )}
            <BarsGroup
              points={points}
              max={max}
              min={min}
              allZero={allZero}
              gap={gap}
              barThickness={barThickness}
              formatValue={effectiveFormatValue}
              ariaLabel={accessibleDescription}
              referenceLine={resolvedReference}
              barRadius={barRadius}
              animationEnabled={animationEnabled}
              showLabels={showLabels}
              labelFormat={effectiveLabelFormat}
              patternStyle={patternStyle}
              focusIndex={focusIndex}
              setFocusIndex={setFocusIndex}
              barRefs={barRefs}
              onBarClick={onBarClick}
              onBarHover={onBarHover}
              onBarFocus={onBarFocus}
              tooltipSlot={slots?.tooltip}
            />
          </div>
        </ScrollableRowsArea>
      </div>

      {/* The X (value) tick row stays OUTSIDE the scroll area — the sticky
          value axis from the canon §13 pre-decisions: scrolling a long
          ranking never scrolls the scale away. */}
      {showXTicks && (
        <div className="flex">
          {hasCategoryTitle && <div className="w-6 shrink-0" aria-hidden />}
          <div className="brock-hbar-xaxis-pad min-w-0 flex-1">
            <XAxisTicks
              ticks={xTicks}
              max={max}
              min={min}
              format={effectiveXAxisFormat}
            />
          </div>
        </div>
      )}

      {xAxis?.title && (
        <div className="flex">
          {hasCategoryTitle && <div className="w-6 shrink-0" aria-hidden />}
          <div className="brock-hbar-xaxis-pad min-w-0 flex-1">
            <div className="mt-2 text-center font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
              {xAxis.title}
            </div>
          </div>
        </div>
      )}

      {source && <ChartSource source={source} />}

      {slots?.caption
        ? (() => {
            const CaptionSlot = slots.caption;
            return <CaptionSlot />;
          })()
        : caption
          ? <Caption text={caption} />
          : null}

      <figcaption id={captionId} className="sr-only">
        {accessibleDescription}
      </figcaption>

      <DataTableSummary
        points={points}
        formatValue={effectiveFormatValue}
        transformNote={transformNote}
      />

      <HBarAnimationStyles />
    </figure>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function EmptyState({
  height,
  source,
  className,
}: {
  height: number;
  source?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className="flex flex-col items-center justify-center gap-2 border-s border-b border-border"
        style={{ height }}
        role="img"
        aria-label="No data available for this period"
      >
        <EmptyChartIcon className="h-7 w-7 text-muted-foreground/40" />
        <span className="font-sans text-sm text-muted-foreground">
          No data for this period
        </span>
      </div>
      {source && <ChartSource source={source} />}
    </div>
  );
}

/* ─── State icons (neutral line icons; swap for Iconly when supplied) ──── */

function EmptyChartIcon({ className }: { className?: string }) {
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
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <rect x="7" y="13" width="3" height="4" rx="0.5" />
      <rect x="12.5" y="9" width="3" height="8" rx="0.5" />
      <rect x="18" y="11" width="3" height="6" rx="0.5" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={`brock-spinner ${className ?? ""}`}
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * LoadingState — full skeleton used when `loading=true` and there is no data.
 *
 * Visual: a stack of dashed HORIZONTAL ghost bars at varying widths (Tufte
 * "in-progress" dashed pattern, see Brock UI design thesis) anchored to a
 * left baseline + a pixel-font LOADING badge in the top-right corner. The
 * ghost rows use the same barThickness/gap the real chart would, so the
 * skeleton's footprint matches the ready state for typical data. Honors
 * `prefers-reduced-motion` via the `.brock-hbar-skeleton` class.
 *
 * A11y: `role="status"` + `aria-live="polite"` + `aria-label` from
 * `loadingLabel` prop so screen readers announce the change without
 * interrupting the user.
 */
function LoadingState({
  barThickness,
  gap,
  source,
  label,
  className,
}: {
  barThickness: number;
  gap: number;
  source?: string;
  label: string;
  className?: string;
}) {
  // Deterministic ghost-bar widths — a stable pattern so the skeleton
  // doesn't visually thrash across re-renders. 7 rows ≈ a typical ranking.
  const ghostWidths = [40, 65, 50, 80, 55, 95, 70];
  return (
    <div className={className}>
      <div
        className="relative flex flex-col items-start border-s border-border"
        style={{ gap }}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        {ghostWidths.map((w, i) => (
          <div
            key={i}
            className="brock-hbar-skeleton"
            style={
              {
                width: `${w}%`,
                height: barThickness,
                animationDelay: `${i * 80}ms`,
              } as CSSProperties
            }
            aria-hidden
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
      {source && <ChartSource source={source} />}
    </div>
  );
}

/**
 * ErrorState — terminal state. Replaces the chart even when data is present:
 * showing stale data next to an error message is misleading.
 *
 * Visual: ASCII warning pattern in Departure Mono (consistent with the empty
 * state's visual language, swapped glyph), pixel ERROR badge, the error message
 * in body text, and an optional retry button (only when `onRetry` is given).
 *
 * A11y: `role="alert"` + `aria-live="assertive"` so screen readers interrupt
 * and announce the error immediately.
 */
function ErrorState({
  height,
  source,
  label,
  message,
  onRetry,
  retryLabel,
  className,
}: {
  height: number;
  source?: string;
  label: string;
  message: string;
  onRetry?: () => void;
  retryLabel: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className="flex flex-col items-center justify-center gap-2 border-s border-b border-border px-4 text-center"
        style={{ height }}
        role="alert"
        aria-live="assertive"
        aria-label={`${label}: ${message}`}
      >
        <WarningIcon className="h-7 w-7 text-muted-foreground/50" />
        <div className="sr-only">{label}</div>
        <div className="max-w-md font-sans text-sm text-foreground">
          {message}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 cursor-pointer rounded-md border border-border bg-muted/40 px-3 py-1 font-sans text-xs text-foreground transition-colors hover:bg-muted"
            type="button"
          >
            {retryLabel}
          </button>
        )}
      </div>
      {source && <ChartSource source={source} />}
    </div>
  );
}

/**
 * LoadingOverlay — used when `loading=true` AND data is also present. Renders
 * a dim layer + a small corner spinner on top of the live chart, so the user
 * keeps seeing yesterday's data while today's reload runs.
 *
 * A11y: the underlying chart keeps its own `role`/labels; the overlay marks
 * the busy state via `aria-busy` on the surrounding figure (set by the parent),
 * and the spinner span carries a polite live region. NEVER put aria-hidden on
 * an ancestor of this live region (canon §6).
 */
function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="brock-hbar-overlay pointer-events-none absolute inset-0 z-20 flex items-start justify-end p-2">
      <span
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-muted-foreground shadow-sm"
        role="status"
        aria-live="polite"
      >
        <Spinner className="h-3.5 w-3.5" />
        <span className="sr-only">{label}</span>
      </span>
    </div>
  );
}

/** Normalize an error prop (Error | string | null) into a stable `Error`. */
function toError(input: Error | string | null | undefined): Error | null {
  if (!input) return null;
  if (input instanceof Error) return input;
  return new Error(String(input));
}

/** Append the right extension to a download file name if missing. */
function ensureExt(name: string, format: "png" | "svg" | "csv"): string {
  return name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
}

type ToolbarConfig = {
  png: boolean;
  svg: boolean;
  csv: boolean;
  copy: boolean;
};

/**
 * Resolve the `exportable` prop into a concrete on/off config per action.
 * Returns `null` when no actions should be shown (so the toolbar is omitted
 * entirely — no extra DOM, no a11y noise).
 */
function resolveToolbar(
  input: boolean | Partial<ToolbarConfig> | undefined,
): ToolbarConfig | null {
  if (!input) return null;
  if (input === true) {
    return { png: true, svg: true, csv: true, copy: true };
  }
  const cfg: ToolbarConfig = {
    png: !!input.png,
    svg: !!input.svg,
    csv: !!input.csv,
    copy: !!input.copy,
  };
  if (!cfg.png && !cfg.svg && !cfg.csv && !cfg.copy) return null;
  return cfg;
}

function Header({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      {title && (
        <div className="text-base font-medium text-foreground">{title}</div>
      )}
      {subtitle && (
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

/** Rotated title for the CATEGORY (Y) axis — sits left of the label column. */
function CategoryAxisTitle({ title }: { title: string }) {
  return (
    <div className="flex w-6 shrink-0 items-center justify-center">
      <span
        className="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * LabelColumn — the left category-label column (the canon §13 pre-decision:
 * labels move OUT of the track into a fixed-width column, decided before the
 * first line of geometry).
 *
 * Width comes from the `--brock-hbar-label-width` CSS variable (set on the
 * figure from the `labelWidth` prop) so container queries can clamp it.
 * Overflow policy (canon §11): CSS truncate with ellipsis; the FULL text
 * stays available in the tooltip, the native `title` attribute, and the
 * sr-only data table. Each cell is exactly one bar row tall and the column
 * shares the rows' `gap`, so labels align with their bars by construction —
 * no JS measurement.
 *
 * aria-hidden: every bar's `aria-label` already carries the category name,
 * so exposing this column would make screen readers say everything twice.
 */
function LabelColumn({
  points,
  gap,
  barThickness,
}: {
  points: NormalizedPoint[];
  gap: number;
  barThickness: number;
}) {
  return (
    <div className="flex shrink-0 flex-col" style={{ gap }} aria-hidden>
      {points.map((p, i) => (
        <div
          key={i}
          className="brock-hbar-label flex min-w-0 items-center justify-end pe-2"
          style={{ height: barThickness }}
          title={p.label}
        >
          <span className="truncate font-mono text-xs text-muted-foreground">
            {p.label ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * ScrollableRowsArea — wraps the rows in a VERTICAL scroll container when
 * `scroll="auto"`. The mirror of Column Chart's horizontal scroll: a long
 * ranking scrolls through its categories while the value axis (rendered
 * outside this wrapper) stays pinned.
 *
 * Focusable: a scroll region must be keyboard-operable (WCAG 2.1.1) —
 * Tab in, then arrow keys scroll natively.
 */
function ScrollableRowsArea({
  scroll,
  maxHeight,
  children,
}: {
  scroll: "none" | "auto";
  maxHeight: number | undefined;
  children: ReactNode;
}) {
  if (scroll !== "auto") {
    // Default path — the chart is as tall as its data.
    return <>{children}</>;
  }
  return (
    <div
      className="brock-hbar-scroll min-w-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent"
      style={{ maxHeight }}
      tabIndex={0}
      role="group"
      aria-label="Scrollable chart area"
    >
      {children}
    </div>
  );
}

function BarsGroup({
  points,
  max,
  min,
  allZero,
  gap,
  barThickness,
  formatValue,
  ariaLabel,
  referenceLine,
  barRadius,
  animationEnabled,
  showLabels,
  labelFormat,
  patternStyle,
  focusIndex,
  setFocusIndex,
  barRefs,
  onBarClick,
  onBarHover,
  onBarFocus,
  tooltipSlot,
}: {
  points: NormalizedPoint[];
  max: number;
  min: number;
  allZero: boolean;
  gap: number;
  barThickness: number;
  formatValue: (v: number, d?: BarChartDataPoint) => string;
  ariaLabel: string;
  referenceLine?: { value: number; label?: string };
  barRadius: number;
  animationEnabled: boolean;
  showLabels: boolean;
  labelFormat: (v: number, d?: BarChartDataPoint) => string;
  patternStyle: BarChartPatternStyle;
  focusIndex: number;
  setFocusIndex: (i: number) => void;
  barRefs: React.RefObject<(HTMLDivElement | null)[]>;
  onBarClick?: (
    point: BarChartDataPoint,
    index: number,
    event:
      | ReactMouseEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>,
  ) => void;
  onBarHover?: (
    point: BarChartDataPoint | null,
    index: number | null,
  ) => void;
  onBarFocus?: (point: BarChartDataPoint, index: number) => void;
  tooltipSlot?: ComponentType<BarChartTooltipSlotProps>;
}) {
  function moveFocus(target: number) {
    const clamped = Math.max(0, Math.min(points.length - 1, target));
    setFocusIndex(clamped);
    barRefs.current[clamped]?.focus();
    onBarFocus?.(toPublicPoint(points[clamped]), clamped);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>, currentIndex: number) {
    // ↑/↓ are the PRIMARY axis on a horizontal bar chart (the canon §13
    // pre-decision: arrows flip with the geometry). ←/→ also work, so muscle
    // memory from Column Chart never dead-ends.
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveFocus(currentIndex + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(currentIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(points.length - 1);
        break;
      case "Enter":
      case " ":
        // Activation: trigger the click handler with the keyboard event.
        if (onBarClick) {
          event.preventDefault();
          onBarClick(toPublicPoint(points[currentIndex]), currentIndex, event);
        }
        break;
    }
  }

  // Touch: on tap, pin the tapped bar's tooltip (hover/focus don't exist on
  // touch). Tapping the same bar again clears it; tapping another switches.
  const [tapIndex, setTapIndex] = useState<number | null>(null);

  const total = points.length;
  // Edge zone size: first/last 15% of rows (min 1). Top-zone rows anchor
  // their tooltip BELOW the row so it never clips the figure top.
  const edgeZone = Math.max(1, Math.floor(total * 0.15));

  function edgeFor(i: number): EdgePosition {
    if (i < edgeZone) return "top";
    if (i >= total - edgeZone) return "bottom";
    return "middle";
  }

  const showRef =
    referenceLine && Number.isFinite(referenceLine.value) && !allZero;

  // Zero baseline: with negatives the 1px VERTICAL axis line moves right from
  // the start edge to the zero position; the container's start edge goes quiet.
  const hasNegative = min < 0;
  const range = max - min;
  const baselineLeftPct = hasNegative && range > 0 ? (-min / range) * 100 : 0;

  return (
    <div
      className={`brock-hbars brock-hbars-pattern-${patternStyle} relative flex min-w-0 flex-1 flex-col ${
        hasNegative ? "" : "border-s border-border"
      } ${animationEnabled ? "brock-hbars-animated" : ""}`}
      style={{ gap }}
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={onBarHover ? () => onBarHover(null, null) : undefined}
    >
      {hasNegative && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-[1] border-s border-border"
          style={{ left: `${baselineLeftPct}%` }}
          aria-hidden
        />
      )}

      {points.map((point, i) => (
        <BarRow
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          index={i}
          point={point}
          max={max}
          min={min}
          allZero={allZero}
          barThickness={barThickness}
          formatValue={formatValue}
          isTabStop={i === focusIndex}
          edge={edgeFor(i)}
          barRadius={barRadius}
          animationEnabled={animationEnabled}
          showLabel={showLabels}
          labelFormat={labelFormat}
          onKeyDown={(e) => handleKey(e, i)}
          onFocus={() => {
            setFocusIndex(i);
            onBarFocus?.(toPublicPoint(point), i);
          }}
          onClick={
            onBarClick
              ? (e) => onBarClick(toPublicPoint(point), i, e)
              : undefined
          }
          onMouseEnter={
            onBarHover
              ? () => onBarHover(toPublicPoint(point), i)
              : undefined
          }
          isTapActive={tapIndex === i}
          onTap={() => setTapIndex((prev) => (prev === i ? null : i))}
          tooltipSlot={tooltipSlot}
        />
      ))}

      {showRef && (
        <ReferenceLineEl
          line={referenceLine}
          max={max}
          min={min}
          formatValue={formatValue}
        />
      )}
    </div>
  );
}

/** Default `caption` rendering — italic note below source. */
function Caption({ text }: { text: string }) {
  return (
    <div className="brock-hbar-caption mt-2 border-s-2 border-border bg-muted/20 px-3 py-1.5 font-sans text-xs text-muted-foreground italic">
      {text}
    </div>
  );
}

/** Default `watermark` rendering — rotated faint text overlay. */
function Watermark({ text }: { text: string }) {
  return (
    <div
      className="brock-hbar-watermark pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      aria-hidden
    >
      <span
        className="font-pixel text-[68px] leading-none tracking-wider text-foreground/[0.06] select-none"
        style={{ transform: "rotate(-20deg)" }}
      >
        {text.toUpperCase()}
      </span>
    </div>
  );
}

/**
 * ReferenceLineEl — a VERTICAL dashed line at the reference value with its
 * label chip at the top (the canon §12 editorial surface, rotated 90° for
 * the horizontal geometry). Participates in the [min..max] scale like every
 * bar, so it is always inside the track.
 */
function ReferenceLineEl({
  line,
  max,
  min,
  formatValue,
}: {
  line: { value: number; label?: string };
  max: number;
  min: number;
  formatValue: (v: number, d?: BarChartDataPoint) => string;
}) {
  const range = max - min;
  const leftPercent = range > 0 ? ((line.value - min) / range) * 100 : 0;
  const labelText = line.label
    ? `${line.label} · ${formatValue(line.value)}`
    : formatValue(line.value);

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-[5] border-s border-dashed border-muted-foreground/50"
      style={{ left: `${leftPercent}%` }}
      role="img"
      aria-label={`${line.label ?? "Reference"} line at ${formatValue(line.value)}`}
    >
      {/* Chip at the TOP of the line. bg-background masks whatever sits
          behind it; -translate keeps it centered over the dashes. */}
      <span className="absolute top-0 left-0 -translate-x-1/2 -translate-y-full bg-background px-1 font-mono text-[10px] tabular-nums whitespace-nowrap text-muted-foreground">
        {labelText}
      </span>
    </div>
  );
}

type EdgePosition = "top" | "middle" | "bottom";

function BarRow({
  ref,
  index,
  point,
  max,
  min,
  allZero,
  barThickness,
  formatValue,
  isTabStop,
  edge,
  barRadius,
  animationEnabled,
  showLabel,
  labelFormat,
  onKeyDown,
  onFocus,
  onClick,
  onMouseEnter,
  isTapActive,
  onTap,
  tooltipSlot,
}: {
  ref: (el: HTMLDivElement | null) => void;
  index: number;
  point: NormalizedPoint;
  max: number;
  min: number;
  allZero: boolean;
  barThickness: number;
  formatValue: (v: number, d?: BarChartDataPoint) => string;
  isTabStop: boolean;
  edge: EdgePosition;
  barRadius: number;
  animationEnabled: boolean;
  showLabel: boolean;
  labelFormat: (v: number, d?: BarChartDataPoint) => string;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  isTapActive: boolean;
  onTap: () => void;
  tooltipSlot?: ComponentType<BarChartTooltipSlotProps>;
}) {
  // Two-sided geometry (LTR math, documented — canon §10): positive bars
  // start AT the baseline and grow right by v/range; negative bars end AT
  // the baseline, starting left of it by |v|/range. With min === 0 the
  // baseline sits on the track's left edge — pixel-identical to a classic
  // left-anchored bar chart.
  const range = max - min;
  const isNegative = point.value < 0;
  const barWidth =
    allZero || point.value === 0 || range <= 0
      ? 0
      : Math.max((Math.abs(point.value) / range) * 100, 1);
  const baselinePct = range > 0 ? ((0 - min) / range) * 100 : 0;
  const barStartPct = isNegative ? baselinePct - barWidth : baselinePct;
  // The bar's OUTER end — right edge for positives, left edge for negatives.
  const barEndPct = isNegative ? barStartPct : barStartPct + barWidth;
  // Deep bars (outer end within 14% of the track edge — i.e. longer than 86%
  // of the range) flip their label INSIDE in background color, matching the
  // SVG export. Mirrored threshold for negatives.
  const isDeep = isNegative ? barEndPct < 14 : barEndPct > 86;

  const publicDatum = toPublicPoint(point);
  const accessibleName = point.label
    ? `${point.label}: ${formatValue(point.value, publicDatum)}`
    : `Bar ${index + 1}: ${formatValue(point.value, publicDatum)}`;

  // Cursor hints affordance — only when a click handler is wired.
  const cursorClass = onClick ? "cursor-pointer" : "";

  // Where outer-end text sits. The note offsets a further 44px past the value
  // label — a fixed budget, no text measurement (the CSS-only policy from
  // canon §11; the SVG export uses the same fixed offset).
  const labelOffset = 4;
  const noteOffset = showLabel ? 44 : 4;

  /** Anchor a span at the bar's outer end, `offset` px beyond it (or inside
      for deep bars). Returns the inline position style. */
  const outerEndStyle = (offset: number): CSSProperties => {
    if (isNegative) {
      return isDeep
        ? { left: `calc(${barEndPct}% + ${offset}px)` } // flipped inside →
        : { right: `calc(${100 - barEndPct}% + ${offset}px)` }; // outside ←
    }
    return isDeep
      ? { right: `calc(${100 - barEndPct}% + ${offset}px)` } // flipped inside ←
      : { left: `calc(${barEndPct}% + ${offset}px)` }; // outside →
  };

  return (
    <div
      ref={ref}
      className={`group/hbar relative w-full rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent ${cursorClass}`}
      style={{ height: barThickness }}
      role="graphics-symbol"
      aria-roledescription="bar"
      aria-label={accessibleName}
      tabIndex={isTabStop ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTap}
    >
      {/* Value labels + notes anchor to the bar's OUTER end (Datawrapper
          direct-labeling convention; matches the SVG export). Deep bars flip
          the text INSIDE in background color so it never clips the track. */}
      {showLabel && !allZero && point.value !== 0 && (
        <span
          className={`pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 font-mono text-[10px] tabular-nums whitespace-nowrap ${
            isDeep ? "text-background" : "text-muted-foreground"
          }`}
          style={outerEndStyle(labelOffset)}
          aria-hidden
        >
          {labelFormat(point.value, publicDatum)}
        </span>
      )}
      {point.note && !allZero && point.value !== 0 && (
        <span
          className={`pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 font-mono text-[10px] tracking-wider whitespace-nowrap ${
            isDeep ? "text-background" : "text-foreground"
          }`}
          style={outerEndStyle(noteOffset)}
          aria-hidden
        >
          {point.note}
        </span>
      )}
      <div
        className={`brock-hbar absolute inset-y-0 transition-[filter] duration-150 group-hover/hbar:brightness-110 group-focus/hbar:brightness-110 ${
          isNegative ? "brock-hbar-neg" : ""
        } ${
          point.pattern === "hatched"
            ? "brock-hbar-hatched"
            : point.color
              ? ""
              : point.muted
                ? "brock-hbar-other"
                : "bg-brock-accent"
        } ${point.highlight ? "brock-hbar-highlighted" : ""}`}
        style={
          {
            left: `${barStartPct}%`,
            width: `${barWidth}%`,
            animationDelay: animationEnabled ? `${index * 30}ms` : undefined,
            // Corners round at the OUTER end: right for positive bars,
            // left for negative ones (anchored to the baseline).
            ...(isNegative
              ? {
                  borderTopLeftRadius: barRadius > 0 ? barRadius : undefined,
                  borderBottomLeftRadius:
                    barRadius > 0 ? barRadius : undefined,
                }
              : {
                  borderTopRightRadius: barRadius > 0 ? barRadius : undefined,
                  borderBottomRightRadius:
                    barRadius > 0 ? barRadius : undefined,
                }),
            // Per-bar color: overrides --brock-accent (so hatched fills + outline
            // pick it up via CSS var) and sets backgroundColor for solid fills.
            ...(point.color
              ? ({
                  "--brock-accent": point.color,
                  ...(point.pattern === "hatched"
                    ? {}
                    : { backgroundColor: point.color }),
                } as CSSProperties)
              : {}),
          } as CSSProperties
        }
        aria-hidden
      />
      {!allZero &&
        (tooltipSlot ? (
          (() => {
            const TooltipSlot = tooltipSlot;
            return (
              <div
                className={`brock-hbar-tip pointer-events-none absolute z-10 ${
                  isTapActive
                    ? "flex"
                    : "hidden group-hover/hbar:flex group-focus/hbar:flex"
                } ${TOOLTIP_POSITION[edge]}`}
                aria-hidden
              >
                <TooltipSlot
                  point={{
                    label: point.label,
                    value: point.value,
                    pattern: point.pattern,
                    color: point.color,
                    highlight: point.highlight,
                    note: point.note,
                  }}
                  index={index}
                  value={formatValue(point.value, publicDatum)}
                  label={point.label}
                  edge={edge}
                />
              </div>
            );
          })()
        ) : (
          <Tooltip
            label={point.label}
            value={formatValue(point.value, publicDatum)}
            edge={edge}
            forceVisible={isTapActive}
          />
        ))}
    </div>
  );
}

// Rows in the top edge zone anchor the tooltip BELOW the row (so it never
// clips the figure top); everywhere else it sits above. Horizontal anchor is
// the track start — where the eye returns after reading the label.
const TOOLTIP_POSITION: Record<EdgePosition, string> = {
  top: "top-full mt-2 left-0 items-start",
  middle: "bottom-full mb-2 left-0 items-start",
  bottom: "bottom-full mb-2 left-0 items-start",
};

function Tooltip({
  label,
  value,
  edge,
  forceVisible,
}: {
  label?: string;
  value: string;
  edge: EdgePosition;
  forceVisible?: boolean;
}) {
  const visClass = forceVisible
    ? "flex"
    : "hidden group-hover/hbar:flex group-focus/hbar:flex";
  return (
    <div
      className={`brock-hbar-tip pointer-events-none absolute z-10 flex-col gap-0.5 rounded-md border border-border bg-background px-2.5 py-1.5 shadow-md ${visClass} ${TOOLTIP_POSITION[edge]}`}
      role="tooltip"
      aria-hidden
    >
      {label && (
        <span className="font-sans text-[11px] whitespace-nowrap text-muted-foreground">
          {label}
        </span>
      )}
      <span className="font-mono text-xs tabular-nums whitespace-nowrap text-foreground">
        {value}
      </span>
    </div>
  );
}

/**
 * XAxisTicks — the VALUE axis, rendered below the bars area. Ticks are
 * positioned by value so the 0-tick sits exactly on the baseline (left edge
 * for all-positive data, mid-track with negatives). Edge ticks hug the track
 * edges; inner ticks center on their position.
 */
function XAxisTicks({
  ticks,
  max,
  min,
  format,
}: {
  ticks: number[];
  max: number;
  min: number;
  format: (v: number) => string;
}) {
  const range = max - min;
  return (
    <div
      className="brock-hbar-xaxis relative mt-1 h-4 font-mono text-[10px] tabular-nums text-muted-foreground/60"
      aria-hidden
    >
      {ticks.map((tick) => {
        const pct = range > 0 ? ((tick - min) / range) * 100 : 0;
        const translate = pct <= 0 ? "0" : pct >= 100 ? "-100%" : "-50%";
        return (
          <span
            key={tick}
            className="absolute top-0 leading-none whitespace-nowrap"
            style={{ left: `${pct}%`, transform: `translateX(${translate})` }}
          >
            {format(tick)}
          </span>
        );
      })}
    </div>
  );
}

function ChartSource({ source }: { source: string }) {
  return (
    <div className="mt-4 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
      Source: {source}
    </div>
  );
}

function DataTableSummary({
  points,
  formatValue,
  transformNote,
}: {
  points: NormalizedPoint[];
  formatValue: (v: number, d?: BarChartDataPoint) => string;
  /** "Sorted by value… / N categories combined…" — announced with the table. */
  transformNote?: string;
}) {
  // Caption is deliberately short: the figure's figcaption already carries
  // the full description — duplicating it here makes screen readers say
  // everything twice. Rows are in DISPLAY order (canon §10) and carry the
  // FULL category label — this is one of the truncation-policy fallbacks.
  return (
    <table className="sr-only">
      <caption>
        Data table.
        {transformNote ? ` ${transformNote}` : ""}
      </caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p, i) => (
          <tr key={i}>
            <th scope="row">
              {p.isOther
                ? `${p.label} (${p.items?.length ?? 0} categories combined)`
                : (p.label ?? `Bar ${i + 1}`)}
            </th>
            <td>{formatValue(p.value, toPublicPoint(p))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HBarAnimationStyles() {
  return (
    <style>{`
      .brock-hbars-animated .brock-hbar {
        animation: brock-hbar-grow var(--brock-hbar-duration, 400ms) cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
      }
      @keyframes brock-hbar-grow {
        from { transform: scaleX(0); transform-origin: left; }
        to   { transform: scaleX(1); transform-origin: left; }
      }
      /* Negative bars are anchored to the zero baseline at their RIGHT edge,
         so the grow animation mirrors: they grow leftward. */
      .brock-hbars-animated .brock-hbar-neg {
        animation-name: brock-hbar-grow-neg;
      }
      @keyframes brock-hbar-grow-neg {
        from { transform: scaleX(0); transform-origin: right; }
        to   { transform: scaleX(1); transform-origin: right; }
      }
      @media (prefers-reduced-motion: reduce) {
        .brock-hbars-animated .brock-hbar { animation: none; }
      }
      /* "Other" aggregate fill — muted, visually distinct from real categories
         (an aggregate carries less ink). Hatching is NOT used here: that
         encoding is reserved for estimated/in-progress semantics. Themeable via
         --brock-other. */
      .brock-hbar-other {
        background: var(--brock-other, color-mix(in oklab, var(--muted-foreground) 35%, transparent));
      }
      /* Hatched fill — stripe or dot pattern at the accent color.
         Outline keeps the bar shape readable when stripes thin out near baseline.
         The shape is set by the parent .brock-hbars-pattern-STYLE class so every
         hatched bar in the same chart shares one visual language. */
      .brock-hbar-hatched {
        background-color: transparent;
        outline: 1px solid var(--brock-accent);
        outline-offset: -1px;
      }
      .brock-hbars-pattern-diagonal .brock-hbar-hatched {
        background-image: repeating-linear-gradient(
          45deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-hbars-pattern-diagonal-reverse .brock-hbar-hatched {
        background-image: repeating-linear-gradient(
          -45deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-hbars-pattern-vertical .brock-hbar-hatched {
        background-image: repeating-linear-gradient(
          90deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-hbars-pattern-horizontal .brock-hbar-hatched {
        background-image: repeating-linear-gradient(
          0deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-hbars-pattern-dots .brock-hbar-hatched {
        background-image: radial-gradient(
          var(--brock-accent) 1.2px, transparent 1.5px
        );
        background-size: 6px 6px;
      }
      /* Per-bar emphasis: a thicker, darker outline + brightness bump. Reads on
         top of solid, hatched, and custom-color bars equally. */
      .brock-hbar-highlighted {
        outline: 2px solid var(--foreground, currentColor);
        outline-offset: 1px;
        filter: brightness(1.08);
      }
      /* Skeleton bars (loading state, no data). Dashed outline borrows the
         Brock UI "in-progress" pattern (see design thesis); the baseline side
         (left) stays open — ghosts grow from the baseline like real bars.
         Pulse animation is on by default but disabled under
         prefers-reduced-motion. */
      .brock-hbar-skeleton {
        /* Fallback for browsers without color-mix() */
        background-color: rgba(127, 127, 127, 0.08);
        background-color: color-mix(in oklab, var(--foreground) 8%, transparent);
        border-radius: 3px 3px 0 0;
        animation: brock-hbar-pulse 1400ms ease-in-out infinite;
      }
      @keyframes brock-hbar-pulse {
        0%, 100% { opacity: 0.6; }
        50%      { opacity: 1; }
      }
      /* Loading overlay (refresh-with-data case). Dim layer over the chart so
         the user can still see the previous numbers but knows they're stale. */
      .brock-hbar-overlay {
        background: color-mix(in oklab, var(--background) 55%, transparent);
        backdrop-filter: blur(0.5px);
      }
      .brock-spinner {
        animation: brock-spin 700ms linear infinite;
        transform-origin: center;
      }
      @keyframes brock-spin {
        to { transform: rotate(360deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .brock-hbar-skeleton,
        .brock-spinner { animation: none; }
      }
      /* Label column width — driven by a CSS variable (set on the figure from
         the labelWidth prop) so the rules below can clamp it. */
      .brock-hbar-label { width: var(--brock-hbar-label-width, 96px); }
      .brock-hbar-xaxis-pad { padding-inline-start: var(--brock-hbar-label-width, 96px); }
      /* Container queries — the chart adapts to ITS OWN width (sidebar widget
         vs full-bleed article), not the viewport. CSS-only narrow-container
         behavior for the label column (canon §11): at ≤420px the column clamps
         to 64px (labels truncate harder); at ≤240px it disappears entirely.
         Full labels always remain in the tooltip + sr-table + title attr. */
      @container (max-width: 420px) {
        .brock-hbar-label { width: min(var(--brock-hbar-label-width, 96px), 64px); }
        .brock-hbar-xaxis-pad { padding-inline-start: min(var(--brock-hbar-label-width, 96px), 64px); }
      }
      @container (max-width: 240px) {
        .brock-hbar-label { display: none; }
        .brock-hbar-xaxis-pad { padding-inline-start: 0; }
      }
      /* Windows High Contrast / forced-colors: backgrounds are normally
         stripped, which would make solid bars invisible. Re-assert bars in
         system colors; hatched stays outlined; the muted "Other" uses
         GrayText so the aggregate-vs-category distinction survives. */
      @media (forced-colors: active) {
        .brock-hbar {
          background: CanvasText !important;
          forced-color-adjust: none;
        }
        .brock-hbar-hatched {
          background: Canvas !important;
          outline-color: CanvasText !important;
        }
        .brock-hbar-other {
          background: GrayText !important;
        }
        .brock-hbars {
          border-color: CanvasText !important;
        }
      }
      /* Print: strip interactive chrome, expand chart inline, force solid
         backgrounds and visible borders so the printed page reads cleanly.
         Toolbar, loading overlay, hover tooltip — all hidden. */
      @media print {
        .brock-hbar-toolbar,
        .brock-hbar-overlay,
        .brock-hbar-skeleton { display: none !important; }
        /* The watermark is a document-lifecycle marker (DRAFT/CONFIDENTIAL) —
           print is exactly where it must survive. 6% foreground vanishes on
           paper; print it darker. */
        .brock-hbar-watermark span { color: rgb(0 0 0 / 0.14) !important; }
        .brock-hbars-animated .brock-hbar { animation: none !important; }
        .brock-hbars-figure {
          break-inside: avoid;
          page-break-inside: avoid;
          background: white !important;
          color: black !important;
        }
        /* Paper has no scrollbars — print the full ranking. */
        .brock-hbar-scroll {
          overflow: visible !important;
          max-height: none !important;
        }
      }
    `}</style>
  );
}
