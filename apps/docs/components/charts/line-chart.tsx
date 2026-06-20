/**
 * Line Chart — multi-series time-series lines, editorial-grade.
 *
 * Third component of the Brock UI chart family, inheriting the canonical
 * template from Column Chart (see docs/canon-spec.md §13). Everything in the
 * template-core column is implemented 1:1; the line-specific surface — a
 * continuous X axis, multiple series, and the FT / John Burn-Murdoch canon —
 * was consciously re-decided for the shape.
 *
 * The Brock UI signature moves:
 *
 *  1. Hack mono Y-axis with tabular-nums; --brock-accent for the EMPHASIZED
 *     series, restrained greyscale for the rest (never N loud colors). Light
 *     1px horizontal gridlines — the deliberate, correct deviation from the
 *     bar canon's no-gridline rule (Tufte/FT allow them for time-series).
 *  2. Direct line-end labels (replaces a legend) in each line's color, with
 *     vertical collision avoidance — the FT signature. `legend` can switch to
 *     a top legend or off.
 *  3. ASCII "no data" empty state; dashed line skeleton loading state with
 *     LOADING badge; ▲▲▲ error state with optional Retry button — the same
 *     Tufte-friendly visual language as the rest of the family.
 *  4. Missing data is honest: a `y: null` point breaks the line into
 *     sub-paths (a GAP) — never silently interpolated.
 *  5. FT editorial layers: vertical event markers (`events`), shaded x-range
 *     bands (`bands`, recession shading), a horizontal reference line (fixed
 *     value or computed mean/median over the emphasized series), a last-value
 *     emphasized dot. All reproduced in SVG export.
 *  6. Crosshair + multi-series tooltip: hover snaps a vertical crosshair to
 *     the nearest x and lists every series' value there (swatch + Hack value,
 *     sorted desc). Touch: tap pins, re-tap dismisses.
 *  7. Editorial extras: short `caption` below source; diagonal `watermark`
 *     overlay for DRAFT / CONFIDENTIAL; both reproduced in SVG export.
 *  8. Native export: PNG / SVG / CSV / Copy via the Toolbar slot or the
 *     imperative ref. Zero external deps. The CSV is TIDY (x + one column per
 *     series); the SVG reproduces every data-ink mark.
 *  9. Print stylesheet (@media print) strips toolbar/overlays, forces solid
 *     bg, prevents page-breaks inside the figure, prints the watermark darker.
 * 10. Event callbacks: onPointClick / onPointHover / onPointFocus (point +
 *     series semantics). Imperative ref API:
 *     { exportSVG, exportPNG, exportCSV, copyImage, focusPoint, getSelection }.
 * 11. Full slot system for headless customization: tooltip / empty / loading /
 *     error / toolbar / caption / watermark — each typed with its own props.
 * 12. Forward-compat for Python / WordPress / static embeds: chartType +
 *     dataDescription AI metadata, toJSON() / fromJSON() with a versioned
 *     $schema ("brock-ui/line-chart@1"), and renderToHTMLString().
 *
 * Accessibility:
 *  - Container: role="figure" with aria-labelledby
 *  - Points: aria-roledescription="data point", a single roving tabindex;
 *    Arrow/Home/End move along x within a series, Up/Down switch series
 *    (every series is keyboard-navigable, not just the emphasized one)
 *  - Enter / Space on a focused point invokes onPointClick
 *  - Hidden <table class="sr-only"> summary: one column per series, x rows
 *  - Loading: role="status" aria-live="polite" + aria-busy
 *  - Error:   role="alert"  aria-live="assertive"
 *  - prefers-reduced-motion honored across line-draw + skeleton + spinner
 *  - forced-colors stylesheet (CanvasText emphasized line, GrayText muted)
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
import { useId, useImperativeHandle, useRef, useState } from "react";
import {
  buildLinePathForDom,
  computeStat,
  computeYDomain,
  copyImageToClipboard,
  downloadBlob,
  lastDefinedDom,
  makePointTicks,
  makeXTicks,
  pointsToCSV,
  resolveXValue,
  svgToPNG,
  synthesizeSVG,
  type ExportSeries,
  type SynthesisContext,
} from "./line-chart-export";
import { ChartExportMenu } from "./chart-toolbar";

/* ─── Public enums / unions ─────────────────────────────────────────── */

/** Line interpolation. `linear` is a straight polyline; `monotone` smooths it
 * without overshooting (the safe smoothing — no invented peaks). */
export type LineChartCurve = "linear" | "monotone";

/**
 * X-axis scale.
 *
 *  - `linear` — numeric X, evenly mapped (the default for numeric x).
 *  - `time`   — X values are timestamps (number) or ISO date strings, parsed
 *               DETERMINISTICALLY (never `Date.now()` / arg-less `new Date()`).
 *  - `point`  — categorical / ordinal X (strings), each distinct label mapped
 *               to a stable index (the default when x are strings).
 *
 * When omitted, the scale is inferred: `point` if the x values are strings,
 * otherwise `linear`.
 */
export type LineChartXScale = "linear" | "time" | "point";

/** Y-axis scale. `log` uses a base-10 log axis with 1·2·5 ticks; non-positive
 * values are dropped (with a dev warning) since they have no log position. */
export type LineChartYScale = "linear" | "log";

/** Marker (dot) policy. `auto` shows dots only for sparse series (≤ ~20
 * points) or a single point; `always` / `none` force it. */
export type LineChartMarkers = "auto" | "always" | "none";

/** Where the series legend lives. `direct` is the FT line-end labeling
 * (default for multi-series); `top` is a chip row; `none` hides it. */
export type LineChartLegend = "none" | "direct" | "top";

/* ─── Data model ────────────────────────────────────────────────────── */

/**
 * One data point in object form. Easier to map from DataFrames / SQL rows.
 *
 * `y: null` marks MISSING data — the line BREAKS at that point (a gap), it is
 * never interpolated across. This is the honest representation of a hole in a
 * time series.
 */
export type LineChartDataPoint = {
  /**
   * X position. A number (linear), a timestamp or ISO string (time scale), or
   * an ordinal/category string (point scale). When omitted, the array index
   * is used. All series share one X domain.
   */
  x?: number | string;
  /** Y value, or `null` for a gap (the line breaks — no interpolation). */
  y: number | null;
  /**
   * Stable addressing key for this datum. Defaults to the x value (or the
   * input index). Used by `focusPoint(key)` and `getSelection()`.
   */
  key?: string;
  /**
   * Short annotation for this point — surfaced in the crosshair tooltip and
   * the sr-only table. Travels with the datum, not with chart-level config.
   */
  note?: string;
  /**
   * Arbitrary consumer payload (e.g. the original DataFrame row / API object).
   * Passed through untouched and returned on every callback datum. Must be
   * JSON-safe if you plan to round-trip configs through `toJSON()`.
   */
  meta?: unknown;
};

/**
 * One series. The multi-series form of `data`. Each series shares the chart's
 * single X domain; supply per-series `data` as numbers (paired positionally
 * with the chart's `labels` / `x`), nullable numbers (gaps), or full points.
 */
export type LineChartSeries = {
  /** Display name — also the direct line-end label text and the legend entry. */
  name: string;
  /** The series' values. `null` entries are gaps. */
  data: ReadonlyArray<number | null | LineChartDataPoint>;
  /**
   * Stroke color override (any CSS color). Use sparingly — the emphasis model
   * already paints the focused series in the accent and the rest in restrained
   * greys. Reserve this for brand-mandated series colors.
   */
  color?: string;
  /** Stable addressing key. Defaults to `name`. Matched by `emphasisSeries`. */
  key?: string;
  /** Dashed stroke — the convention for a projected / forecast / estimate line. */
  dashed?: boolean;
  /**
   * Mark this series as emphasized — drawn in the accent color at full weight
   * while the rest mute to grey. Alternative to the chart-level
   * `emphasisSeries` prop (which addresses by key/name).
   */
  emphasis?: boolean;
};

/**
 * A vertical event marker — a thin dashed vertical line at an x position with
 * an optional rotated label at the top. The FT "deployment / announcement /
 * shock" call-out. Reproduced in the SVG export.
 */
export type LineChartEvent = {
  /** X position (same value space as the data's x). */
  x: number | string;
  /** Optional label rendered rotated at the top of the line. */
  label?: string;
  /** Override the line + label color (defaults to muted foreground). */
  color?: string;
};

/**
 * A shaded vertical zone spanning an x range — the FT recession-shading
 * pattern. Sits behind the lines at very low opacity. Reproduced in export.
 */
export type LineChartBand = {
  /** Start x (inclusive), in the data's x value space. */
  from: number | string;
  /** End x (inclusive). */
  to: number | string;
  /** Optional caption rendered at the top-left of the band. */
  label?: string;
  /** Optional CSS background. Defaults to a low-opacity foreground tint. */
  color?: string;
};

/**
 * Reference line drawn horizontally across the chart — a fixed threshold/goal,
 * or a statistic computed over the EMPHASIZED (or first) series. Participates
 * in the Y domain so it always stays visible.
 */
