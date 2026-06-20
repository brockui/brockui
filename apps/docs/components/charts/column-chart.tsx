/**
 * Column Chart — time-series vertical bars, editorial-grade.
 *
 * The Brock UI signature moves:
 *
 *  1. Hack mono Y-axis with tabular-nums; --brock-accent for the bar fill
 *     (single color, no gradient/glow); 1px baseline only — no gridlines
 *     (Tufte data-ink).
 *  2. Pixel-font tooltip badge (Departure Mono) + Hack value; staggered
 *     CSS-only entry animation that honors prefers-reduced-motion.
 *  3. ASCII "no data" empty state; dashed-bar skeleton loading state with
 *     LOADING badge; ▲▲▲ error state with optional Retry button — all in
 *     one Tufte-friendly visual language.
 *  4. Hatching as a Tufte encoding: per-bar `pattern: 'hatched'`, plus
 *     `hatchUntilIndex` / `hatchFromIndex` shortcuts (historical-vs-projected),
 *     plus 5 pattern styles (diagonal / reverse / vertical / horizontal / dots).
 *  5. Per-bar editorial overrides via the object-form `data` shape:
 *     { label, value, pattern, color, highlight, note } — emphasis without
 *     a separate annotations API. Optional `sort` (asc/desc) + `topN` (with an
 *     "Other" bucket) turn the chart into a ranking without reshaping data.
 *  6. Plot bands (`bands`) for range highlights; reference line (fixed value
 *     or computed mean/median stat) that participates in scale; free-floating annotations (`annotations`) with optional
 *     dashed connector arrows for FT-style call-outs.
 *  7. Editorial extras: short `caption` below source; diagonal `watermark`
 *     overlay for DRAFT / CONFIDENTIAL; both reproduced in SVG export.
 *  8. Native export: PNG / SVG / CSV / Copy via the Toolbar slot or the
 *     imperative ref. Zero external deps. Patterns + per-bar colors +
 *     annotations all survive the round-trip.
 *  9. Print stylesheet (@media print) strips toolbar/overlays, forces solid
 *     bg, prevents page-breaks inside the figure.
 * 10. Event callbacks: onBarClick / onBarHover / onBarFocus. Imperative ref
 *     API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }.
 *     Touch: tap pins a bar's tooltip (hover/focus don't exist on touch);
 *     re-tap dismisses, tapping another switches.
 * 11. Full slot system for headless customization: tooltip / empty / loading /
 *     error / toolbar / caption / watermark — each typed with its own props.
 * 12. Forward-compat for Python / WordPress / static embeds: chartType +
 *     dataDescription AI metadata, toJSON() / fromJSON() with a versioned
 *     $schema, and a renderToHTMLString() pipeline that turns a JSON config
 *     into self-contained HTML — no React runtime needed at the consumer.
 *
 * Accessibility:
 *  - Container: role="figure" with aria-labelledby
 *  - Bars: role="graphics-symbol", roving tabindex, Arrow/Home/End keyboard nav
 *  - Enter / Space on a focused bar invokes onBarClick
 *  - Hidden <table class="sr-only"> summary for screen readers
 *  - Loading: role="status" aria-live="polite" + aria-busy
 *  - Error:   role="alert"  aria-live="assertive"
 *  - prefers-reduced-motion honored across bar-rise + skeleton + spinner
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
} from "./column-chart-export";
import { ChartExportMenu } from "./chart-toolbar";

/** Fill pattern for a bar — solid accent fill, or hatched stripe pattern. */
export type ColumnChartPattern = "solid" | "hatched";

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
export type ColumnChartPatternStyle =
  | "diagonal"
  | "diagonal-reverse"
  | "dots"
  | "vertical"
  | "horizontal";