export type LineChartReferenceLine = {
  /**
   * A fixed value, or `{ stat: "mean" | "median" }` computed over the
   * emphasized (or first) series' defined values. Stats auto-label as
   * "Mean"/"Median" when no `label` is given.
   */
  value: number | { stat: "mean" | "median" };
  /** Optional label (e.g. "Target"). Rendered with the value in Hack mono. */
  label?: string;
};

/* ─── Slot prop types ──────────────────────────────────────────────── */

/** One row in the crosshair tooltip — a series and its value at the hovered x. */
export type LineChartTooltipPoint = {
  /** Series display name. */
  series: string;
  /** Resolved value at the hovered x, or null (gap). */
  value: number | null;
  /** Already-formatted value string (null → "—"). */
  formatted: string;
  /** Series stroke color (resolved). */
  color: string;
};

/**
 * Props passed to a custom `slots.tooltip` component. Replaces the default
 * crosshair multi-series tooltip. Position is handled by the wrapper — the
 * slot only renders its content.
 */
export type LineChartTooltipSlotProps = {
  /** Resolved numeric x position the crosshair snapped to. */
  x: number;
  /** Display label for the hovered x (original label when available). */
  xLabel: string;
  /** Every series' value at this x, sorted by value descending. */
  points: LineChartTooltipPoint[];
};

/** Props passed to a custom `slots.empty` component. */
export type LineChartEmptySlotProps = {
  /** Height the slot should occupy (matches the chart's `height` prop). */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
};

/** Props passed to a custom `slots.loading` component. */
export type LineChartLoadingSlotProps = {
  /** Height the slot should occupy. */
  height: number;
  /** Source attribution, if the chart has one. */
  source?: string;
  /** Localized "Loading…" label. */
  label: string;
};

/** Props passed to a custom `slots.error` component. */
export type LineChartErrorSlotProps = {
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
  /** Retry callback, if `onRetry` was passed to LineChart. */
  onRetry?: () => void;
  /** Localized "Retry" label. */
  retryLabel: string;
};

/**
 * Props passed to a custom `slots.toolbar` component. Replaces the default
 * top-right PNG/SVG/CSV/COPY chip bar. The custom toolbar gets bound actions
 * that fire the same export pipeline (so onExport callbacks still fire) plus
 * an `enabled` map matching the `exportable` prop so the slot can hide actions
 * the consumer disabled.
 */
export type LineChartToolbarSlotProps = {
  exportPNG: () => Promise<void>;
  exportSVG: () => void;
  exportCSV: () => void;
  copyImage: () => Promise<void>;
  enabled: { png: boolean; svg: boolean; csv: boolean; copy: boolean };
};

/** Slot props passed to `slots.caption`. The slot has full control. */
export type LineChartCaptionSlotProps = Record<string, never>;

/** Slot props for a `slots.watermark`. Rendered as an absolute overlay. */
export type LineChartWatermarkSlotProps = Record<string, never>;

/**
 * The full slot dictionary. Every slot is optional; provide only the ones you
 * want to override. Defaults stay in place for the rest.
 */
export type LineChartSlots = {
  tooltip?: ComponentType<LineChartTooltipSlotProps>;
  empty?: ComponentType<LineChartEmptySlotProps>;
  loading?: ComponentType<LineChartLoadingSlotProps>;
  error?: ComponentType<LineChartErrorSlotProps>;
  toolbar?: ComponentType<LineChartToolbarSlotProps>;
  caption?: ComponentType<LineChartCaptionSlotProps>;
  watermark?: ComponentType<LineChartWatermarkSlotProps>;
};

/* ─── Callback datum shape ──────────────────────────────────────────── */

/** The datum handed to point callbacks + getSelection — point AND series. */
export type LineChartSelection = {
  /** The series the point belongs to. */
  series: LineChartSeries;
  /** The resolved data point. */
  point: LineChartDataPoint;
  /** Point index within the series' (sorted) points. */
  index: number;
  /** Stable point key. */
  key: string;
};

export type LineChartProps = {
  /**
   * Line data. Three forms accepted:
   *  - `number[]` — a single series; pair with `labels`/`x` for the X axis.
   *  - `LineChartDataPoint[]` — a single series in object form.
   *  - `LineChartSeries[]` — multiple series sharing one X domain.
   *
   * `null` values (in number arrays or as `y: null`) render a GAP — the line
   * breaks rather than interpolating across missing data.
   */
  data:
    | ReadonlyArray<number | null>
    | readonly LineChartDataPoint[]
    | readonly LineChartSeries[];

  /**
   * X-axis labels / positions (only used when `data` is a single series of
   * plain numbers, or points without their own `x`). Strings → `point` scale;
   * numbers → `linear`/`time`.
   */
  labels?: ReadonlyArray<string | number>;

  /** Alias for `labels`. Provided to read naturally for continuous X. */
  x?: ReadonlyArray<string | number>;

  /** Chart height in pixels for the plot + Y-axis area. Default 200. */
  height?: number;

  /**
   * Decimal trend e.g. `0.184` → "↗ +18.4%" (accent if positive, muted if
   * negative). Rendered top-right above the chart.
   */
  trend?: number;

  /**
   * Reference line — a dashed HORIZONTAL line at a fixed value ("Target") or a
   * computed statistic (`{ stat: "mean" }` / `{ stat: "median" }`, calculated
   * over the emphasized — or first — series). Participates in the Y domain so
   * the line stays visible.
   */
  referenceLine?: LineChartReferenceLine;

  /** Source attribution rendered below the chart (FT/Bloomberg pattern). */
  source?: string;

  /**
   * Override the accent color (any CSS color or var). Defaults to
   * `--brock-accent`. Paints the emphasized series + positive trend.
   */
  accent?: string;

  /** Line stroke width in px. Default 1.75. */
  lineWidth?: number;

  /** Line interpolation — `linear` (default) or `monotone` (safe smoothing). */
  curve?: LineChartCurve;

  /**
   * Marker (dot) policy. `auto` (default) shows dots only for sparse series
   * (≤ ~20 points) or a lone point; `always` / `none` force the behavior.
   */
  markers?: LineChartMarkers;

  /**
   * X-axis scale. When omitted, inferred: `point` for string x, else `linear`.
   * `time` parses timestamps / ISO strings deterministically.
   */
  xScale?: LineChartXScale;

  /**
   * Y-axis scale. `linear` (default) or `log` (base-10, 1·2·5 ticks).
   * Non-positive values are dropped on a log scale (with a dev warning).
   */
  yScale?: LineChartYScale;

  /**
   * Light horizontal gridlines. Default `true` — the deliberate, correct
   * deviation from the bar canon's no-gridline rule: Tufte/FT permit faint
   * gridlines for line / time-series reading.
   */
  gridlines?: boolean;

  /**
   * Where the series legend lives. `direct` (default for multi-series) labels
   * each line at its right end in the line's color (the FT signature, replaces
   * a legend). `top` renders a chip row above the chart; `none` hides it.
   */
  legend?: LineChartLegend;

  /**
   * Direct line-end labels on/off. Defaults to `true` for multi-series (and
   * follows `legend === "direct"`). Overlapping labels are nudged apart with a
   * vertical collision-avoidance pass.
   */
  directLabels?: boolean;

  /** Append each series' last value to its direct label. Default `false`. */
  directLabelValues?: boolean;

  /**
   * Emphasize a single series by `key` or `name`: it takes the accent color at
   * full weight while the others mute to grey. Per-series `emphasis: true`
   * works too. When neither is set and there is one series, it is emphasized.
   */
  emphasisSeries?: string;

  /** Draw an emphasized dot + (optionally) label at each series' latest point. */
  lastValueDot?: boolean;

  /**
   * Opt into a zero baseline in the Y domain. By default the Y domain is a
   * "nice" auto range NOT forced to zero (a line chart reads change, not
   * magnitude-from-zero — the FT default). Set true for share/percent data.
   */
  yBaselineZero?: boolean;

  /** Accessible description override. Default: an auto Amy-Cesal summary. */
  description?: string;

  /** Custom formatter for Y-axis tick labels. Default `toLocaleString`. */
  yAxisFormat?: (value: number) => string;

  /** Custom formatter for tooltip / direct-label / reference-line values. */
  formatValue?: (value: number) => string;

  /** Pass-through className for the outer wrapper. */
  className?: string;

  /**
   * Header rendered above the chart. Title in foreground, subtitle in muted.
   * Both optional.
   */
  header?: {
    title?: string;
    subtitle?: string;
  };

  /** X-axis configuration. */
  xAxis?: {
    /** Title rendered below the X-axis tick labels. */
    title?: string;
    /** Hide X-axis tick labels. */
    hideTicks?: boolean;
    /** Approximate tick count. Default 5. */
    ticks?: number;
    /** Custom tick label formatter (receives the resolved numeric x). */
    format?: (value: number) => string;
  };

  /**
   * Y-axis configuration. Unlike the column chart, a line chart's Y domain is
   * a nice auto range (NOT zero-anchored) by default — change is the story.
   */
  yAxis?: {
    /** Title rendered rotated -90° to the left of the Y-axis. */
    title?: string;
    /** Force the domain minimum. */
    min?: number;
    /** Force the domain maximum. */
    max?: number;
    /** Hide Y-axis tick labels. */
    hideTicks?: boolean;
    /** Approximate tick count. Default 4. */
    ticks?: number;
  };

  /**
   * Number formatting applied to Y-axis ticks, tooltip values, direct labels,
   * and the reference line. Explicit `formatValue` / `yAxisFormat` win.
   */
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    /** Decimal places (default 0). */
    decimals?: number;
    /** BCP-47 locale tag (e.g. "en-US"). Defaults to the host locale. */
    locale?: string;
    /** Number notation. `"compact"` → "1.2K". Default `"standard"`. */
    notation?: "standard" | "compact" | "scientific" | "engineering";
    /** Numeric style — `"decimal"` (default), `"currency"`, or `"percent"`. */
    style?: "decimal" | "currency" | "percent";
    /** ISO 4217 currency code (required when style="currency"). */
    currency?: string;
  };

  /** Animation configuration. */
  animation?: {
    /** Enable the line-draw / fade entry animation on mount (default true). */
    enabled?: boolean;
    /** Animation duration in ms (default 600). */
    duration?: number;
  };

  /**
   * Vertical event markers — thin dashed lines at x positions with optional
   * rotated labels. The FT "deployment / shock / announcement" call-out.
   * Reproduced in export.
   */
  events?: readonly LineChartEvent[];

  /**
   * Shaded x-range bands — low-opacity vertical zones (recession shading).
   * Reproduced in export.
   */
  bands?: readonly LineChartBand[];

  /**
   * Mark the chart as loading. `loading=true` + empty data → full skeleton
   * (dashed ghost line, LOADING badge). `loading=true` + data → dim overlay
   * with a corner spinner. Skeleton honors `prefers-reduced-motion`.
   */
  loading?: boolean;

  /**
   * Render the error state. Accepts an `Error`, a string, or a falsy value.
   * When set, replaces the chart entirely (stale data next to an error is
   * misleading). Shows the ASCII warning + message + optional retry button.
   */
  error?: Error | string | null;

  /** Retry callback for the default error state. Shown only when provided. */
  onRetry?: () => void;

  /** Label for the LOADING badge / skeleton ARIA. Default `"Loading…"`. */
  loadingLabel?: string;

  /** Label for the error state ARIA. Default `"Error"`. */
  errorLabel?: string;

  /** Label of the retry button. Default `"Retry"`. */
  retryLabel?: string;

  /** Full override of the default skeleton/loading UI. */
  loadingFallback?: ReactNode;

  /** Full override of the default error UI (node or `(error) => node`). */
  errorFallback?: ReactNode | ((error: Error) => ReactNode);

  /**
   * Enable export and sharing. `false` (default) → no toolbar; `true` → all
   * four actions; object form → only the chosen actions. The imperative ref
   * API is always available regardless.
   */
  exportable?:
    | boolean
    | { png?: boolean; svg?: boolean; csv?: boolean; copy?: boolean };

  /**
   * Base file name for downloads. A string, or `(format) => string`. The right
   * extension (.png/.svg/.csv) is appended automatically. Default `"chart"`.
   */
  exportFileName?: string | ((format: "png" | "svg" | "csv") => string);

  /**
   * Fired AFTER an export completes. Receives the format and the produced
   * artifact: a `Blob` for png/copy, a `string` for svg/csv.
   */
  onExport?: (
    format: "png" | "svg" | "csv" | "copy",
    artifact: Blob | string,
  ) => void;

  /** Ref handle for imperative exports — see `LineChartHandle`. */
  ref?: Ref<LineChartHandle>;

  /**
   * Fired when the user clicks a point (mouse/touch, or Enter/Space on a
   * focused point). Receives the full selection (series + point + index + key)
   * and the originating event.
   */
  onPointClick?: (
    selection: LineChartSelection,
    event:
      | ReactMouseEvent<HTMLButtonElement>
      | KeyboardEvent<HTMLButtonElement>,
  ) => void;

  /**
   * Fired on hover of the nearest x. On leave, `selection` is `null`. Useful
   * for syncing custom legend / detail panels with the hovered x.
   */
  onPointHover?: (selection: LineChartSelection | null) => void;

  /**
   * Fired when keyboard focus moves between points (arrow keys / Home / End /
   * Up / Down to switch series). Tracks the roving-tabindex position.
   */
  onPointFocus?: (selection: LineChartSelection) => void;

  /** Slot dictionary for headless customization — see `LineChartSlots`. */
  slots?: LineChartSlots;

  /**
   * Short editorial caption rendered below the source line. Italic, muted,
   * left-bordered. `slots.caption` takes precedence.
   */
  caption?: string;

  /**
   * Diagonal watermark text rendered as a faint overlay (DRAFT/CONFIDENTIAL).
   * `slots.watermark` takes precedence.
   */
  watermark?: string;

  /**
   * Machine-readable identifier for this chart type. Stamped as
   * `data-chart-type` and included in `toJSON()`. Default `"line"`.
   */
  chartType?: string;

  /**
   * Natural-language description of what the data represents (different from
   * `description`, which is a count-based screen-reader label). Stamped as
   * `data-description` and included in `toJSON()`.
   */
  dataDescription?: string;

  /** Test selector hook forwarded to the outer `<figure>` as `data-testid`. */
  "data-testid"?: string;
};

/**
 * Imperative API exposed via `ref`. Always available — works even while the
 * chart shows loading/error/empty, because the synthesis pulls from the same
 * props the React render uses.
 */
export type LineChartHandle = {
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
  /** Serialize the series to tidy RFC-4180 CSV. Returns the string; optionally downloads. */
  exportCSV: (options?: { fileName?: string; download?: boolean }) => string;
  /** Build a PNG and write it to the system clipboard via the Clipboard API. */
  copyImage: (options?: {
    scale?: number;
    width?: number;
    height?: number;
  }) => Promise<void>;
  /**
   * Move keyboard focus to a point on the emphasized series — by 0-based point
   * index (clamped), or by stable `key` (unknown keys return -1 without
   * moving). Returns the index that received focus, or -1 when no points are
   * rendered (loading/error/empty states).
   */
  focusPoint: (target: number | string) => number;
  /**
   * Return the currently keyboard-focused point + its series, or `null` if no
   * points are rendered. Mirrors the internal roving-tabindex position.
   */
  getSelection: () => LineChartSelection | null;
};

/* ─── Internal normalized shapes ────────────────────────────────────── */

type NormalizedPoint = {
  /** Resolved numeric X coordinate. */
  x: number;
  /** Original (pre-resolution) display label for the x. */
  xLabel: string;
  /** Y value, or null for a gap. */
  y: number | null;
  /** Stable point key. */
  key: string;
  note?: string;
  meta?: unknown;
};

type NormalizedSeries = {
  name: string;
  key: string;
  /** Resolved stroke color (post emphasis resolution). */
  color: string;
  dashed?: boolean;
  emphasis: boolean;
  points: NormalizedPoint[];
  /** The public series shape (for callbacks). */
  source: LineChartSeries;
};

/* ─── Formatting ────────────────────────────────────────────────────── */

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
    // Sign placement: a prefixed format must read −$28k, not $-28k. Format the
    // magnitude and re-attach a typographic minus (U+2212) up front.
    if (prefix && v < 0) {
      return `−${prefix}${Math.abs(v).toLocaleString(locale, options)}${suffix}`;
    }
    return `${prefix}${v.toLocaleString(locale, options)}${suffix}`;
  };
}

/* ─── Data-form discrimination ──────────────────────────────────────── */

function isSeriesForm(
  data: LineChartProps["data"],
): data is readonly LineChartSeries[] {
  return (
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    "data" in (data[0] as object) &&
    Array.isArray((data[0] as LineChartSeries).data)
  );
}

function isPointForm(
  data: LineChartProps["data"],
): data is readonly LineChartDataPoint[] {
  return (
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    "y" in (data[0] as object)
  );
}

/** A restrained categorical greyscale ramp for non-emphasized series. */
const GREY_RAMP = ["#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8"];

/**
 * Normalize the three `data` forms into a uniform series list with resolved
 * x positions, colors (post emphasis), and stable keys. Also infers the X
 * scale when not given, and applies log-scale guards.
 */