/** One data point in object form. Easier to map from DataFrames / SQL rows. */
export type ColumnChartDataPoint = {
  /** X-axis label (rendered in Departure Mono pixel font). Optional. */
  label?: string;
  /**
   * Y-axis value. Negative values are first-class: bars grow DOWN from an
   * always-visible zero baseline (profit/loss, YoY change, anomalies — the
   * data-journalism staple). Silently distorting them would violate the
   * library's honesty thesis.
   */
  value: number;
  /**
   * Fill pattern override for this specific bar. When omitted, falls back to the
   * chart-level `pattern` prop (default "solid"). Use "hatched" to mark
   * historical, estimated, or in-progress values — Tufte-style encoding without
   * spending a second color.
   */
  pattern?: ColumnChartPattern;
  /**
   * Per-bar fill color override (any CSS color). Use sparingly — Tufte data-ink
   * discipline says one accent should rule. Reserve this for editorial cases:
   * a single anomaly, a "current period" marker, the peak value.
   */
  color?: string;
  /**
   * Marks this bar as visually emphasized — a darker outline + slight brightness
   * boost. Combine with `note` for the classic "this one matters" annotation.
   */
  highlight?: boolean;
  /**
   * Short annotation rendered above the bar in Hack mono (e.g. "← peak",
   * "anomaly", "now"). Editorial / FT-style markup that travels with the data,
   * not with chart-level config.
   */
  note?: string;
  /**
   * Stable addressing key for this datum. Defaults to `label` (or the input
   * index for plain `number[]` data). Used by `annotations` (string form),
   * `focusBar(key)`, and `getSelection()`. Survives `sort` / `topN` because
   * it travels with the datum, unlike a display position.
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
  items?: readonly ColumnChartDataPoint[];
};

/**
 * Object form of `topN`. The number shorthand `topN={5}` is equivalent to
 * `topN={{ n: 5 }}` with all defaults.
 */
export type ColumnChartTopN = {
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
   * encoding is reserved for historical/projected semantics.
   */
  distinct?: boolean;
};

/**
 * Reference line drawn across the chart — a fixed threshold/goal, or a
 * computed statistic. The data-journalism workhorse: "40% above the mean".
 */
export type ColumnChartReferenceLine = {
  /**
   * A fixed value, or `{ stat: "mean" | "median" }` to compute it from the
   * ORIGINAL input data (before `sort`/`topN` — bucketing must not move a
   * statistic). Included in the max scale calculation so the line stays visible.
   */
  value: number | { stat: "mean" | "median" };
  /**
   * Optional label (e.g. "Q3 target"). Stats auto-label as "Mean"/"Median"
   * when omitted. Rendered with the value in Hack mono.
   */
  label?: string;
};

/**
 * Free-floating editorial annotation positioned at a specific (x, y) in data
 * space. Use sparingly — the FT/Bloomberg "callout + arrow" pattern for
 * marking inflection points, anomalies, deployment cuts, etc.
 *
 * `x` accepts either a 0-based INPUT index (number — the position in your
 * original `data` array; the annotation travels with its datum through
 * `sort`/`topN`, and is dropped with a dev warning if that datum collapses
 * into "Other") or a string (matched case-insensitively against the bar's
 * `key`, which defaults to `label`). `y` is in data-value space — the
 * renderer maps it into pixels using the chart's `max`.
 *
 * When `arrow=true`, a thin dashed line is drawn from the text card to the
 * exact (x, y) point in the chart.
 */
export type ColumnChartAnnotation = {
  /** INPUT-order bar index (number) or key/label match (string). */
  x: number | string;
  /** Value on the Y-axis in data space. */
  y: number;
  /** Text content of the annotation card. */
  text: string;
  /**
   * Where the text card sits relative to the (x, y) point. Default "top" —
   * card floats above the point. Use "bottom"/"left"/"right" to dodge bars.
   */
  anchor?: "top" | "bottom" | "left" | "right";
  /** Draw a dashed connector from the card to (x, y). Default `false`. */
  arrow?: boolean;
  /** Override text color (defaults to foreground). */
  color?: string;
};

/**
 * Highlighted vertical zone spanning a range of bar indices — FT/Bloomberg
 * "plot band" pattern. Sits behind bars at very-low opacity so the bars stay
 * the loudest mark. Common uses: "Q3", "deployment window", "recession",
 * "experiment cohort".
 */
export type ColumnChartBand = {
  /** Start bar index (inclusive). */
  from: number;
  /** End bar index (inclusive). */
  to: number;
  /** Optional caption rendered at the top of the band. */
  label?: string;
  /** Optional CSS background. Defaults to a low-opacity foreground tint. */
  color?: string;
};

/* ─── Slot prop types ──────────────────────────────────────────────── */

/**
 * Props passed to a custom `slots.tooltip` component. Replaces the default
 * pixel-badge + Hack-mono tooltip that hovers above the focused bar.
 * Position is already handled by the wrapper — the slot only needs to render
 * its content.
 */
export type ColumnChartTooltipSlotProps = {
  /** The bar this tooltip is for. */
  point: ColumnChartDataPoint;
  /** 0-based index within the data array. */
  index: number;
  /** Already-formatted value string (respects numberFormat / formatValue). */
  value: string;
  /** X-axis label, if the bar has one. */
  label?: string;
  /** Which edge the bar sits on — useful for tail orientation. */
  edge: "left" | "center" | "right";
};

/** Props passed to a custom `slots.empty` component. */
export type ColumnChartEmptySlotProps = {
  /** Height the slot should occupy (matches the chart's `height` prop). */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
};

/** Props passed to a custom `slots.loading` component. */
export type ColumnChartLoadingSlotProps = {
  /** Height the slot should occupy. */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
  /** Localized "Loading…" label. */
  label: string;
};

/** Props passed to a custom `slots.error` component. */
export type ColumnChartErrorSlotProps = {
  /** Height the slot should occupy. */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
  /** Localized "Error" label. */
  label: string;
  /** Normalized error message string. */
  message: string;
  /** The full normalized Error instance for richer rendering. */
  error: Error;
  /** Retry callback, if `onRetry` was passed to ColumnChart. */
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
export type ColumnChartToolbarSlotProps = {
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
export type ColumnChartCaptionSlotProps = Record<string, never>;

/**
 * Slot props for a `slots.watermark`. Rendered as an absolute-positioned
 * overlay over the chart figure (after the chart, before tooltip). Use for
 * subtle branding without competing with data ink.
 */
export type ColumnChartWatermarkSlotProps = Record<string, never>;

/**
 * The full slot dictionary. Every slot is optional; provide only the ones
 * you want to override. Defaults stay in place for the rest.
 */
export type ColumnChartSlots = {
  tooltip?: ComponentType<ColumnChartTooltipSlotProps>;
  empty?: ComponentType<ColumnChartEmptySlotProps>;
  loading?: ComponentType<ColumnChartLoadingSlotProps>;
  error?: ComponentType<ColumnChartErrorSlotProps>;
  toolbar?: ComponentType<ColumnChartToolbarSlotProps>;
  caption?: ComponentType<ColumnChartCaptionSlotProps>;
  watermark?: ComponentType<ColumnChartWatermarkSlotProps>;
};

export type ColumnChartProps = {
  /**
   * Bar data. Two forms accepted:
   *  - `number[]` — values only; pair with `labels` prop for X-axis text
   *  - `ColumnChartDataPoint[]` — object form with `value` + optional `label`
   */
  data: readonly number[] | readonly ColumnChartDataPoint[];

  /** X-axis labels (only used when `data` is `number[]`). */
  labels?: readonly string[];

  /** Chart height in pixels for Y-axis + bars area. Default 200. */
  height?: number;

  /** Pixel gap between bars. Default 4. Auto-reduced for dense datasets (60+ bars). */
  gap?: number;

  /**
   * Decimal trend e.g. `0.184` → "↗ +18.4%" (orange if positive, muted if negative).
   * Rendered top-right above the chart.
   */
  trend?: number;

  /**
   * Reference line — a dashed horizontal line at a fixed value ("Q3 target")
   * or a computed statistic (`{ stat: "mean" }` / `{ stat: "median" }`,
   * calculated over the original input data). Included in the max scale so
   * the line stays visible (FT/Bloomberg KPI + data-journalism pattern).
   */
  referenceLine?: ColumnChartReferenceLine;

  /** Source attribution rendered below the chart (FT/Bloomberg pattern). */
  source?: string;

  /**
   * Override the accent color (any CSS color or var). Defaults to `--brock-accent`
   * (Brock UI orange). Use for theming or playground / preview UIs.
   */
  accent?: string;

  /**
   * Bar top-corner radius in pixels. Default 0 (sharp).
   * Bottom corners stay flat (column charts are anchored to baseline).
   * Common values: 0 (sharp), 2 (subtle), 6 (rounded).
   */
  barRadius?: number;

  /**
   * Accessible description of the chart for screen readers.
   * Used as `aria-label` on the chart container and the visually-hidden
   * `<caption>` of the data table summary. Default: "Column chart with N data points".
   */
  description?: string;

  /** Custom formatter for Y-axis tick labels. Default uses `toLocaleString`. */
  yAxisFormat?: (value: number) => string;

  /** Custom formatter for hover-tooltip value. Default uses `toLocaleString`. */
  formatValue?: (value: number, datum?: ColumnChartDataPoint) => string;

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

  /** X-axis configuration. */
  xAxis?: {
    /** Title rendered below the X-axis tick labels. */
    title?: string;
    /** Hide X-axis tick labels (default: show if labels are provided). */
    hideTicks?: boolean;
  };

  /**
   * Y-axis configuration.
   *
   * There is deliberately no `min`: a column chart's baseline is always zero.
   * A truncated baseline turns bar length into a lie (the one thing the entire
   * canon — Tufte's lie factor, Datawrapper's hard rule — agrees on). For data
   * where deviation-from-a-baseline is the story, use a different chart shape.
   */
  yAxis?: {
    /** Title rendered rotated -90° to the left of the Y-axis. */
    title?: string;
    /**
     * Extend the max value beyond the data (headroom — e.g. to align scales
     * across a series of charts). EXTEND-ONLY: a value below the data max
     * would clip bars, so it is ignored with a dev warning.
     */
    max?: number;
    /** Hide Y-axis tick labels (default: show). */
    hideTicks?: boolean;
  };

  /**
   * Number formatting applied to Y-axis ticks, tooltip values, and inline data labels.
   * If both `numberFormat` and explicit `formatValue` / `yAxisFormat` are given,
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
   * Inline value labels above each bar (Hack mono).
   *
   *  - `"auto"` (DEFAULT) — the editorial mode (Datawrapper/FT direct
   *    labeling): when the chart has ≤ 8 bars, labels are shown AND the
   *    Y-axis ticks hide — the axis is redundant ink once every value is
   *    printed (Tufte; this default is the thesis made visible). An explicit
   *    `yAxis.hideTicks` always wins over the auto behavior.
   *  - `true` / `false` — always / never show.
   */
  dataLabels?: {
    show?: boolean | "auto";
    /** Optional override of the value formatter for these labels. */
    format?: (value: number, datum?: ColumnChartDataPoint) => string;
  };

  /** Animation configuration. */
  animation?: {
    /** Enable the staggered bar-rise animation on mount (default true). */
    enabled?: boolean;
    /** Per-bar animation duration in ms (default 400). */
    duration?: number;
  };

  /**
   * Default fill pattern for all bars. Per-point `pattern` on a data point wins
   * over this. Default "solid".
   *
   * Hatched bars use a diagonal stripe pattern at the accent color — ideal for
   * encoding *historical vs projected*, *estimated vs actual*, or
   * *in-progress vs done* without spending a second color (Tufte data-ink).
   */
  pattern?: ColumnChartPattern;

  /**
   * Convenience encoding for the historical-vs-projected pattern. When set,
   * bars with index `< hatchUntilIndex` render hatched, the rest render solid.
   * Equivalent to setting `pattern: 'hatched'` on the first N points.
   *
   * Combinable with `hatchFromIndex` — both ranges union into the hatched set.
   */
  hatchUntilIndex?: number;

  /**
   * Mirror of `hatchUntilIndex`: bars with index `>= hatchFromIndex` render
   * hatched. Useful for forecast bands and "last N hatched" patterns.
   */
  hatchFromIndex?: number;

  /**
   * Visual style of hatched bars (chart-level). Per-bar `pattern: 'hatched'`
   * still controls *whether* a bar is hatched; this prop controls *how* every
   * hatched bar looks. Default `"diagonal"`.
   */
  patternStyle?: ColumnChartPatternStyle;

  /**
   * Minimum width per bar in pixels. Used together with `scroll` to decide when
   * bars are too thin and should overflow into a horizontal scroll area rather
   * than collapse to a sliver. Default 4.
   */
  minBarWidth?: number;

  /**
   * Overflow behavior when the chart is narrower than
   * `points.length * (minBarWidth + gap)`.
   *
   *  - `"none"` (default) — bars shrink to fit, ignoring `minBarWidth`. Matches
   *    classic responsive behavior; OK for short series.
   *  - `"auto"` — the bars area gets a hard `min-width` and scrolls horizontally
   *    inside its container. Y-axis ticks stay pinned to the left so the chart
   *    stays readable while you swipe through long time series.
   */
  scroll?: "none" | "auto";

  /**
   * Reorder bars by value before rendering.
   *
   *  - `"none"` (default) — preserve input / DataFrame order (chronological,
   *    categorical-as-given). The honest default for a time-series column chart.
   *  - `"asc"` / `"desc"` — sort by value. Turns the chart into a ranking
   *    (smallest→largest or largest→smallest), the Datawrapper / Flourish
   *    "sorted bar" pattern.
   *
   * Sorting is applied AFTER `topN` bucketing, so an "Other" bar participates
   * in the sort like any other bar. Positional shortcuts (`hatchUntilIndex`,
   * `hatchFromIndex`, annotations by numeric index) resolve on the *input*
   * order and travel with their datum; annotations matched by label survive
   * the reorder. The sort is stable (ties keep input order).
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
  topN?: number | ColumnChartTopN;

  /**
   * Plot bands — vertical highlighted zones spanning a range of bar indices.
   * Editorial pattern: "Q3", "deployment window", "experiment cohort". Bands
   * render behind bars at low opacity so they never dominate the data.
   */
  bands?: readonly ColumnChartBand[];

  /**
   * Mark the chart as loading. Behavior depends on whether data is also present:
   *
   *  - `loading=true` + empty data → **full skeleton** (dashed ghost bars,
   *    pixel-font LOADING badge, ARIA `role="status" aria-live="polite"`).
   *    Use for initial fetch.
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

  /** Ref handle for imperative exports — see `ColumnChartHandle`. */
  ref?: Ref<ColumnChartHandle>;

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
    point: ColumnChartDataPoint,
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
    point: ColumnChartDataPoint | null,
    index: number | null,
  ) => void;

  /**
   * Fired when keyboard focus moves between bars (arrow keys, Home/End, Tab
   * into chart). Tracks the roving-tabindex focus position. Use for "show
   * details for the focused bar" patterns in keyboard-only workflows.
   */
  onBarFocus?: (point: ColumnChartDataPoint, index: number) => void;

  /**
   * Slot dictionary for headless customization. Each slot replaces a specific
   * default sub-component:
   *
   *  - `tooltip`   — hover/focus tooltip above the focused bar
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
  slots?: ColumnChartSlots;

  /**
   * Short editorial caption rendered below the source line. Italic, muted,
   * left-bordered — borrows the print-margin annotation pattern from FT /
   * Stripe Letters. Use for reading notes ("Q4 estimate may revise after
   * the close"), context ("Excludes weekends"), or methodology ("Includes
   * agent retries").
   *
   * `slots.caption` takes precedence and replaces the default rendering.
   */
  caption?: string;

  /**
   * Diagonal watermark text rendered as a faint overlay over the chart.
   * Default opacity is low (≈8%) so it never competes with data ink. Use
   * for "DRAFT", "CONFIDENTIAL", brand name, or per-export attribution.
   *
   * `slots.watermark` takes precedence and replaces the default rendering.
   */
  watermark?: string;

  /**
   * Free-floating editorial annotations — text cards positioned at specific
   * (x, y) points in data space, optionally with a dashed connector arrow
   * to that point. Different from `bands` (which highlight a range) and
   * different from per-bar `note` (which travels with the datum).
   *
   * Annotations are reproduced in the SVG / PNG export so editorial
   * markup survives the share.
   */
  annotations?: readonly ColumnChartAnnotation[];

  /**
   * Machine-readable identifier for this chart type. Stamped onto the figure
   * as `data-chart-type` and included in `toJSON()` output. Default
   * `"column"`. Useful for AI / LLM tooling that wants to reason about what
   * the chart represents — and for analytics that need a stable type tag.
   */
  chartType?: string;

  /**
   * Natural-language description of what the data represents. Different from
   * `description` (which auto-generates a count-based screen-reader label).
   * Stamped onto the figure as `data-description` and included in `toJSON()`
   * output. Use for AI prompts ("Daily active users, normalized to working
   * days, week-over-week") or for editorial provenance.
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
export type ColumnChartHandle = {
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
    point: ColumnChartDataPoint;
    index: number;
    key: string;
  } | null;
};

type NormalizedPoint = {
  label?: string;
  value: number;
  pattern: ColumnChartPattern;
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
  items?: ColumnChartDataPoint[];
  /** "Other" with distinct=true renders in the muted --brock-other fill. */
  muted?: boolean;
};

/**
 * Strip the internal NormalizedPoint down to the public datum shape handed to
 * callbacks, exports, and the imperative API. Single source of truth — every
 * surface that exposes a datum goes through here.
 */
function toPublicPoint(p: NormalizedPoint): ColumnChartDataPoint {
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
      return `\u2212${prefix}${Math.abs(v).toLocaleString(locale, options)}${suffix}`;
    }
    return `${prefix}${v.toLocaleString(locale, options)}${suffix}`;
  };
}