function normalize(
  data: LineChartProps["data"],
  labels: ReadonlyArray<string | number> | undefined,
  emphasisSeries: string | undefined,
  accent: string | undefined,
  xScaleProp: LineChartXScale | undefined,
  yScale: LineChartYScale,
): { series: NormalizedSeries[]; xScale: LineChartXScale } {
  const xAxisLabels = labels;

  // Convert raw input into a list of {series, raw-points} before x-resolution.
  let rawSeries: LineChartSeries[];
  if (isSeriesForm(data)) {
    rawSeries = data as LineChartSeries[];
  } else if (isPointForm(data)) {
    rawSeries = [{ name: "Series", data: data as LineChartDataPoint[] }];
  } else {
    rawSeries = [
      { name: "Series", data: data as ReadonlyArray<number | null> },
    ];
  }

  // Infer the X scale: if any resolved x label is a non-numeric string → point.
  const sampleX: Array<number | string | undefined> = [];
  rawSeries.forEach((s) => {
    s.data.forEach((d, i) => {
      const xv =
        typeof d === "object" && d !== null ? d.x : undefined;
      sampleX.push(xv ?? xAxisLabels?.[i]);
    });
  });
  const hasStringX = sampleX.some(
    (v) => typeof v === "string" && Number.isNaN(Number(v)),
  );
  const xScale: LineChartXScale =
    xScaleProp ?? (hasStringX ? "point" : "linear");

  // Ordinal map shared across all series so categories align.
  const ordinalMap = new Map<string, number>();

  let invalidCount = 0;
  let logDropped = 0;

  const series: NormalizedSeries[] = rawSeries.map((s, si) => {
    const emphasis =
      s.emphasis === true ||
      (emphasisSeries !== undefined &&
        (emphasisSeries === s.name || emphasisSeries === (s.key ?? s.name)));

    const points: NormalizedPoint[] = s.data.map((d, i) => {
      let xRaw: number | string | undefined;
      let y: number | null;
      let key: string | undefined;
      let note: string | undefined;
      let meta: unknown;
      if (d === null) {
        xRaw = xAxisLabels?.[i];
        y = null;
      } else if (typeof d === "number") {
        xRaw = xAxisLabels?.[i];
        y = d;
      } else {
        xRaw = d.x ?? xAxisLabels?.[i];
        y = d.y;
        key = d.key;
        note = d.note;
        meta = d.meta;
      }
      const resolved = resolveXValue(xRaw, i, xScale, ordinalMap);
      // Validate / guard the value.
      if (y !== null && (!Number.isFinite(y) || Number.isNaN(y))) {
        invalidCount += 1;
        y = null;
      }
      if (yScale === "log" && y !== null && y <= 0) {
        logDropped += 1;
        y = null;
      }
      return {
        x: resolved.x,
        xLabel: resolved.label,
        y,
        key: key ?? resolved.label ?? String(i),
        note,
        meta,
      };
    });
    points.sort((a, b) => a.x - b.x);

    const color = emphasis
      ? (s.color ?? accent ?? "var(--brock-accent)")
      : (s.color ?? GREY_RAMP[si % GREY_RAMP.length]);

    return {
      name: s.name,
      key: s.key ?? s.name,
      color,
      dashed: s.dashed,
      emphasis,
      points,
      source: {
        name: s.name,
        data: s.data,
        color: s.color,
        key: s.key,
        dashed: s.dashed,
        emphasis: s.emphasis,
      },
    };
  });

  // Single-series default: emphasize it in the accent.
  if (series.length === 1 && !series[0].emphasis) {
    series[0].emphasis = true;
    series[0].color = series[0].source.color ?? accent ?? "var(--brock-accent)";
  }

  if (process.env.NODE_ENV !== "production") {
    if (invalidCount > 0) {
      console.warn(
        `[brock-ui] LineChart: ${invalidCount} non-finite value(s) (NaN/Infinity) were treated as gaps.`,
      );
    }
    if (logDropped > 0) {
      console.warn(
        `[brock-ui] LineChart: ${logDropped} non-positive value(s) were dropped on the log scale (no log position).`,
      );
    }
    const seen = new Set<string>();
    for (const s of series) {
      if (seen.has(s.key.toLowerCase())) {
        console.warn(
          `[brock-ui] LineChart: duplicate series key "${s.key}". emphasisSeries / focusPoint match the first occurrence — set explicit \`key\`s to disambiguate.`,
        );
        break;
      }
      seen.add(s.key.toLowerCase());
    }
  }

  return { series, xScale };
}

/**
 * Public datum shape for one resolved point (handed to callbacks). Strips the
 * internal x-resolution detail down to the documented LineChartDataPoint.
 */
function toPublicPoint(p: NormalizedPoint): LineChartDataPoint {
  return {
    x: p.xLabel,
    y: p.y,
    key: p.key,
    ...(p.note !== undefined ? { note: p.note } : {}),
    ...(p.meta !== undefined ? { meta: p.meta } : {}),
  };
}

/**
 * Auto-generated accessible description following the Amy Cesal alt-text
 * formula: chart type + series + per-series highest/lowest. Computed over the
 * displayed series so screen-reader users get the same picture as sighted ones.
 */
function autoDescription(
  series: NormalizedSeries[],
  source: string | undefined,
  formatValue: (v: number) => string,
): string {
  const base = `Line chart with ${series.length} series`;
  const insights = series
    .map((s) => {
      const defined = s.points.filter((p) => p.y !== null);
      if (defined.length === 0) return `${s.name}: no data`;
      const hi = defined.reduce((a, b) =>
        (b.y as number) > (a.y as number) ? b : a,
      );
      const lo = defined.reduce((a, b) =>
        (b.y as number) < (a.y as number) ? b : a,
      );
      return `${s.name}: high ${formatValue(hi.y as number)} at ${hi.xLabel}, low ${formatValue(lo.y as number)} at ${lo.xLabel}`;
    })
    .join("; ");
  return `${base}. ${insights}${source ? `. Source: ${source}.` : "."}`;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function LineChart({
  data,
  labels,
  x,
  height = 200,
  trend,
  referenceLine,
  source,
  accent,
  lineWidth = 1.75,
  curve = "linear",
  markers = "auto",
  xScale: xScaleProp,
  yScale = "linear",
  gridlines = true,
  legend,
  directLabels,
  directLabelValues = false,
  emphasisSeries,
  lastValueDot = false,
  yBaselineZero = false,
  description,
  yAxisFormat,
  formatValue,
  className,
  header,
  xAxis,
  yAxis,
  numberFormat,
  animation,
  events,
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
  onPointClick,
  onPointHover,
  onPointFocus,
  slots,
  caption,
  watermark,
  chartType = "line",
  dataDescription,
  "data-testid": dataTestId,
}: LineChartProps) {
  const effectiveLabels = labels ?? x;
  const { series, xScale } = normalize(
    data,
    effectiveLabels,
    emphasisSeries,
    accent,
    xScaleProp,
    yScale,
  );

  const captionId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const pointRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving focus along the emphasized series — [seriesIndex, pointIndex].
  const emphasisIdx = Math.max(
    0,
    series.findIndex((s) => s.emphasis),
  );
  const [focus, setFocusState] = useState<{ s: number; p: number }>({
    s: emphasisIdx,
    p: 0,
  });
  const focusRef = useRef(focus);
  const setFocus = (next: { s: number; p: number }) => {
    focusRef.current = next;
    setFocusState(next);
  };

  // Snap focus into range if data shrank/grew under us.
  if (series.length > 0) {
    const sClamp = Math.min(focus.s, series.length - 1);
    const pCount = series[sClamp]?.points.length ?? 0;
    if (focus.s !== sClamp || (pCount > 0 && focus.p >= pCount)) {
      setFocus({ s: sClamp, p: Math.min(focus.p, Math.max(0, pCount - 1)) });
    }
  }

  // Number formatting cascade.
  const baseFormatter = makeFormatter(numberFormat);
  const effectiveFormatValue = formatValue ?? baseFormatter;
  const effectiveYAxisFormat = yAxisFormat ?? baseFormatter;

  // ─── Derived values (lifted above the state machine so the imperative
  //     export API can synthesize even from loading/error/empty). ───
  const refValues = (() => {
    const s = series.find((ser) => ser.emphasis) ?? series[0];
    return s ? s.points.filter((p) => p.y !== null).map((p) => p.y as number) : [];
  })();
  const resolvedReference = referenceLine
    ? {
        value:
          typeof referenceLine.value === "number"
            ? referenceLine.value
            : computeStat(refValues, referenceLine.value.stat),
        label:
          referenceLine.label ??
          (typeof referenceLine.value === "object"
            ? referenceLine.value.stat === "mean"
              ? "Mean"
              : "Median"
            : undefined),
      }
    : undefined;

  // X domain across all series.
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = allX.length > 0 ? Math.min(...allX) : 0;
  const xMax = allX.length > 0 ? Math.max(...allX) : 1;

  // Y domain (nice; includes the reference line; not zero-anchored by default).
  const allY = series.flatMap((s) =>
    s.points.filter((p) => p.y !== null).map((p) => p.y as number),
  );
  const refV =
    resolvedReference && Number.isFinite(resolvedReference.value)
      ? resolvedReference.value
      : undefined;
  const ys = refV !== undefined ? [...allY, refV] : allY;
  const {
    min: yMin,
    max: yMax,
    ticks: yTicks,
  } = computeYDomain(ys, yAxis, yScale, yBaselineZero);

  // Categorical/ordinal X: ticks land ON the categories (never interpolated
  // between them). Numeric/time X: evenly-spaced ticks across the domain.
  const xTicks =
    xScale === "point"
      ? makePointTicks(
          series.flatMap((s) => s.points.map((p) => p.x)),
          xAxis?.ticks ?? 12,
        )
      : makeXTicks(xMin, xMax, xAxis?.ticks ?? 5);

  const showMarkers =
    markers === "always" ||
    (markers === "auto" &&
      series.some(
        (s) => s.points.filter((p) => p.y !== null).length <= 20,
      ));

  const effectiveLegend: LineChartLegend =
    legend ?? (series.length > 1 ? "direct" : "none");
  const effectiveDirectLabels =
    directLabels ?? effectiveLegend === "direct";

  const showYTicks = yAxis?.hideTicks !== true;
  const showXTicks = xAxis?.hideTicks !== true;

  const accessibleDescription =
    description ?? autoDescription(series, source, effectiveFormatValue);

  // Resolve events / bands x positions deterministically.
  const ordinalForOverlays = new Map<string, number>();
  // Pre-seed the ordinal map so overlay categories align with the data's.
  if (xScale === "point") {
    series.forEach((s) =>
      s.points.forEach((p) => {
        if (!ordinalForOverlays.has(p.xLabel)) {
          ordinalForOverlays.set(p.xLabel, p.x);
        }
      }),
    );
  }
  const resolvedEvents = events?.map((e) => ({
    x: resolveXValue(e.x, 0, xScale, ordinalForOverlays).x,
    label: e.label,
    color: e.color,
  }));
  const resolvedBands = bands?.map((b) => ({
    from: resolveXValue(b.from, 0, xScale, ordinalForOverlays).x,
    to: resolveXValue(b.to, 0, xScale, ordinalForOverlays).x,
    label: b.label,
    color: b.color,
  }));

  // ─── Export context builder (reused by the ref API AND the Toolbar). ───
  const getExportContext = (
    width: number,
    hgt: number,
  ): SynthesisContext => {
    const resolve = (varName: string, fallback: string): string => {
      if (typeof window === "undefined") return fallback;
      const root = figureRef.current ?? document.documentElement;
      const v = getComputedStyle(root).getPropertyValue(varName).trim();
      return v || fallback;
    };
    const resolvedAccent = accent ?? resolve("--brock-accent", "#F54900");
    const seriesMuted = resolve("--muted-foreground", "#a1a1aa");
    const exportSeries: ExportSeries[] = series.map((s, si) => ({
      name: s.name,
      key: s.key,
      color: s.emphasis
        ? (s.source.color ?? resolvedAccent)
        : (s.source.color ?? GREY_RAMP[si % GREY_RAMP.length]),
      dashed: s.dashed,
      emphasis: s.emphasis,
      points: s.points.map((p) => ({
        x: p.x,
        y: p.y,
        xLabel: p.xLabel,
      })),
    }));
    return {
      width,
      height: hgt,
      series: exportSeries,
      xMin,
      xMax,
      yMin,
      yMax,
      yScale,
      xScale,
      curve,
      lineWidth,
      showMarkers,
      lastValueDot,
      gridlines,
      directLabels: effectiveDirectLabels,
      directLabelValues,
      accent: resolvedAccent,
      seriesMuted,
      foreground: resolve("--foreground", "#0a0a0a"),
      muted: resolve("--muted-foreground", "#666666"),
      border: resolve("--border", "#e5e5e5"),
      background: resolve("--background", "#ffffff"),
      yTicks,
      yAxisFormat: effectiveYAxisFormat,
      formatValue: effectiveFormatValue,
      xTicks,
      xAxisFormat: xAxis?.format ?? domXAxisFormat(xScale, effectiveFormatValue, series),
      showYTicks,
      showXTicks,
      yAxisTitle: yAxis?.title,
      xAxisTitle: xAxis?.title,
      headerTitle: header?.title,
      headerSubtitle: header?.subtitle,
      trend,
      referenceLine: resolvedReference,
      events: resolvedEvents,
      bands: resolvedBands,
      source,
      caption,
      watermark,
      description: accessibleDescription,
    };
  };

  const getExportDimensions = (opts?: {
    width?: number;
    height?: number;
  }): { width: number; height: number } => {
    const live = figureRef.current?.getBoundingClientRect();
    const w = opts?.width ?? (live && live.width > 0 ? live.width : 800);
    const h = opts?.height ?? (live && live.height > 0 ? live.height : 400);
    return { width: Math.round(w), height: Math.round(h) };
  };

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

  const buildCSVSeries = (): ExportSeries[] =>
    series.map((s) => ({
      name: s.name,
      key: s.key,
      color: s.color,
      dashed: s.dashed,
      emphasis: s.emphasis,
      points: s.points.map((p) => ({ x: p.x, y: p.y, xLabel: p.xLabel })),
    }));

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
        const csv = pointsToCSV(buildCSVSeries());
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
      focusPoint: (target) => {
        const s = series[focusRef.current.s] ?? series[emphasisIdx];
        if (!s || s.points.length === 0) return -1;
        const sIdx = series.indexOf(s);
        let p: number;
        if (typeof target === "string") {
          const t = target.toLowerCase();
          p = s.points.findIndex((pt) => pt.key.toLowerCase() === t);
          if (p === -1) return -1;
        } else {
          p = Math.max(0, Math.min(s.points.length - 1, target));
        }
        setFocus({ s: sIdx, p });
        if (typeof window !== "undefined") {
          requestAnimationFrame(() => {
            pointRefs.current[flatIndex(series, sIdx, p)]?.focus();
          });
        }
        onPointFocus?.(makeSelection(series, sIdx, p));
        return p;
      },
      getSelection: () => {
        if (series.length === 0) return null;
        const { s, p } = focusRef.current;
        const sIdx = Math.max(0, Math.min(series.length - 1, s));
        const pIdx = Math.max(
          0,
          Math.min((series[sIdx]?.points.length ?? 1) - 1, p),
        );
        if (!series[sIdx] || series[sIdx].points.length === 0) return null;
        return makeSelection(series, sIdx, pIdx);
      },
    }),
    // Closure captures the latest props/derived values on every render —
    // intentional, so exports always reflect the current chart state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accent,
      curve,
      lineWidth,
      showMarkers,
      lastValueDot,
      gridlines,
      effectiveDirectLabels,
      directLabelValues,
      effectiveFormatValue,
      effectiveYAxisFormat,
      exportFileName,
      header?.subtitle,
      header?.title,
      yMin,
      yMax,
      xMin,
      xMax,
      yScale,
      xScale,
      resolvedReference,
      resolvedEvents,
      resolvedBands,
      onExport,
      series,
      source,
      trend,
      xAxis?.hideTicks,
      xAxis?.title,
      yAxis?.hideTicks,
      yAxis?.title,
      yTicks,
      xTicks,
      accessibleDescription,
      focus,
      onPointFocus,
      caption,
      watermark,
    ],
  );

  // ─── State machine priority (mirrors the column chart) ───
  const normalizedError = toError(error);
  if (normalizedError) {
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
          <LineAnimationStyles />
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
        <LineAnimationStyles />
      </>
    );
  }

  const hasAnyPoint = series.some((s) =>
    s.points.some((p) => p.y !== null),
  );

  if (loading && !hasAnyPoint) {
    if (slots?.loading) {
      const LoadingSlot = slots.loading;
      return (
        <>
          <LoadingSlot height={height} source={source} label={loadingLabel} />
          <LineAnimationStyles />
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
        <LineAnimationStyles />
      </>
    );
  }

  if (!hasAnyPoint) {
    if (slots?.empty) {
      const EmptySlot = slots.empty;
      return (
        <>
          <EmptySlot height={height} source={source} />
          <LineAnimationStyles />
        </>
      );
    }
    return (
      <>
        <EmptyState height={height} source={source} className={className} />
        <LineAnimationStyles />
      </>
    );
  }

  const figureStyle = {
    ...(accent ? { "--brock-accent": accent } : {}),
    ...(animation?.duration !== undefined
      ? { "--brock-line-duration": `${animation.duration}ms` }
      : {}),
  } as CSSProperties;
  const animationEnabled = animation?.enabled !== false;

  const hasYAxisTitle = !!yAxis?.title;
  const yAxisTickWidth = showYTicks ? 44 : 0;
  const yAxisTitleWidth = hasYAxisTitle ? 24 : 0;

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
    const csv = pointsToCSV(buildCSVSeries());
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

  const xAxisFormat =
    xAxis?.format ?? domXAxisFormat(xScale, effectiveFormatValue, series);

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

      {slots?.watermark ? (
        (() => {
          const WatermarkSlot = slots.watermark;
          return (
            <div className="pointer-events-none absolute inset-0 z-10">
              <WatermarkSlot />
            </div>
          );
        })()
      ) : watermark ? (
        <Watermark text={watermark} />
      ) : null}

      {loading && <LoadingOverlay label={loadingLabel} />}

      {(header?.title || header?.subtitle) && (
        <Header title={header.title} subtitle={header.subtitle} />
      )}

      {trend !== undefined && <TrendIndicator value={trend} />}

      {effectiveLegend === "top" && <TopLegend series={series} />}

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
              yMin={yMin}
              yMax={yMax}
              yScale={yScale}
              format={effectiveYAxisFormat}
            />
          </div>
        )}

        <Plot
          series={series}
          height={height}
          xMin={xMin}
          xMax={xMax}
          yMin={yMin}
          yMax={yMax}
          yScale={yScale}
          curve={curve}
          lineWidth={lineWidth}
          showMarkers={showMarkers}
          lastValueDot={lastValueDot}
          gridlines={gridlines}
          directLabels={effectiveDirectLabels}
          directLabelValues={directLabelValues}
          ticks={yTicks}
          xTicks={xTicks}
          xAxisFormat={xAxisFormat}
          showXTicks={showXTicks}
          referenceLine={resolvedReference}
          events={resolvedEvents}
          bands={resolvedBands}
          formatValue={effectiveFormatValue}
          ariaLabel={accessibleDescription}
          animationEnabled={animationEnabled}
          focus={focus}
          setFocus={setFocus}
          pointRefs={pointRefs}
          onPointClick={onPointClick}
          onPointHover={onPointHover}
          onPointFocus={onPointFocus}
          tooltipSlot={slots?.tooltip}
        />
      </div>

      {xAxis?.title && (
        <div
          className="mt-2 text-center font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase"
          style={{ paddingLeft: yAxisTickWidth + yAxisTitleWidth }}
        >
          {xAxis.title}
        </div>
      )}

      {source && <ChartSource source={source} />}

      {slots?.caption ? (
        (() => {
          const CaptionSlot = slots.caption;
          return <CaptionSlot />;
        })()
      ) : caption ? (
        <Caption text={caption} />
      ) : null}

      <figcaption id={captionId} className="sr-only">
        {accessibleDescription}
      </figcaption>

      <DataTableSummary series={series} formatValue={effectiveFormatValue} />

      <LineAnimationStyles />
    </figure>
  );
}