function isObjectForm(
  data: readonly number[] | readonly ColumnChartDataPoint[],
): data is readonly ColumnChartDataPoint[] {
  return data.length > 0 && typeof data[0] === "object" && data[0] !== null;
}

function normalize(
  data: readonly number[] | readonly ColumnChartDataPoint[],
  labels: readonly string[] | undefined,
  defaultPattern: ColumnChartPattern,
  hatchUntilIndex: number | undefined,
  hatchFromIndex: number | undefined,
  sort: "none" | "asc" | "desc",
  topN: number | ColumnChartTopN | undefined,
): { points: NormalizedPoint[]; inputValues: number[] } {
  const patternFor = (i: number, override?: ColumnChartPattern): ColumnChartPattern => {
    if (override) return override;
    if (hatchUntilIndex !== undefined && i < hatchUntilIndex) return "hatched";
    if (hatchFromIndex !== undefined && i >= hatchFromIndex) return "hatched";
    return defaultPattern;
  };

  const raw: NormalizedPoint[] = isObjectForm(data)
    ? data.map((d, i) => ({
        label: d.label,
        value: d.value,
        pattern: patternFor(i, d.pattern),
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
        pattern: patternFor(i),
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
      `[brock-ui] ColumnChart: skipped ${invalidCount} non-finite value(s) (NaN/Infinity).`,
    );
  }

  // Duplicate keys break string addressing (annotations / focusBar match the
  // FIRST hit) — warn so the consumer can set explicit `key`s.
  if (process.env.NODE_ENV !== "production") {
    const seen = new Set<string>();
    for (const p of cleaned) {
      const k = p.key.toLowerCase();
      if (seen.has(k)) {
        console.warn(
          `[brock-ui] ColumnChart: duplicate key "${p.key}". String addressing (annotations, focusBar) matches the first occurrence — set an explicit \`key\` on each datum to disambiguate.`,
        );
        break;
      }
      seen.add(k);
    }
  }

  // Long-tail compression first, then ranking — via the SAME shared transform
  // the static render path uses (no fidelity drift). The "Other" aggregate is
  // pinned last by default; with pinned=false it ranks by its summed value.
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
  formatValue: (v: number, d?: ColumnChartDataPoint) => string,
): string {
  const base = `Column chart with ${points.length} data point${
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

export function ColumnChart({
  data,
  labels,
  height = 200,
  gap = 4,
  trend,
  referenceLine,
  source,
  accent,
  barRadius = 0,
  description,
  yAxisFormat,
  formatValue,
  className,
  header,
  xAxis,
  yAxis,
  numberFormat,
  dataLabels,
  animation,
  pattern = "solid",
  hatchUntilIndex,
  hatchFromIndex,
  patternStyle = "diagonal",
  minBarWidth = 4,
  scroll = "none",
  sort = "none",
  topN,
  bands,
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
  annotations,
  chartType = "column",
  dataDescription,
  "data-testid": dataTestId,
}: ColumnChartProps) {
  const { points, inputValues } = normalize(
    data,
    labels,
    pattern,
    hatchUntilIndex,
    hatchFromIndex,
    sort,
    topN,
  );
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

  // Plot bands address DISPLAY positions; after a sort the original zone
  // ("Q3", "deployment window") is editorially meaningless. Warn, don't fix —
  // re-mapping zones across a ranking has no honest answer.
  if (
    process.env.NODE_ENV !== "production" &&
    sort !== "none" &&
    bands &&
    bands.length > 0
  ) {
    console.warn(
      `[brock-ui] ColumnChart: \`bands\` assume input order, but \`sort="${sort}"\` reorders the bars — the banded zone no longer covers the original range. Remove the bands or the sort.`,
    );
  }

  // Dev-only diagnostic: bars are pointer targets when onBarClick is wired,
  // and WCAG 2.5.8 (Target Size Minimum) wants >= 24px. We deliberately do
  // NOT inflate minBarWidth's default (dense long series are the point of
  // scroll="auto", and keyboard access works at any width) — we warn the one
  // consumer who actually has the problem.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !onBarClick) return;
    const el = barRefs.current[0];
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0 && w < 24) {
      console.warn(
        `[brock-ui] ColumnChart: bars are ~${Math.round(
          w,
        )}px wide and onBarClick is wired — pointer targets under 24px fail WCAG 2.5.8 (Target Size Minimum). Consider scroll="auto" with minBarWidth={24} or fewer bars. Keyboard access is unaffected.`,
      );
    }
  }, [points.length, onBarClick]);

  // Number formatting cascade: explicit overrides > numberFormat > default
  const baseFormatter = makeFormatter(numberFormat);
  const effectiveFormatValue = formatValue ?? baseFormatter;
  const effectiveYAxisFormat = yAxisFormat ?? baseFormatter;
  const effectiveLabelFormat = dataLabels?.format ?? effectiveFormatValue;

  // ─── Derived values (lifted above the state machine so the imperative
  //     export API can synthesize an SVG even from loading/error/empty). ───
  const dataMax = points.reduce((m, p) => Math.max(m, p.value), 0);
  const dataMin = points.reduce((m, p) => Math.min(m, p.value), 0);
  // The reference line participates in the scale on BOTH sides so it always
  // stays visible — a positive ref extends the top, a negative one the bottom.
  const refValue =
    resolvedReference && Number.isFinite(resolvedReference.value)
      ? resolvedReference.value
      : undefined;
  const refBased =
    refValue !== undefined && refValue > 0
      ? Math.max(dataMax, refValue)
      : dataMax;
  // yAxis.max is extend-only: a max below the data would clip bars (the
  // truncated-bar lie). Ignore + warn instead of silently distorting.
  const max =
    yAxis?.max !== undefined ? Math.max(yAxis.max, refBased) : refBased;
  if (
    process.env.NODE_ENV !== "production" &&
    yAxis?.max !== undefined &&
    yAxis.max < refBased
  ) {
    console.warn(
      `[brock-ui] ColumnChart: yAxis.max (${yAxis.max}) is below the data/reference max (${refBased}) and was ignored — a clipped baseline-zero chart would distort bar lengths. yAxis.max can only extend the scale.`,
    );
  }
  const min =
    refValue !== undefined && refValue < 0
      ? Math.min(dataMin, refValue)
      : dataMin;
  const allZero = max === 0 && min === 0;
  const effectiveGap = points.length > 60 ? Math.max(1, gap - 2) : gap;
  // Tufte-sparse ticks: [max, mid, 0] normally; [max, 0, min] with negatives
  // (the 0-tick then sits exactly on the baseline).
  const yTicks = allZero
    ? [0]
    : min < 0
      ? [max, 0, min]
      : [max, Math.round(max / 2), 0];
  // dataLabels "auto" — the editorial mode: direct labels for small N, and the
  // Y axis hides (redundant ink once every value is printed). An explicit
  // yAxis.hideTicks always wins.
  // "auto" is the DEFAULT — direct labeling is the thesis made visible.
  const labelsMode = dataLabels?.show ?? "auto";
  const autoLabels = labelsMode === "auto";
  const showLabels =
    labelsMode === true ||
    (autoLabels && points.length > 0 && points.length <= 8);
  const showYTicks =
    yAxis?.hideTicks !== undefined
      ? !yAxis.hideTicks
      : !(autoLabels && showLabels);
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
      gap: effectiveGap,
      barRadius,
      patternStyle,
      accent: resolvedAccent,
      foreground: resolve("--foreground", "#0a0a0a"),
      muted: resolve("--muted-foreground", "#666666"),
      border: resolve("--border", "#e5e5e5"),
      background: resolve("--background", "#ffffff"),
      yTicks,
      yAxisFormat: effectiveYAxisFormat,
      formatValue: effectiveFormatValue,
      labelFormat: effectiveLabelFormat,
      showLabels,
      showYTicks,
      showXTicks: !xAxis?.hideTicks,
      yAxisTitle: yAxis?.title,
      xAxisTitle: xAxis?.title,
      headerTitle: header?.title,
      headerSubtitle: header?.subtitle,
      trend,
      referenceLine: resolvedReference,
      bands,
      source,
      caption,
      watermark,
      annotations,
      description: accessibleDescription,
    };
  };

  /** Use figure-rect when available; fall back to 800×400 for export-only flows. */
  const getExportDimensions = (
    opts?: { width?: number; height?: number },
  ): { width: number; height: number } => {
    const live = figureRef.current?.getBoundingClientRect();
    const w = opts?.width ?? (live && live.width > 0 ? live.width : 800);
    const h = opts?.height ?? (live && live.height > 0 ? live.height : 400);
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
      bands,
      dataLabels?.show,
      effectiveFormatValue,
      effectiveGap,
      effectiveLabelFormat,
      effectiveYAxisFormat,
      exportFileName,
      header?.subtitle,
      header?.title,
      max,
      allZero,
      resolvedReference,
      onExport,
      patternStyle,
      points,
      source,
      trend,
      xAxis?.hideTicks,
      xAxis?.title,
      yAxis?.hideTicks,
      yAxis?.title,
      yTicks,
      accessibleDescription,
      // focus/event refresh — keeps getSelection() / focusBar() reading fresh state
      focusIndex,
      onBarFocus,
      // editorial layers — must refresh export snapshot when these change
      caption,
      watermark,
      annotations,
    ],
  );

  // ─── State machine priority ───
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
            height={height}
            source={source}
            label={errorLabel}
            message={normalizedError.message}
            error={normalizedError}
            onRetry={onRetry}
            retryLabel={retryLabel}
          />
          <BarAnimationStyles />
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
          height={height}
          source={source}
          label={errorLabel}
          message={normalizedError.message}
          onRetry={onRetry}
          retryLabel={retryLabel}
          className={className}
        />
        <BarAnimationStyles />
      </>
    );
  }

  if (loading && points.length === 0) {
    if (slots?.loading) {
      const LoadingSlot = slots.loading;
      return (
        <>
          <LoadingSlot
            height={height}
            source={source}
            label={loadingLabel}
          />
          <BarAnimationStyles />
        </>
      );
    }
    if (loadingFallback !== undefined) {
      return <>{loadingFallback}</>;
    }
    return (
      <>
        <LoadingState
          height={height}
          source={source}
          label={loadingLabel}
          className={className}
        />
        <BarAnimationStyles />
      </>
    );
  }

  if (points.length === 0) {
    if (slots?.empty) {
      const EmptySlot = slots.empty;
      return (
        <>
          <EmptySlot height={height} source={source} />
          <BarAnimationStyles />
        </>
      );
    }
    return (
      <>
        <EmptyState height={height} source={source} className={className} />
        <BarAnimationStyles />
      </>
    );
  }

  // Layout-time values that aren't needed for export synthesis:
  const showAllLabels = points.length <= 24;
  const everyNth = showAllLabels ? 1 : Math.ceil(points.length / 12);
  const hasAnyLabel = points.some((p) => p.label !== undefined);

  const figureStyle = {
    ...(accent ? { "--brock-accent": accent } : {}),
    ...(animation?.duration !== undefined
      ? { "--brock-bar-duration": `${animation.duration}ms` }
      : {}),
  } as CSSProperties;
  const animationEnabled = animation?.enabled !== false;

  const showXTicks = !xAxis?.hideTicks;
  const hasYAxisTitle = !!yAxis?.title;
  const yAxisPaddingLeft = showYTicks ? 40 : 0;
  const yAxisTotalLeft = yAxisPaddingLeft + (hasYAxisTitle ? 24 : 0);

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
      className={`brock-chart relative ${className ?? ""}`}
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

      {trend !== undefined && <TrendIndicator value={trend} />}

      <div className="flex">
        {hasYAxisTitle && (
          <div style={{ height }}>
            <YAxisTitle title={yAxis!.title!} />
          </div>
        )}
        {showYTicks && (
          <div style={{ height }}>
            <YAxis
              ticks={yTicks}
              max={max}
              min={min}
              format={effectiveYAxisFormat}
            />
          </div>
        )}

        <ScrollableBarsArea
          scroll={scroll}
          minWidth={
            scroll === "auto"
              ? points.length * minBarWidth +
                Math.max(0, points.length - 1) * effectiveGap
              : undefined
          }
        >
          <div className="flex flex-1 flex-col">
            <div style={{ height }} className="flex">
              <BarsGroup
                points={points}
                max={max}
                min={min}
                allZero={allZero}
                gap={effectiveGap}
                formatValue={effectiveFormatValue}
                ariaLabel={accessibleDescription}
                referenceLine={resolvedReference}
                barRadius={barRadius}
                animationEnabled={animationEnabled}
                showLabels={showLabels}
                labelFormat={effectiveLabelFormat}
                patternStyle={patternStyle}
                bands={bands}
                focusIndex={focusIndex}
                setFocusIndex={setFocusIndex}
                barRefs={barRefs}
                onBarClick={onBarClick}
                onBarHover={onBarHover}
                onBarFocus={onBarFocus}
                tooltipSlot={slots?.tooltip}
                annotations={annotations}
              />
            </div>
            {hasAnyLabel && showXTicks && (
              <XAxis
                points={points}
                gap={effectiveGap}
                everyNth={everyNth}
                paddingLeft={0}
              />
            )}
          </div>
        </ScrollableBarsArea>
      </div>

      {xAxis?.title && (
        <div
          className="mt-2 text-center font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase"
          style={{ paddingLeft: yAxisTotalLeft }}
        >
          {xAxis.title}
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

      <BarAnimationStyles />
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
        className="flex flex-col items-center justify-center gap-2 border-b border-l border-border"
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
 * Visual: a row of dashed ghost bars at varying heights (Tufte "in-progress"
 * dashed pattern, see Brock UI design thesis) + a pixel-font LOADING badge in
 * the top-right corner. Y-axis baseline preserved so the chart frame still
 * suggests a chart will appear here. Honors `prefers-reduced-motion` via the
 * `.brock-skeleton-animated` class.
 *
 * A11y: `role="status"` + `aria-live="polite"` + `aria-label` from
 * `loadingLabel` prop so screen readers announce the change without
 * interrupting the user.
 */
function LoadingState({
  height,
  source,
  label,
  className,
}: {
  height: number;
  source?: string;
  label: string;
  className?: string;
}) {
  // Deterministic ghost-bar heights — a stable sine pattern so the skeleton
  // doesn't visually thrash across re-renders.
  const ghostHeights = [40, 65, 50, 80, 55, 95, 70, 60, 85, 45, 75, 55];
  return (
    <div className={className}>
      <div
        className="relative flex items-end gap-1 border-b border-border"
        style={{ height }}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        {ghostHeights.map((h, i) => (
          <div
            key={i}
            className="brock-skeleton-bar flex-1"
            style={
              {
                height: `${h}%`,
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
        className="flex flex-col items-center justify-center gap-2 border-b border-l border-border px-4 text-center"
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
 * and the spinner span carries a polite live region.
 */
function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="brock-loading-overlay pointer-events-none absolute inset-0 z-20 flex items-start justify-end p-2">
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

function YAxisTitle({ title }: { title: string }) {
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

function TrendIndicator({ value }: { value: number }) {
  const isPositive = value >= 0;
  const label = `${isPositive ? "Trend up" : "Trend down"} ${(
    value * 100
  ).toFixed(1)} percent`;
  return (
    <div className="mb-3 flex justify-end" aria-label={label}>
      <span
        className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
          isPositive ? "text-brock-accent" : "text-muted-foreground"
        }`}
        aria-hidden
      >
        <TrendArrow up={isPositive} className="h-3.5 w-3.5 shrink-0" />
        {isPositive ? "+" : ""}
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

/** Trend arrow (founder-supplied Iconly) — currentColor. */
function TrendArrow({ up, className }: { up: boolean; className?: string }) {
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
      {up ? (
        <>
          <path d="M16.0913 7.09137H20.9999L20.9999 12" />
          <path d="M20.9999 7.09033L13.2269 14.8634L9.13651 10.772L3 16.9086" />
        </>
      ) : (
        <>
          <path d="M16.0903 16.9095L20.9999 16.9096L20.999 12.0009" />
          <path d="M21 16.9086L13.2269 9.13649L9.13654 13.2269L3 7.09033" />
        </>
      )}
    </svg>
  );
}

function YAxis({
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
  // Ticks are positioned by VALUE so the 0-tick sits exactly on the zero
  // baseline when the scale spans negatives. For the all-positive
  // [max, mid, 0] scale this is identical to even spacing.
  const range = max - min;
  return (
    <div
      className="relative h-full w-10 shrink-0 border-e border-border pe-2 font-mono text-[10px] tabular-nums text-muted-foreground/60"
      aria-hidden
    >
      {ticks.map((tick) => {
        const pct = range > 0 ? ((max - tick) / range) * 100 : 100;
        // Edge ticks hug the chart edges (top tick hangs down, bottom tick
        // sits up) — mirrors the old justify-between alignment.
        const translate =
          pct <= 0 ? "0" : pct >= 100 ? "-100%" : "-50%";
        return (
          <div
            key={tick}
            className="absolute start-0 end-2 text-end leading-none"
            style={{ top: `${pct}%`, transform: `translateY(${translate})` }}
          >
            {format(tick)}
          </div>
        );
      })}
    </div>
  );
}

function ScrollableBarsArea({
  scroll,
  minWidth,
  children,
}: {
  scroll: "none" | "auto";
  minWidth: number | undefined;
  children: ReactNode;
}) {
  if (scroll !== "auto") {
    // Default path — BarsGroup uses its own flex-1 to fill the parent flex row.
    return <>{children}</>;
  }
  // Scroll path — overflow wrapper takes the remaining width; the inner shim
  // imposes the minWidth and gives BarsGroup something flex-1 can fill.
  // Focusable: a scroll region must be keyboard-operable (WCAG 2.1.1) —
  // Tab in, then arrow keys scroll natively.
  return (
    <div
      className="brock-bars-scroll flex min-w-0 flex-1 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent"
      tabIndex={0}
      role="group"
      aria-label="Scrollable chart area"
    >
      <div className="flex flex-1" style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}

function BarsGroup({
  points,
  max,
  min,
  allZero,
  gap,
  formatValue,
  ariaLabel,
  referenceLine,
  barRadius,
  animationEnabled,
  showLabels,
  labelFormat,
  patternStyle,
  bands,
  focusIndex,
  setFocusIndex,
  barRefs,
  onBarClick,
  onBarHover,
  onBarFocus,
  tooltipSlot,
  annotations,
}: {
  points: NormalizedPoint[];
  max: number;
  min: number;
  allZero: boolean;
  gap: number;
  formatValue: (v: number, d?: ColumnChartDataPoint) => string;
  ariaLabel: string;
  referenceLine?: { value: number; label?: string };
  barRadius: number;
  animationEnabled: boolean;
  showLabels: boolean;
  labelFormat: (v: number, d?: ColumnChartDataPoint) => string;
  patternStyle: ColumnChartPatternStyle;
  bands: readonly ColumnChartBand[] | undefined;
  focusIndex: number;
  setFocusIndex: (i: number) => void;
  barRefs: React.RefObject<(HTMLDivElement | null)[]>;
  onBarClick?: (
    point: ColumnChartDataPoint,
    index: number,
    event:
      | ReactMouseEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>,
  ) => void;
  onBarHover?: (
    point: ColumnChartDataPoint | null,
    index: number | null,
  ) => void;
  onBarFocus?: (point: ColumnChartDataPoint, index: number) => void;
  tooltipSlot?: ComponentType<ColumnChartTooltipSlotProps>;
  annotations?: readonly ColumnChartAnnotation[];
}) {
  function moveFocus(target: number) {
    const clamped = Math.max(0, Math.min(points.length - 1, target));
    setFocusIndex(clamped);
    barRefs.current[clamped]?.focus();
    onBarFocus?.(toPublicPoint(points[clamped]), clamped);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>, currentIndex: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveFocus(currentIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
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
  // Edge zone size: first/last 15% of bars (min 1) anchor tooltip to that edge
  const edgeZone = Math.max(1, Math.floor(total * 0.15));

  function edgeFor(i: number): EdgePosition {
    if (i < edgeZone) return "left";
    if (i >= total - edgeZone) return "right";
    return "center";
  }

  const showGoal =
    referenceLine && Number.isFinite(referenceLine.value) && !allZero;

  // Zero baseline: with negatives the 1px axis line moves up from the bottom
  // edge to the zero position; the container's bottom edge goes quiet.
  const hasNegative = min < 0;
  const range = max - min;
  const baselineTopPct = hasNegative && range > 0 ? (max / range) * 100 : 100;

  return (
    <div
      className={`brock-bars brock-bars-pattern-${patternStyle} relative flex flex-1 items-end ${
        hasNegative ? "" : "border-b border-border"
      } ${animationEnabled ? "brock-bars-animated" : ""}`}
      style={{ gap }}
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={onBarHover ? () => onBarHover(null, null) : undefined}
    >
      {hasNegative && (
        <div
          className="pointer-events-none absolute right-0 left-0 z-[1] border-t border-border"
          style={{ top: `${baselineTopPct}%` }}
          aria-hidden
        />
      )}
      {bands && bands.length > 0 && (
        <BandsOverlay bands={bands} total={total} gap={gap} />
      )}

      {annotations && annotations.length > 0 && (
        <AnnotationsLayer
          annotations={annotations}
          points={points}
          total={total}
          gap={gap}
          max={max}
          min={min}
        />
      )}

      {points.map((point, i) => (
        <Bar
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          index={i}
          point={point}
          max={max}
          min={min}
          allZero={allZero}
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

      {showGoal && (
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
    <div className="brock-caption mt-2 border-s-2 border-border bg-muted/20 px-3 py-1.5 font-sans text-xs text-muted-foreground italic">
      {text}
    </div>
  );
}

/** Default `watermark` rendering — rotated faint text overlay. */
function Watermark({ text }: { text: string }) {
  return (
    <div
      className="brock-watermark pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
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
 * Resolve an annotation `x` against the normalized points. A number is an
 * INPUT-order index — the annotation travels with its datum through
 * sort/topN. A string matches `key` first (defaults to label), then `label`.
 * Returns the DISPLAY index, or `-1` when the datum is gone (collapsed into
 * "Other" / filtered / out of range) — the caller warns in dev.
 */
function resolveAnnotationIndex(
  x: number | string,
  points: NormalizedPoint[],
): number {
  if (typeof x === "number") {
    return points.findIndex((p) => p.inputIndex === x);
  }
  const target = x.toLowerCase();
  const byKey = points.findIndex((p) => p.key.toLowerCase() === target);
  if (byKey !== -1) return byKey;
  return points.findIndex((p) => (p.label ?? "").toLowerCase() === target);
}

/**
 * AnnotationsLayer — free-floating editorial markup. Each annotation is an
 * absolute-positioned card at the (x, y) point in data space, optionally
 * with a dashed connector line to the exact point.
 *
 * Math mirrors BandsOverlay: every bar covers
 *   width = (100% + gapPx) / total
 * so the bar center is at
 *   left + width / 2 = (idx + 0.5) * (100% + gapPx) / total - gapPx/2
 * y is mapped from data space using the same `max` the bars use.
 */
function AnnotationsLayer({
  annotations,
  points,
  total,
  gap,
  max,
  min,
}: {
  annotations: readonly ColumnChartAnnotation[];
  points: NormalizedPoint[];
  total: number;
  gap: number;
  max: number;
  min: number;
}) {
  const range = max - min;
  if (total <= 0 || range <= 0) return null;
  return (
    <>
      {annotations.map((annotation, i) => {
        const idx = resolveAnnotationIndex(annotation.x, points);
        if (idx === -1 && process.env.NODE_ENV !== "production") {
          console.warn(
            `[brock-ui] ColumnChart: annotation x=${JSON.stringify(annotation.x)} matches no visible bar (collapsed into "Other", filtered, or out of range) and was skipped.`,
          );
        }
        if (idx < 0) return null;
        const xCenter = `calc((${idx} + 0.5) * (100% + ${gap}px) / ${total} - ${gap / 2}px)`;
        // Value-based mapping across the full [min..max] range — negative y
        // annotates below the baseline.
        const yRatio = Math.max(
          0,
          Math.min(1, (max - annotation.y) / range),
        );
        const yPct = `${yRatio * 100}%`;
        const anchor = annotation.anchor ?? "top";
        const cardColor = annotation.color ?? "var(--foreground)";

        // Card position relative to (xCenter, yPx)
        const cardStyle: CSSProperties = (() => {
          switch (anchor) {
            case "bottom":
              return {
                left: xCenter,
                top: yPct,
                transform: "translate(-50%, 8px)",
              };
            case "left":
              return {
                left: xCenter,
                top: yPct,
                transform: "translate(calc(-100% - 8px), -50%)",
              };
            case "right":
              return {
                left: xCenter,
                top: yPct,
                transform: "translate(8px, -50%)",
              };
            case "top":
            default:
              return {
                left: xCenter,
                top: yPct,
                transform: "translate(-50%, calc(-100% - 8px))",
              };
          }
        })();

        return (
          <div
            key={i}
            className="brock-annotation pointer-events-none absolute z-10"
            style={cardStyle}
          >
            <span
              className="rounded-[2px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] tabular-nums whitespace-nowrap"
              style={{ color: cardColor }}
            >
              {annotation.text}
            </span>
            {annotation.arrow && (
              <span
                className="absolute block"
                aria-hidden
                style={{
                  // Tiny dashed line from card edge toward the (xCenter, yPx)
                  // point. Direction depends on anchor.
                  ...(anchor === "top"
                    ? {
                        left: "50%",
                        top: "100%",
                        width: 1,
                        height: 8,
                        borderLeft: "1px dashed currentColor",
                      }
                    : anchor === "bottom"
                      ? {
                          left: "50%",
                          bottom: "100%",
                          width: 1,
                          height: 8,
                          borderLeft: "1px dashed currentColor",
                        }
                      : anchor === "left"
                        ? {
                            top: "50%",
                            left: "100%",
                            width: 8,
                            height: 1,
                            borderTop: "1px dashed currentColor",
                          }
                        : {
                            top: "50%",
                            right: "100%",
                            width: 8,
                            height: 1,
                            borderTop: "1px dashed currentColor",
                          }),
                  color: cardColor,
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function BandsOverlay({
  bands,
  total,
  gap,
}: {
  bands: readonly ColumnChartBand[];
  total: number;
  gap: number;
}) {
  if (total <= 0) return null;
  return (
    <>
      {bands.map((band, i) => {
        const from = Math.max(0, Math.min(total - 1, band.from));
        const to = Math.max(from, Math.min(total - 1, band.to));
        const span = to - from + 1;
        // Each bar occupies (100% + gap) / total of the row (minus the trailing
        // gap baked in). Band left = from * that share; band width = span * that
        // share minus one trailing gap. Exact, no JS measurement required.
        const left = `calc(${from} * (100% + ${gap}px) / ${total})`;
        const width = `calc(${span} * (100% + ${gap}px) / ${total} - ${gap}px)`;
        return (
          <div
            key={i}
            className="brock-band pointer-events-none absolute top-0 bottom-0 z-0"
            style={{
              left,
              width,
              background:
                band.color ?? "color-mix(in oklab, var(--foreground) 6%, transparent)",
            }}
            role="img"
            aria-label={
              band.label
                ? `${band.label} band, bars ${from + 1} to ${to + 1}`
                : `Band, bars ${from + 1} to ${to + 1}`
            }
          >
            {band.label && (
              <span className="absolute top-1 left-1.5 font-mono text-[10px] tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                {band.label}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function ReferenceLineEl({
  line,
  max,
  min,
  formatValue,
}: {
  line: { value: number; label?: string };
  max: number;
  min: number;
  formatValue: (v: number, d?: ColumnChartDataPoint) => string;
}) {
  const range = max - min;
  const topPercent = range > 0 ? ((max - line.value) / range) * 100 : 0;
  const labelText = line.label
    ? `${line.label} · ${formatValue(line.value)}`
    : formatValue(line.value);

  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-[5] border-t border-dashed border-muted-foreground/50"
      style={{ top: `${topPercent}%` }}
      role="img"
      aria-label={`${line.label ?? "Reference"} line at ${formatValue(line.value)}`}
    >
      {/* Label pill at the START edge (not the end): the right corner is the
          busiest — trend indicator + the tallest bars' value labels live there.
          Left-aligned, it sits in clear space; an opaque bordered pill at z-20
          stays readable even when it crosses a bar. */}
      <span className="absolute start-0 -top-2.5 z-20 rounded-[2px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] tabular-nums whitespace-nowrap text-muted-foreground">
        {labelText}
      </span>
    </div>
  );
}

type EdgePosition = "left" | "center" | "right";

function Bar({
  ref,
  index,
  point,
  max,
  min,
  allZero,
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
  formatValue: (v: number, d?: ColumnChartDataPoint) => string;
  isTabStop: boolean;
  edge: EdgePosition;
  barRadius: number;
  animationEnabled: boolean;
  showLabel: boolean;
  labelFormat: (v: number, d?: ColumnChartDataPoint) => string;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  isTapActive: boolean;
  onTap: () => void;
  tooltipSlot?: ComponentType<ColumnChartTooltipSlotProps>;
}) {
  // Two-sided geometry: positive bars hang DOWN-from-top to the baseline
  // (top = (max - v) / range), negative bars start AT the baseline and grow
  // down by |v| / range. With min === 0 this is pixel-identical to the old
  // bottom-anchored layout.
  const range = max - min;
  const isNegative = point.value < 0;
  const barHeight =
    allZero || point.value === 0 || range <= 0
      ? 0
      : Math.max((Math.abs(point.value) / range) * 100, 1);
  const baselinePct = range > 0 ? (max / range) * 100 : 100;
  const barTopPct = isNegative ? baselinePct : baselinePct - barHeight;
  const barEndPct = barTopPct + barHeight;
  // When a bar's outer end hugs the chart edge there's no room ABOVE/BELOW for
  // the value label + note without clipping the header/trend (tall positive)
  // or the x-axis (deep negative) — flip them INSIDE the bar in background
  // color. Tall positive: top within 14% of the chart top. Deep negative:
  // end past 86%.
  const labelInside = isNegative ? barEndPct > 86 : barTopPct < 14;

  const publicDatum = toPublicPoint(point);
  const accessibleName = point.label
    ? `${point.label}: ${formatValue(point.value, publicDatum)}`
    : `Bar ${index + 1}: ${formatValue(point.value, publicDatum)}`;

  // Cursor hints affordance — only when a click handler is wired.
  const cursorClass = onClick ? "cursor-pointer" : "";

  // Tooltip visibility: hover/focus drive it on pointer devices; a tap pins it
  // on touch (where hover/focus don't apply). When pinned we force `flex`.
  const tooltipVisClass = isTapActive
    ? "flex"
    : "hidden group-hover/bar:flex group-focus/bar:flex";

  return (
    <div
      ref={ref}
      className={`group/bar relative flex flex-1 items-end self-stretch rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent ${cursorClass}`}
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
      {/* Labels + notes anchor to the bar's OUTER end (Datawrapper direct-
          labeling convention; matches the SVG export, which always did this).
          Deep negative bars flip the label INSIDE in background color so it
          never collides with the X-axis row below. */}
      {point.note && !allZero && point.value !== 0 && (
        <span
          className={`pointer-events-none absolute right-0 left-0 z-[2] text-center font-mono text-[10px] tracking-wider whitespace-nowrap ${
            labelInside ? "text-background" : "text-foreground"
          }`}
          style={
            isNegative
              ? {
                  top: labelInside
                    ? `calc(${barEndPct}% - ${showLabel ? 28 : 14}px)`
                    : `calc(${barEndPct}% + ${showLabel ? 16 : 3}px)`,
                }
              : {
                  top: labelInside
                    ? `calc(${barTopPct}% + ${showLabel ? 16 : 3}px)`
                    : `calc(${barTopPct}% - ${showLabel ? 30 : 16}px)`,
                }
          }
          aria-hidden
        >
          {point.note}
        </span>
      )}
      {showLabel && !allZero && point.value !== 0 && (
        <span
          className={`pointer-events-none absolute right-0 left-0 z-[2] text-center font-mono text-[10px] tabular-nums whitespace-nowrap ${
            labelInside ? "text-background" : "text-muted-foreground"
          }`}
          style={
            isNegative
              ? {
                  top: labelInside
                    ? `calc(${barEndPct}% - 14px)`
                    : `calc(${barEndPct}% + 2px)`,
                }
              : {
                  top: labelInside
                    ? `calc(${barTopPct}% + 2px)`
                    : `calc(${barTopPct}% - 14px)`,
                }
          }
          aria-hidden
        >
          {labelFormat(point.value, publicDatum)}
        </span>
      )}
      <div
        className={`brock-bar absolute inset-x-0 transition-[filter] duration-150 group-hover/bar:brightness-110 group-focus/bar:brightness-110 ${
          isNegative ? "brock-bar-neg" : ""
        } ${
          point.pattern === "hatched"
            ? "brock-bar-hatched"
            : point.color
              ? ""
              : point.muted
                ? "brock-bar-other"
                : "bg-brock-accent"
        } ${point.highlight ? "brock-bar-highlighted" : ""}`}
        style={
          {
            top: `${barTopPct}%`,
            height: `${barHeight}%`,
            animationDelay: animationEnabled ? `${index * 30}ms` : undefined,
            // Corners round at the OUTER end: top for positive bars,
            // bottom for negative ones (anchored to the baseline).
            ...(isNegative
              ? {
                  borderBottomLeftRadius: barRadius > 0 ? barRadius : undefined,
                  borderBottomRightRadius:
                    barRadius > 0 ? barRadius : undefined,
                }
              : {
                  borderTopLeftRadius: barRadius > 0 ? barRadius : undefined,
                  borderTopRightRadius: barRadius > 0 ? barRadius : undefined,
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
                className={`pointer-events-none absolute bottom-full z-10 mb-2 ${tooltipVisClass} ${TOOLTIP_POSITION[edge]} ${TOOLTIP_ALIGN[edge]}`}
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

const TOOLTIP_POSITION: Record<EdgePosition, string> = {
  left: "left-0",
  right: "right-0",
  center: "left-1/2 -translate-x-1/2",
};

const TOOLTIP_ALIGN: Record<EdgePosition, string> = {
  left: "items-start",
  right: "items-end",
  center: "items-center",
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
    : "hidden group-hover/bar:flex group-focus/bar:flex";
  return (
    <div
      className={`pointer-events-none absolute bottom-full z-10 mb-2 flex-col gap-0.5 rounded-md border border-border bg-background px-2.5 py-1.5 shadow-md ${visClass} ${TOOLTIP_POSITION[edge]} ${TOOLTIP_ALIGN[edge]}`}
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

function XAxis({
  points,
  gap,
  everyNth,
  paddingLeft,
}: {
  points: NormalizedPoint[];
  gap: number;
  everyNth: number;
  paddingLeft: number;
}) {
  return (
    <div
      className="brock-xaxis mt-2 flex font-mono text-[10px] tabular-nums text-muted-foreground/70"
      style={{ gap, paddingLeft }}
      aria-hidden
    >
      {points.map((p, i) => (
        <span key={i} className="flex-1 truncate text-center">
          {i % everyNth === 0 ? (p.label ?? "") : ""}
        </span>
      ))}
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
  formatValue: (v: number, d?: ColumnChartDataPoint) => string;
  /** "Sorted by value… / N categories combined…" — announced with the table. */
  transformNote?: string;
}) {
  // Caption is deliberately short: the figure's figcaption already carries
  // the full description — duplicating it here makes screen readers say
  // everything twice.
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

function BarAnimationStyles() {
  return (
    <style>{`
      .brock-bars-animated .brock-bar {
        animation: brock-bar-rise var(--brock-bar-duration, 400ms) cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
      }
      @keyframes brock-bar-rise {
        from { transform: scaleY(0); transform-origin: bottom; }
        to   { transform: scaleY(1); transform-origin: bottom; }
      }
      /* Negative bars are anchored to the zero baseline at their TOP edge,
         so the rise animation mirrors: they grow downward. */
      .brock-bars-animated .brock-bar-neg {
        animation-name: brock-bar-fall;
      }
      @keyframes brock-bar-fall {
        from { transform: scaleY(0); transform-origin: top; }
        to   { transform: scaleY(1); transform-origin: top; }
      }
      @media (prefers-reduced-motion: reduce) {
        .brock-bars-animated .brock-bar { animation: none; }
      }
      /* "Other" aggregate fill — muted, visually distinct from real categories
         (an aggregate carries less ink). Hatching is NOT used here: that
         encoding is reserved for historical/projected semantics. Themeable via
         --brock-other. */
      .brock-bar-other {
        background: var(--brock-other, color-mix(in oklab, var(--muted-foreground) 35%, transparent));
      }
      /* Hatched fill — stripe or dot pattern at the accent color.
         Outline keeps the bar shape readable when stripes thin out near baseline.
         The shape is set by the parent .brock-bars-pattern-STYLE class so every
         hatched bar in the same chart shares one visual language. */
      .brock-bar-hatched {
        background-color: transparent;
        outline: 1px solid var(--brock-accent);
        outline-offset: -1px;
      }
      .brock-bars-pattern-diagonal .brock-bar-hatched {
        background-image: repeating-linear-gradient(
          45deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-bars-pattern-diagonal-reverse .brock-bar-hatched {
        background-image: repeating-linear-gradient(
          -45deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-bars-pattern-vertical .brock-bar-hatched {
        background-image: repeating-linear-gradient(
          90deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-bars-pattern-horizontal .brock-bar-hatched {
        background-image: repeating-linear-gradient(
          0deg,
          var(--brock-accent) 0, var(--brock-accent) 2px,
          transparent 2px, transparent 6px
        );
      }
      .brock-bars-pattern-dots .brock-bar-hatched {
        background-image: radial-gradient(
          var(--brock-accent) 1.2px, transparent 1.5px
        );
        background-size: 6px 6px;
      }
      /* Per-bar emphasis: a thicker, darker outline + brightness bump. Reads on
         top of solid, hatched, and custom-color bars equally. */
      .brock-bar-highlighted {
        outline: 2px solid var(--foreground, currentColor);
        outline-offset: 1px;
        filter: brightness(1.08);
      }
      /* Skeleton bars (loading state, no data) — solid muted blocks with a
         soft pulse (enterprise skeleton, not a dashed ghost). Disabled under
         prefers-reduced-motion. */
      .brock-skeleton-bar {
        background-color: rgba(127, 127, 127, 0.08);
        background-color: color-mix(in oklab, var(--foreground) 8%, transparent);
        border-radius: 3px 3px 0 0;
        animation: brock-skeleton-pulse 1400ms ease-in-out infinite;
      }
      @keyframes brock-skeleton-pulse {
        0%, 100% { opacity: 0.6; }
        50%      { opacity: 1; }
      }
      /* Loading overlay (refresh-with-data case). Dim layer over the chart so
         the user can still see the previous numbers but knows they're stale. */
      .brock-loading-overlay {
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
        .brock-skeleton-bar,
        .brock-spinner { animation: none; }
      }
      /* Container queries — the chart adapts to ITS OWN width (sidebar widget
         vs full-bleed article), not the viewport. CSS-only tick decimation:
         in narrow containers every other X label hides; in very narrow ones
         only first/last survive. Full labels remain in tooltips + sr-table. */
      @container (max-width: 420px) {
        .brock-xaxis span:nth-child(even) { visibility: hidden; }
      }
      @container (max-width: 240px) {
        .brock-xaxis span { visibility: hidden; }
        .brock-xaxis span:first-child,
        .brock-xaxis span:last-child { visibility: visible; }
      }
      /* Windows High Contrast / forced-colors: backgrounds are normally
         stripped, which would make solid bars invisible. Re-assert bars in
         system colors; hatched stays outlined; the muted "Other" uses
         GrayText so the aggregate-vs-category distinction survives. */
      @media (forced-colors: active) {
        .brock-bar {
          background: CanvasText !important;
          forced-color-adjust: none;
        }
        .brock-bar-hatched {
          background: Canvas !important;
          outline-color: CanvasText !important;
        }
        .brock-bar-other {
          background: GrayText !important;
        }
        .brock-bars,
        .brock-band {
          border-color: CanvasText !important;
        }
      }
      /* Print: strip interactive chrome, expand chart inline, force solid
         backgrounds and visible borders so the printed page reads cleanly.
         Toolbar, loading overlay, hover tooltip — all hidden. */
      @media print {
        .brock-toolbar,
        .brock-loading-overlay,
        .brock-skeleton-bar { display: none !important; }
        /* The watermark is a document-lifecycle marker (DRAFT/CONFIDENTIAL) —
           print is exactly where it must survive. 6% foreground vanishes on
           paper; print it darker. */
        .brock-watermark span { color: rgb(0 0 0 / 0.14) !important; }
        .brock-bars-animated .brock-bar { animation: none !important; }
        .brock-chart {
          break-inside: avoid;
          page-break-inside: avoid;
          background: white !important;
          color: black !important;
        }
        .brock-bars-scroll {
          overflow: visible !important;
        }
      }
    `}</style>
  );
}