/* ─── Helpers shared between render + ref ────────────────────────────── */

/** Flat focusable-button index for a (seriesIndex, pointIndex) on emphasis. */
function flatIndex(
  series: NormalizedSeries[],
  sIdx: number,
  pIdx: number,
): number {
  let n = 0;
  for (let i = 0; i < sIdx; i += 1) n += series[i].points.length;
  return n + pIdx;
}

function makeSelection(
  series: NormalizedSeries[],
  sIdx: number,
  pIdx: number,
): LineChartSelection {
  const s = series[sIdx];
  return {
    series: s.source,
    point: toPublicPoint(s.points[pIdx]),
    index: pIdx,
    key: s.points[pIdx].key,
  };
}

/** Default X tick formatter — labels for point/time, formatted for numeric. */
function domXAxisFormat(
  xScale: LineChartXScale,
  formatValue: (v: number) => string,
  series: NormalizedSeries[],
): (v: number) => string {
  // Build a numeric-x → label lookup from the data.
  const labelMap = new Map<number, string>();
  for (const s of series) {
    for (const p of s.points) {
      if (!labelMap.has(p.x)) labelMap.set(p.x, p.xLabel);
    }
  }
  return (v: number) => {
    const exact = labelMap.get(v);
    if (exact) return exact;
    if (xScale === "time") {
      // Deterministic ISO slice from an input-derived timestamp.
      return new Date(v).toISOString().slice(0, 10);
    }
    return formatValue(v);
  };
}

function toError(input: Error | string | null | undefined): Error | null {
  if (!input) return null;
  if (input instanceof Error) return input;
  return new Error(String(input));
}

function ensureExt(name: string, format: "png" | "svg" | "csv"): string {
  return name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
}

type ToolbarConfig = { png: boolean; svg: boolean; csv: boolean; copy: boolean };

function resolveToolbar(
  input: boolean | Partial<ToolbarConfig> | undefined,
): ToolbarConfig | null {
  if (!input) return null;
  if (input === true) return { png: true, svg: true, csv: true, copy: true };
  const cfg: ToolbarConfig = {
    png: !!input.png,
    svg: !!input.svg,
    csv: !!input.csv,
    copy: !!input.copy,
  };
  if (!cfg.png && !cfg.svg && !cfg.csv && !cfg.copy) return null;
  return cfg;
}

/* ─── Y/X pixel mapping (DOM render mirrors the export math) ─────────── */

function yToPercent(
  v: number,
  yMin: number,
  yMax: number,
  yScale: LineChartYScale,
): number {
  if (yScale === "log") {
    const lo = Math.log10(Math.max(yMin, Number.MIN_VALUE));
    const hi = Math.log10(Math.max(yMax, Number.MIN_VALUE));
    const span = hi - lo || 1;
    const lv = Math.log10(Math.max(v, Number.MIN_VALUE));
    return (1 - (lv - lo) / span) * 100;
  }
  const span = yMax - yMin || 1;
  return (1 - (v - yMin) / span) * 100;
}

function xToPercent(v: number, xMin: number, xMax: number): number {
  const span = xMax - xMin || 1;
  return ((v - xMin) / span) * 100;
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

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
  // Deterministic ghost polyline — a stable sine pattern.
  const ghost = [70, 52, 64, 40, 55, 35, 48, 30, 42, 28, 36, 22];
  const pts = ghost
    .map((h, i) => `${(i / (ghost.length - 1)) * 100},${h}`)
    .join(" ");
  return (
    <div className={className}>
      <div
        className="relative border-b border-l border-border"
        style={{ height }}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        <svg
          className="brock-skeleton-line h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polyline
            points={pts}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="sr-only">{label}</span>
      </div>
      {source && <ChartSource source={source} />}
    </div>
  );
}

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

function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
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

/** Top legend chip row — used when `legend === "top"`. */
function TopLegend({ series }: { series: NormalizedSeries[] }) {
  return (
    <div
      className="mb-2 flex flex-wrap gap-x-4 gap-y-1"
      role="list"
      aria-label="Series legend"
    >
      {series.map((s) => (
        <span
          key={s.key}
          className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground"
          role="listitem"
        >
          <span
            className="inline-block h-0.5 w-4"
            style={{ backgroundColor: s.color }}
            aria-hidden
          />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function YAxis({
  ticks,
  yMin,
  yMax,
  yScale,
  format,
}: {
  ticks: number[];
  yMin: number;
  yMax: number;
  yScale: LineChartYScale;
  format: (v: number) => string;
}) {
  return (
    <div
      className="relative h-full w-11 shrink-0 border-e border-border pe-2 font-mono text-[10px] tabular-nums text-muted-foreground/60"
      aria-hidden
    >
      {ticks.map((tick) => {
        const pct = yToPercent(tick, yMin, yMax, yScale);
        const translate = pct <= 0 ? "0" : pct >= 100 ? "-100%" : "-50%";
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

/* ─── Plot (the lines area) ─────────────────────────────────────────── */

function Plot({
  series,
  height,
  xMin,
  xMax,
  yMin,
  yMax,
  yScale,
  curve,
  lineWidth,
  showMarkers,
  lastValueDot,
  gridlines,
  directLabels,
  directLabelValues,
  ticks,
  xTicks,
  xAxisFormat,
  showXTicks,
  referenceLine,
  events,
  bands,
  formatValue,
  ariaLabel,
  animationEnabled,
  focus,
  setFocus,
  pointRefs,
  onPointClick,
  onPointHover,
  onPointFocus,
  tooltipSlot,
}: {
  series: NormalizedSeries[];
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  yScale: LineChartYScale;
  curve: LineChartCurve;
  lineWidth: number;
  showMarkers: boolean;
  lastValueDot: boolean;
  gridlines: boolean;
  directLabels: boolean;
  directLabelValues: boolean;
  ticks: number[];
  xTicks: number[];
  xAxisFormat: (v: number) => string;
  showXTicks: boolean;
  referenceLine?: { value: number; label?: string };
  events?: Array<{ x: number; label?: string; color?: string }>;
  bands?: Array<{ from: number; to: number; label?: string; color?: string }>;
  formatValue: (v: number) => string;
  ariaLabel: string;
  animationEnabled: boolean;
  focus: { s: number; p: number };
  setFocus: (next: { s: number; p: number }) => void;
  pointRefs: React.RefObject<(HTMLButtonElement | null)[]>;
  onPointClick?: (
    selection: LineChartSelection,
    event:
      | ReactMouseEvent<HTMLButtonElement>
      | KeyboardEvent<HTMLButtonElement>,
  ) => void;
  onPointHover?: (selection: LineChartSelection | null) => void;
  onPointFocus?: (selection: LineChartSelection) => void;
  tooltipSlot?: ComponentType<LineChartTooltipSlotProps>;
}) {
  // The union of resolved x positions across all series (sorted).
  const xUnion = (() => {
    const set = new Set<number>();
    series.forEach((s) => s.points.forEach((p) => set.add(p.x)));
    return [...set].sort((a, b) => a - b);
  })();

  // Hover crosshair: nearest x to the pointer (null = no hover).
  const [hoverX, setHoverX] = useState<number | null>(null);
  // Touch: a pinned x (tap to pin, re-tap to dismiss).
  const [pinnedX, setPinnedX] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeX = pinnedX ?? hoverX;

  function nearestX(clientX: number): number | null {
    const el = containerRef.current;
    if (!el || xUnion.length === 0) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = (clientX - rect.left) / rect.width;
    const target = xMin + ratio * (xMax - xMin);
    let best = xUnion[0];
    let bestDist = Math.abs(best - target);
    for (const x of xUnion) {
      const d = Math.abs(x - target);
      if (d < bestDist) {
        best = x;
        bestDist = d;
      }
    }
    return best;
  }

  function handleMove(e: ReactMouseEvent<HTMLDivElement>) {
    const x = nearestX(e.clientX);
    setHoverX(x);
    if (x !== null && onPointHover) {
      // Report the emphasized series' point at this x (if defined).
      const sel = selectionAtX(series, x);
      onPointHover(sel);
    }
  }
  function handleLeave() {
    setHoverX(null);
    onPointHover?.(null);
  }
  function handleTap(e: ReactMouseEvent<HTMLDivElement>) {
    const x = nearestX(e.clientX);
    setPinnedX((prev) => (prev === x ? null : x));
  }

  // ─── Keyboard nav along the emphasized series; Up/Down switch series. ───
  function moveFocus(next: { s: number; p: number }) {
    const sClamp = Math.max(0, Math.min(series.length - 1, next.s));
    const pCount = series[sClamp].points.length;
    const pClamp = Math.max(0, Math.min(pCount - 1, next.p));
    setFocus({ s: sClamp, p: pClamp });
    pointRefs.current[flatIndex(series, sClamp, pClamp)]?.focus();
    onPointFocus?.(makeSelection(series, sClamp, pClamp));
  }

  function handleKey(e: KeyboardEvent<HTMLButtonElement>, s: number, p: number) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus({ s, p: p + 1 });
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus({ s, p: p - 1 });
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus({ s: s - 1, p });
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus({ s: s + 1, p });
        break;
      case "Home":
        e.preventDefault();
        moveFocus({ s, p: 0 });
        break;
      case "End":
        e.preventDefault();
        moveFocus({ s, p: series[s].points.length - 1 });
        break;
      case "Enter":
      case " ":
        if (onPointClick) {
          e.preventDefault();
          onPointClick(makeSelection(series, s, p), e);
        }
        break;
    }
  }

  const tooltipData = activeX !== null ? tooltipAtX(series, activeX, formatValue) : null;

  // Reserve a right gutter for the direct line-end labels so they sit INSIDE
  // the figure (and the SVG/PNG export) instead of overflowing into whatever
  // is to the right. Sized to the longest label; the plot + x-axis shrink to
  // the remaining width so the line ends leave room for the label beside them.
  const directLabelGutter = (() => {
    if (!directLabels) return 0;
    let maxChars = 0;
    for (const s of series) {
      const last = lastDefinedDom(s.points);
      if (!last || last.y === null) continue;
      const text = directLabelValues ? `${s.name} ${formatValue(last.y)}` : s.name;
      maxChars = Math.max(maxChars, text.length);
    }
    // Hack mono at 10px ≈ 6.2px/char, + the ml-1 (4px) offset + a little slack.
    return maxChars > 0 ? Math.ceil(maxChars * 6.2) + 12 : 0;
  })();

  return (
    <div
      className="flex flex-1 flex-col"
      style={directLabelGutter ? { paddingRight: directLabelGutter } : undefined}
    >
      <div
        ref={containerRef}
        className={`brock-plot relative ${animationEnabled ? "brock-plot-animated" : ""}`}
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={handleTap}
      >
        {/* Shaded x-range bands (behind everything). */}
        {bands?.map((band, i) => {
          const x1 = xToPercent(
            Math.max(xMin, Math.min(xMax, band.from)),
            xMin,
            xMax,
          );
          const x2 = xToPercent(
            Math.max(xMin, Math.min(xMax, band.to)),
            xMin,
            xMax,
          );
          const left = Math.min(x1, x2);
          const w = Math.abs(x2 - x1);
          return (
            <div
              key={i}
              className="brock-band pointer-events-none absolute top-0 bottom-0 z-0"
              style={{
                left: `${left}%`,
                width: `${w}%`,
                background:
                  band.color ??
                  "color-mix(in oklab, var(--foreground) 5%, transparent)",
              }}
              role="img"
              aria-label={band.label ? `${band.label} band` : "Highlighted range"}
            >
              {band.label && (
                <span className="absolute top-1 left-1.5 font-mono text-[10px] tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                  {band.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Light horizontal gridlines. */}
        {gridlines &&
          ticks.map((tick) => {
            const top = yToPercent(tick, yMin, yMax, yScale);
            return (
              <div
                key={tick}
                className="brock-gridline pointer-events-none absolute right-0 left-0 z-0 border-t border-border/60"
                style={{ top: `${top}%` }}
                aria-hidden
              />
            );
          })}

        {/* Baseline. */}
        <div
          className="pointer-events-none absolute right-0 left-0 bottom-0 z-[1] border-b border-border"
          aria-hidden
        />

        {/* Reference line (horizontal dashed). */}
        {referenceLine && Number.isFinite(referenceLine.value) && (
          <div
            className="pointer-events-none absolute right-0 left-0 z-[5] border-t border-dashed border-muted-foreground/50"
            style={{
              top: `${yToPercent(referenceLine.value, yMin, yMax, yScale)}%`,
            }}
            role="img"
            aria-label={`${referenceLine.label ?? "Reference"} line at ${formatValue(
              referenceLine.value,
            )}`}
          >
            <span className="absolute start-0 -top-2.5 z-20 rounded-[2px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] tabular-nums whitespace-nowrap text-muted-foreground">
              {referenceLine.label
                ? `${referenceLine.label} · ${formatValue(referenceLine.value)}`
                : formatValue(referenceLine.value)}
            </span>
          </div>
        )}

        {/* Vertical event markers. */}
        {events?.map((evt, i) => {
          if (evt.x < xMin || evt.x > xMax) return null;
          const left = xToPercent(evt.x, xMin, xMax);
          return (
            <div
              key={i}
              className="pointer-events-none absolute top-0 bottom-0 z-[4] border-l border-dashed"
              style={{
                left: `${left}%`,
                borderColor: evt.color ?? "var(--muted-foreground)",
              }}
              role="img"
              aria-label={evt.label ? `Event: ${evt.label}` : "Event marker"}
            >
              {evt.label && (
                <span
                  className="absolute -top-1 left-1 origin-top-left font-mono text-[9px] tracking-wider whitespace-nowrap uppercase"
                  style={{
                    transform: "rotate(-90deg) translateX(-100%)",
                    color: evt.color ?? "var(--muted-foreground)",
                  }}
                >
                  {evt.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Crosshair at the active (hover/pinned) x. */}
        {activeX !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[6] border-l border-foreground/30"
            style={{ left: `${xToPercent(activeX, xMin, xMax)}%` }}
            aria-hidden
          />
        )}

        {/* The series lines (SVG overlay). */}
        <svg
          className="pointer-events-none absolute inset-0 z-[3] h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {series.map((s) => {
            const d = buildLinePathForDom(
              s.points,
              (v) => xToPercent(v, xMin, xMax),
              (v) => yToPercent(v, yMin, yMax, yScale),
              curve,
            );
            if (!d) return null;
            return (
              <path
                key={s.key}
                className="brock-line"
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={lineWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "5 3" : undefined}
                vectorEffect="non-scaling-stroke"
                style={{ "--brock-line-len": "1" } as CSSProperties}
              />
            );
          })}
        </svg>

        {/* Markers + last-value dots + focusable point buttons. */}
        {series.map((s, si) =>
          s.points.map((p, pi) => {
            if (p.y === null) return null;
            const left = xToPercent(p.x, xMin, xMax);
            const top = yToPercent(p.y, yMin, yMax, yScale);
            const isLast = lastDefinedDom(s.points) === p;
            const isEmphasis = s.emphasis;
            // Mouse interactivity stays on the emphasized series so the
            // crosshair owns hover/click across the muted series. Keyboard nav
            // reaches EVERY series — Up/Down switch series, so every point must
            // accept focus + key events. (pointer-events:none blocks the mouse
            // but NOT programmatic focus or keydown — the muted points stay
            // keyboard-navigable while the crosshair keeps the pointer.)
            const isMouseInteractive = isEmphasis;
            const isTabStop = focus.s === si && focus.p === pi;
            const showDot =
              showMarkers || (lastValueDot && isLast);
            return (
              <button
                key={`${s.key}-${pi}`}
                ref={(el) => {
                  pointRefs.current[flatIndex(series, si, pi)] = el;
                }}
                type="button"
                className="brock-point absolute z-[7] -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: showDot ? lineWidth * 2 + 3 : 10,
                  height: showDot ? lineWidth * 2 + 3 : 10,
                  background: showDot ? s.color : "transparent",
                  border:
                    lastValueDot && isLast
                      ? "1.5px solid var(--background)"
                      : undefined,
                  pointerEvents: isMouseInteractive ? "auto" : "none",
                }}
                tabIndex={isTabStop ? 0 : -1}
                aria-label={`${s.name}, ${p.xLabel}: ${formatValue(p.y)}`}
                aria-roledescription="data point"
                onKeyDown={(e) => handleKey(e, si, pi)}
                onFocus={() => {
                  setFocus({ s: si, p: pi });
                  onPointFocus?.(makeSelection(series, si, pi));
                }}
                onClick={
                  onPointClick
                    ? (e) => {
                        e.stopPropagation();
                        onPointClick(makeSelection(series, si, pi), e);
                      }
                    : undefined
                }
              />
            );
          }),
        )}

        {/* Direct line-end labels (FT signature). */}
        {directLabels && <DirectLabels series={series} yMin={yMin} yMax={yMax} yScale={yScale} formatValue={formatValue} withValues={directLabelValues} />}

        {/* Crosshair tooltip. */}
        {tooltipData &&
          (tooltipSlot ? (
            (() => {
              const TooltipSlot = tooltipSlot;
              return (
                <div
                  className="pointer-events-none absolute top-2 z-30"
                  style={tooltipPosition(activeX!, xMin, xMax)}
                  aria-hidden
                >
                  <TooltipSlot {...tooltipData} />
                </div>
              );
            })()
          ) : (
            <div
              className="pointer-events-none absolute top-2 z-30"
              style={tooltipPosition(activeX!, xMin, xMax)}
              aria-hidden
            >
              <CrosshairTooltip data={tooltipData} />
            </div>
          ))}
      </div>

      {showXTicks && xTicks.length > 0 && (
        <div className="brock-xaxis relative mt-2 h-4 font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {xTicks.map((tick, i) => {
            const left = xToPercent(tick, xMin, xMax);
            return (
              <span
                key={i}
                className="absolute -translate-x-1/2 truncate"
                style={{ left: `${left}%`, maxWidth: 80 }}
                aria-hidden
              >
                {xAxisFormat(tick)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Compute the tooltip card's horizontal placement, dodging the right edge. */
function tooltipPosition(
  x: number,
  xMin: number,
  xMax: number,
): CSSProperties {
  const pct = xToPercent(x, xMin, xMax);
  if (pct > 66) return { right: `${100 - pct}%`, transform: "translateX(-8px)" };
  return { left: `${pct}%`, transform: "translateX(8px)" };
}

function DirectLabels({
  series,
  yMin,
  yMax,
  yScale,
  formatValue,
  withValues,
}: {
  series: NormalizedSeries[];
  yMin: number;
  yMax: number;
  yScale: LineChartYScale;
  formatValue: (v: number) => string;
  withValues: boolean;
}) {
  // Desired Y% per series at its last defined point, then nudge apart.
  const desired: Array<{ key: string; top: number; color: string; text: string }> =
    [];
  series.forEach((s) => {
    const last = lastDefinedDom(s.points);
    if (!last || last.y === null) return;
    desired.push({
      key: s.key,
      top: yToPercent(last.y, yMin, yMax, yScale),
      color: s.color,
      text: withValues ? `${s.name} ${formatValue(last.y)}` : s.name,
    });
  });
  // Greedy collision avoidance in % space (min gap ~7%).
  const sorted = [...desired].sort((a, b) => a.top - b.top);
  let prev = -Infinity;
  const minGap = 7;
  for (const item of sorted) {
    item.top = Math.max(item.top, prev + minGap);
    prev = item.top;
  }
  return (
    <>
      {sorted.map((item) => (
        <span
          key={item.key}
          className="pointer-events-none absolute left-full z-[8] ml-1 -translate-y-1/2 font-mono text-[10px] whitespace-nowrap"
          style={{ top: `${item.top}%`, color: item.color }}
          aria-hidden
        >
          {item.text}
        </span>
      ))}
    </>
  );
}

function CrosshairTooltip({ data }: { data: LineChartTooltipSlotProps }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 shadow-md">
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {data.xLabel}
      </span>
      {data.points.map((pt) => (
        <span
          key={pt.series}
          className="flex items-center gap-1.5 whitespace-nowrap"
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: pt.color }}
          />
          <span className="font-sans text-xs text-muted-foreground">
            {pt.series}
          </span>
          <span className="ms-auto ps-3 font-mono text-xs tabular-nums text-foreground">
            {pt.formatted}
          </span>
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

function Caption({ text }: { text: string }) {
  return (
    <div className="brock-caption mt-2 border-s-2 border-border bg-muted/20 px-3 py-1.5 font-sans text-xs text-muted-foreground italic">
      {text}
    </div>
  );
}

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

function DataTableSummary({
  series,
  formatValue,
}: {
  series: NormalizedSeries[];
  formatValue: (v: number) => string;
}) {
  // Union of x labels, in sorted numeric order.
  const xs = (() => {
    const map = new Map<number, string>();
    series.forEach((s) =>
      s.points.forEach((p) => {
        if (!map.has(p.x)) map.set(p.x, p.xLabel);
      }),
    );
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  })();
  // Per-series lookup.
  const lookups = series.map((s) => {
    const m = new Map<number, number | null>();
    s.points.forEach((p) => m.set(p.x, p.y));
    return m;
  });
  return (
    <table className="sr-only">
      <caption>Data table.</caption>
      <thead>
        <tr>
          <th scope="col">X</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {xs.map(([xVal, xLabel]) => (
          <tr key={xVal}>
            <th scope="row">{xLabel}</th>
            {lookups.map((m, i) => {
              const v = m.get(xVal);
              return (
                <td key={series[i].key}>
                  {v === null || v === undefined ? "—" : formatValue(v)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Tooltip / hover selection helpers ─────────────────────────────── */

/** Build the multi-series tooltip payload at a resolved x. */
function tooltipAtX(
  series: NormalizedSeries[],
  x: number,
  formatValue: (v: number) => string,
): LineChartTooltipSlotProps {
  let xLabel = String(x);
  const points: LineChartTooltipPoint[] = series.map((s) => {
    const pt = s.points.find((p) => p.x === x);
    if (pt) xLabel = pt.xLabel;
    const value = pt && pt.y !== null ? pt.y : null;
    return {
      series: s.name,
      value,
      formatted: value === null ? "—" : formatValue(value),
      color: s.color,
    };
  });
  // Sort by value descending (nulls last).
  points.sort((a, b) => {
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });
  return { x, xLabel, points };
}

/** Emphasized series' selection at a resolved x, or first defined series. */
function selectionAtX(
  series: NormalizedSeries[],
  x: number,
): LineChartSelection | null {
  const s = series.find((ser) => ser.emphasis) ?? series[0];
  if (!s) return null;
  const sIdx = series.indexOf(s);
  const pIdx = s.points.findIndex((p) => p.x === x);
  if (pIdx === -1) return null;
  return makeSelection(series, sIdx, pIdx);
}

/* ─── Styles ────────────────────────────────────────────────────────── */

function LineAnimationStyles() {
  return (
    <style>{`
      /* Line-draw on mount via stroke-dashoffset. Falls back to a fade if the
         path length is unknown. */
      .brock-plot-animated .brock-line {
        animation: brock-line-fade var(--brock-line-duration, 600ms) ease-out backwards;
      }
      @keyframes brock-line-fade {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .brock-plot-animated .brock-point {
        animation: brock-point-pop var(--brock-line-duration, 600ms) ease-out backwards;
      }
      @keyframes brock-point-pop {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
        to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .brock-plot-animated .brock-line,
        .brock-plot-animated .brock-point { animation: none; }
      }
      /* Skeleton line (loading, no data). */
      .brock-skeleton-line {
        color: color-mix(in oklab, var(--foreground) 35%, transparent);
        animation: brock-skeleton-pulse 1400ms ease-in-out infinite;
      }
      @keyframes brock-skeleton-pulse {
        0%, 100% { opacity: 0.6; }
        50%      { opacity: 1; }
      }
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
        .brock-skeleton-line,
        .brock-spinner { animation: none; }
      }
      /* Container queries — decimate X labels in narrow containers. */
      @container (max-width: 420px) {
        .brock-xaxis span:nth-child(even) { visibility: hidden; }
      }
      @container (max-width: 240px) {
        .brock-xaxis span { visibility: hidden; }
        .brock-xaxis span:first-child,
        .brock-xaxis span:last-child { visibility: visible; }
      }
      /* Windows High Contrast / forced-colors: re-assert lines + gridlines in
         system colors so nothing vanishes. */
      @media (forced-colors: active) {
        .brock-line {
          stroke: CanvasText !important;
          forced-color-adjust: none;
        }
        .brock-gridline,
        .brock-band { border-color: GrayText !important; }
        .brock-point { background: CanvasText !important; }
      }
      /* Print: strip interactive chrome, force solid bg, avoid page breaks. */
      @media print {
        .brock-toolbar,
        .brock-loading-overlay,
        .brock-skeleton-line { display: none !important; }
        .brock-watermark span { color: rgb(0 0 0 / 0.14) !important; }
        .brock-plot-animated .brock-line,
        .brock-plot-animated .brock-point { animation: none !important; }
        .brock-chart {
          break-inside: avoid;
          page-break-inside: avoid;
          background: white !important;
          color: black !important;
        }
      }
    `}</style>
  );
}
