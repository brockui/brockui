/**
 * Column Chart — time-series vertical bars
 *
 * Brock UI signature moves:
 *  1. Hack mono Y-axis with tabular-nums
 *  2. Single --brock-accent fill (no gradient/glow)
 *  3. No gridlines, single 1px baseline (Tufte data-ink)
 *  4. Hover/focus tooltip: Departure Mono pixel badge + Hack value
 *  5. Staggered entry animation (CSS only, honors prefers-reduced-motion)
 *  6. Built-in source attribution (FT/Bloomberg pattern)
 *  7. ASCII empty state in pixel font
 *
 * Accessibility:
 *  - Container: role="img" with aria-label
 *  - Bars: role="graphics-symbol", roving tabindex, Arrow/Home/End keyboard nav
 *  - Hidden <table> summary for screen readers (sr-only)
 *  - Focus-visible tooltip + orange focus ring
 *  - WCAG AA contrast on all text
 */

"use client";

import type {
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { useId, useImperativeHandle, useRef, useState } from "react";
import {
  copyImageToClipboard,
  downloadBlob,
  pointsToCSV,
  svgToPNG,
  synthesizeSVG,
  type ExportPoint,
  type SynthesisContext,
} from "./column-chart-export";

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
  /** Y-axis value. Negative values are clamped to 0 (use Diverging Bar Chart for ±). */
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
};

/** Goal/threshold reference line drawn across the chart. */
export type ColumnChartGoal = {
  /** Value at which to draw the line. Included in max scale calculation. */
  value: number;
  /** Optional label (e.g. "Q3 target"). Rendered with the value in Hack mono. */
  label?: string;
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
   * Goal/threshold reference line. Drawn as a dashed horizontal line across the chart
   * at the specified value, with an optional label in Hack mono. The goal value is
   * included in the chart's max scale calculation so bars adjust to keep the goal
   * visible (FT/Bloomberg KPI dashboard pattern).
   */
  goal?: ColumnChartGoal;

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
  formatValue?: (value: number) => string;

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

  /** Y-axis configuration. */
  yAxis?: {
    /** Title rendered rotated -90° to the left of the Y-axis. */
    title?: string;
    /** Override min value (default 0). */
    min?: number;
    /** Override max value (default = max of data). */
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
   * Show inline value labels above each bar (Hack mono).
   * Useful for compact dashboards where comparing exact values matters.
   */
  dataLabels?: {
    show?: boolean;
    /** Optional override of the value formatter for these labels. */
    format?: (value: number) => string;
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
};

type NormalizedPoint = {
  label?: string;
  value: number;
  pattern: ColumnChartPattern;
  color?: string;
  highlight?: boolean;
  note?: string;
};

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

  return (v: number) => `${prefix}${v.toLocaleString(locale, options)}${suffix}`;
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
): NormalizedPoint[] {
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
      }))
    : (data as readonly number[]).map((value, i) => ({
        label: labels?.[i],
        value,
        pattern: patternFor(i),
      }));

  let negativeCount = 0;
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
    if (point.value < 0) {
      negativeCount += 1;
      cleaned.push({ ...point, value: 0 });
    } else {
      cleaned.push(point);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    if (invalidCount > 0) {
      console.warn(
        `[brock-ui] ColumnChart: skipped ${invalidCount} non-finite value(s) (NaN/Infinity).`,
      );
    }
    if (negativeCount > 0) {
      console.warn(
        `[brock-ui] ColumnChart: clamped ${negativeCount} negative value(s) to 0. For positive+negative data use Diverging Bar Chart (coming).`,
      );
    }
  }

  return cleaned;
}

function autoDescription(
  points: NormalizedPoint[],
  source?: string,
): string {
  const base = `Column chart with ${points.length} data point${
    points.length === 1 ? "" : "s"
  }`;
  return source ? `${base}. Source: ${source}.` : `${base}.`;
}

export function ColumnChart({
  data,
  labels,
  height = 200,
  gap = 4,
  trend,
  goal,
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
}: ColumnChartProps) {
  const points = normalize(
    data,
    labels,
    pattern,
    hatchUntilIndex,
    hatchFromIndex,
  );
  const captionId = useId();
  const figureRef = useRef<HTMLElement>(null);

  // Number formatting cascade: explicit overrides > numberFormat > default
  const baseFormatter = makeFormatter(numberFormat);
  const effectiveFormatValue = formatValue ?? baseFormatter;
  const effectiveYAxisFormat = yAxisFormat ?? baseFormatter;
  const effectiveLabelFormat = dataLabels?.format ?? effectiveFormatValue;

  // ─── Derived values (lifted above the state machine so the imperative
  //     export API can synthesize an SVG even from loading/error/empty). ───
  const dataMax = points.reduce((m, p) => Math.max(m, p.value), 0);
  const goalBased =
    goal && Number.isFinite(goal.value) && goal.value > 0
      ? Math.max(dataMax, goal.value)
      : dataMax;
  const max = yAxis?.max !== undefined ? yAxis.max : goalBased;
  const allZero = max === 0;
  const effectiveGap = points.length > 60 ? Math.max(1, gap - 2) : gap;
  const yTicks = allZero ? [0] : [max, Math.round(max / 2), 0];
  const accessibleDescription = description ?? autoDescription(points, source);

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
    const exportPoints: ExportPoint[] = points.map((p) => ({
      label: p.label,
      value: p.value,
      pattern: p.pattern,
      color: p.color,
      highlight: p.highlight,
      note: p.note,
    }));
    return {
      width,
      height,
      points: exportPoints,
      max,
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
      showLabels: dataLabels?.show ?? false,
      showYTicks: !yAxis?.hideTicks,
      showXTicks: !xAxis?.hideTicks,
      yAxisTitle: yAxis?.title,
      xAxisTitle: xAxis?.title,
      headerTitle: header?.title,
      headerSubtitle: header?.subtitle,
      trend,
      goal,
      bands,
      source,
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
          points.map((p) => ({
            label: p.label,
            value: p.value,
            pattern: p.pattern,
            color: p.color,
            highlight: p.highlight,
            note: p.note,
          })),
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
      goal,
      header?.subtitle,
      header?.title,
      max,
      allZero,
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

  const showYTicks = !yAxis?.hideTicks;
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
      role="figure"
      aria-labelledby={captionId}
      aria-busy={loading || undefined}
      style={figureStyle}
    >
      {toolbarConfig && (
        <Toolbar
          config={toolbarConfig}
          onPNG={runPNG}
          onSVG={runSVG}
          onCSV={runCSV}
          onCopy={runCopy}
        />
      )}
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
            <YAxis ticks={yTicks} format={effectiveYAxisFormat} />
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
                allZero={allZero}
                gap={effectiveGap}
                formatValue={effectiveFormatValue}
                ariaLabel={accessibleDescription}
                goal={goal}
                barRadius={barRadius}
                animationEnabled={animationEnabled}
                showLabels={dataLabels?.show ?? false}
                labelFormat={effectiveLabelFormat}
                patternStyle={patternStyle}
                bands={bands}
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

      <figcaption id={captionId} className="sr-only">
        {accessibleDescription}
      </figcaption>

      <DataTableSummary
        points={points}
        formatValue={effectiveFormatValue}
        caption={accessibleDescription}
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
        className="flex items-center justify-center border-b border-l border-border font-pixel text-xs tracking-wider text-muted-foreground/60"
        style={{ height }}
        role="img"
        aria-label="No data available for this period"
      >
        ▒▒▒ no data for this period
      </div>
      {source && <ChartSource source={source} />}
    </div>
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
        <span
          className="absolute top-1 right-1 bg-background px-1.5 py-0.5 font-pixel text-[10px] tracking-wider text-muted-foreground uppercase"
          aria-hidden
        >
          ▒ {label}
        </span>
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
        <div
          className="font-pixel text-xs tracking-wider text-muted-foreground/60"
          aria-hidden
        >
          ▲▲▲ {label}
        </div>
        <div className="max-w-md font-sans text-sm text-foreground">
          {message}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-3 py-1 font-mono text-xs tracking-wider text-foreground uppercase transition-colors hover:border-brock-accent/60 hover:bg-muted"
            type="button"
          >
            ↻ {retryLabel}
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
    <div
      className="brock-loading-overlay pointer-events-none absolute inset-0 z-20 flex items-start justify-end p-2"
      aria-hidden
    >
      <span
        className="brock-loading-spinner bg-background px-1.5 py-0.5 font-pixel text-[10px] tracking-wider text-muted-foreground uppercase"
        role="status"
        aria-live="polite"
      >
        ▒ {label}
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

/**
 * Toolbar — top-right export bar. Pixel-font icons in Departure Mono
 * (PNG / SVG / CSV / COPY) kept tight so they read as a chip set, not
 * Material-style icons. Hidden under @media print so exports don't show
 * the toolbar on themselves.
 */
function Toolbar({
  config,
  onPNG,
  onSVG,
  onCSV,
  onCopy,
}: {
  config: ToolbarConfig;
  onPNG: () => void | Promise<void>;
  onSVG: () => void | Promise<void>;
  onCSV: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<"png" | "svg" | "csv" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (
    kind: "png" | "svg" | "csv" | "copy",
    action: () => void | Promise<void>,
  ) => {
    if (busy) return;
    setBusy(kind);
    try {
      await action();
      if (kind === "copy") {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "cursor-pointer rounded-[2px] border border-border bg-background px-1.5 py-0.5 font-pixel text-[10px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground disabled:opacity-50 disabled:cursor-wait";

  return (
    <div
      className="brock-toolbar absolute top-0 right-0 z-30 flex gap-1"
      role="toolbar"
      aria-label="Chart export"
    >
      {config.png && (
        <button
          type="button"
          className={btn}
          onClick={() => run("png", onPNG)}
          disabled={!!busy}
          aria-label="Download PNG"
          title="Download PNG"
        >
          PNG
        </button>
      )}
      {config.svg && (
        <button
          type="button"
          className={btn}
          onClick={() => run("svg", onSVG)}
          disabled={!!busy}
          aria-label="Download SVG"
          title="Download SVG"
        >
          SVG
        </button>
      )}
      {config.csv && (
        <button
          type="button"
          className={btn}
          onClick={() => run("csv", onCSV)}
          disabled={!!busy}
          aria-label="Download CSV"
          title="Download CSV"
        >
          CSV
        </button>
      )}
      {config.copy && (
        <button
          type="button"
          className={btn}
          onClick={() => run("copy", onCopy)}
          disabled={!!busy}
          aria-label="Copy image to clipboard"
          title="Copy image to clipboard"
        >
          {copied ? "✓ COPIED" : "▒ COPY"}
        </button>
      )}
    </div>
  );
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
        className={`font-mono text-xs tabular-nums ${
          isPositive ? "text-brock-accent" : "text-muted-foreground"
        }`}
        aria-hidden
      >
        {isPositive ? "↗" : "↘"} {isPositive ? "+" : ""}
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function YAxis({
  ticks,
  format,
}: {
  ticks: number[];
  format: (v: number) => string;
}) {
  return (
    <div
      className="flex w-10 shrink-0 flex-col justify-between border-r border-border pr-2 font-mono text-[10px] tabular-nums text-muted-foreground/60"
      aria-hidden
    >
      {ticks.map((tick) => (
        <div key={tick} className="text-right leading-none">
          {format(tick)}
        </div>
      ))}
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
  return (
    <div className="brock-bars-scroll flex min-w-0 flex-1 overflow-x-auto">
      <div className="flex flex-1" style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}

function BarsGroup({
  points,
  max,
  allZero,
  gap,
  formatValue,
  ariaLabel,
  goal,
  barRadius,
  animationEnabled,
  showLabels,
  labelFormat,
  patternStyle,
  bands,
}: {
  points: NormalizedPoint[];
  max: number;
  allZero: boolean;
  gap: number;
  formatValue: (v: number) => string;
  ariaLabel: string;
  goal?: ColumnChartGoal;
  barRadius: number;
  animationEnabled: boolean;
  showLabels: boolean;
  labelFormat: (v: number) => string;
  patternStyle: ColumnChartPatternStyle;
  bands: readonly ColumnChartBand[] | undefined;
}) {
  const [focusIndex, setFocusIndex] = useState(0);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  function moveFocus(target: number) {
    const clamped = Math.max(0, Math.min(points.length - 1, target));
    setFocusIndex(clamped);
    barRefs.current[clamped]?.focus();
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
    }
  }

  const total = points.length;
  // Edge zone size: first/last 15% of bars (min 1) anchor tooltip to that edge
  const edgeZone = Math.max(1, Math.floor(total * 0.15));

  function edgeFor(i: number): EdgePosition {
    if (i < edgeZone) return "left";
    if (i >= total - edgeZone) return "right";
    return "center";
  }

  const showGoal =
    goal && Number.isFinite(goal.value) && goal.value > 0 && max > 0;

  return (
    <div
      className={`brock-bars brock-bars-pattern-${patternStyle} relative flex flex-1 items-end border-b border-border ${
        animationEnabled ? "brock-bars-animated" : ""
      }`}
      style={{ gap }}
      role="img"
      aria-label={ariaLabel}
    >
      {bands && bands.length > 0 && (
        <BandsOverlay bands={bands} total={total} gap={gap} />
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
          allZero={allZero}
          formatValue={formatValue}
          isTabStop={i === focusIndex}
          edge={edgeFor(i)}
          barRadius={barRadius}
          animationEnabled={animationEnabled}
          showLabel={showLabels}
          labelFormat={labelFormat}
          onKeyDown={(e) => handleKey(e, i)}
          onFocus={() => setFocusIndex(i)}
        />
      ))}

      {showGoal && (
        <GoalLine goal={goal} max={max} formatValue={formatValue} />
      )}
    </div>
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

function GoalLine({
  goal,
  max,
  formatValue,
}: {
  goal: ColumnChartGoal;
  max: number;
  formatValue: (v: number) => string;
}) {
  const bottomPercent = (goal.value / max) * 100;
  const labelText = goal.label
    ? `${goal.label} · ${formatValue(goal.value)}`
    : `Goal: ${formatValue(goal.value)}`;

  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-[5] border-t border-dashed border-muted-foreground/50"
      style={{ bottom: `${bottomPercent}%` }}
      role="img"
      aria-label={`${goal.label ?? "Goal"} reference line at ${formatValue(goal.value)}`}
    >
      <span className="absolute right-0 -top-2.5 bg-background px-1 font-mono text-[10px] tabular-nums whitespace-nowrap text-muted-foreground">
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
}: {
  ref: (el: HTMLDivElement | null) => void;
  index: number;
  point: NormalizedPoint;
  max: number;
  allZero: boolean;
  formatValue: (v: number) => string;
  isTabStop: boolean;
  edge: EdgePosition;
  barRadius: number;
  animationEnabled: boolean;
  showLabel: boolean;
  labelFormat: (v: number) => string;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
}) {
  const barHeight = allZero
    ? 0
    : point.value === 0
      ? 0
      : Math.max((point.value / max) * 100, 1);

  const accessibleName = point.label
    ? `${point.label}: ${formatValue(point.value)}`
    : `Bar ${index + 1}: ${formatValue(point.value)}`;

  return (
    <div
      ref={ref}
      className="group/bar relative flex flex-1 items-end self-stretch rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent"
      role="graphics-symbol"
      aria-roledescription="bar"
      aria-label={accessibleName}
      tabIndex={isTabStop ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {point.note && !allZero && point.value > 0 && (
        <span
          className="pointer-events-none absolute right-0 left-0 -top-9 text-center font-mono text-[10px] tracking-wider whitespace-nowrap text-foreground"
          aria-hidden
        >
          {point.note}
        </span>
      )}
      {showLabel && !allZero && point.value > 0 && (
        <span
          className="pointer-events-none absolute right-0 left-0 -top-4 text-center font-mono text-[10px] tabular-nums whitespace-nowrap text-muted-foreground"
          aria-hidden
        >
          {labelFormat(point.value)}
        </span>
      )}
      <div
        className={`brock-bar w-full transition-[filter] duration-150 group-hover/bar:brightness-110 group-focus/bar:brightness-110 ${
          point.pattern === "hatched"
            ? "brock-bar-hatched"
            : point.color
              ? ""
              : "bg-brock-accent"
        } ${point.highlight ? "brock-bar-highlighted" : ""}`}
        style={
          {
            height: `${barHeight}%`,
            animationDelay: animationEnabled ? `${index * 30}ms` : undefined,
            borderTopLeftRadius: barRadius > 0 ? barRadius : undefined,
            borderTopRightRadius: barRadius > 0 ? barRadius : undefined,
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
      {!allZero && (
        <Tooltip
          label={point.label}
          value={formatValue(point.value)}
          edge={edge}
        />
      )}
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
}: {
  label?: string;
  value: string;
  edge: EdgePosition;
}) {
  return (
    <div
      className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden flex-col gap-1 group-hover/bar:flex group-focus/bar:flex ${TOOLTIP_POSITION[edge]} ${TOOLTIP_ALIGN[edge]}`}
      aria-hidden
    >
      {label && (
        <span className="bg-foreground px-1.5 py-0.5 font-pixel text-[10px] tracking-wider whitespace-nowrap text-background uppercase">
          {label}
        </span>
      )}
      <span className="rounded-[2px] border border-border bg-background px-2 py-1 font-mono text-xs tabular-nums whitespace-nowrap text-foreground">
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
      className="mt-2 flex font-pixel text-[10px] tracking-wider text-muted-foreground/70 uppercase"
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
  caption,
}: {
  points: NormalizedPoint[];
  formatValue: (v: number) => string;
  caption: string;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p, i) => (
          <tr key={i}>
            <th scope="row">{p.label ?? `Bar ${i + 1}`}</th>
            <td>{formatValue(p.value)}</td>
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
      @media (prefers-reduced-motion: reduce) {
        .brock-bars-animated .brock-bar { animation: none; }
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
      /* Skeleton bars (loading state, no data). Dashed outline borrows the
         Brock UI "in-progress" pattern (see design thesis); pulse animation
         is on by default but disabled under prefers-reduced-motion. */
      .brock-skeleton-bar {
        /* Fallback for browsers without color-mix() */
        background-color: rgba(127, 127, 127, 0.06);
        background-color: color-mix(in oklab, var(--foreground) 6%, transparent);
        border: 1px dashed rgba(127, 127, 127, 0.45);
        border: 1px dashed color-mix(in oklab, var(--foreground) 45%, transparent);
        border-bottom: none;
        animation: brock-skeleton-pulse 1400ms ease-in-out infinite;
      }
      @keyframes brock-skeleton-pulse {
        0%, 100% { opacity: 0.75; }
        50%      { opacity: 1; }
      }
      /* Loading overlay (refresh-with-data case). Dim layer over the chart so
         the user can still see the previous numbers but knows they're stale. */
      .brock-loading-overlay {
        background: color-mix(in oklab, var(--background) 55%, transparent);
        backdrop-filter: blur(0.5px);
      }
      .brock-loading-spinner {
        animation: brock-skeleton-pulse 1400ms ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .brock-skeleton-bar,
        .brock-loading-spinner { animation: none; }
      }
      /* Print: strip interactive chrome, expand chart inline, force solid
         backgrounds and visible borders so the printed page reads cleanly.
         Toolbar, loading overlay, hover tooltip — all hidden. */
      @media print {
        .brock-toolbar,
        .brock-loading-overlay,
        .brock-skeleton-bar { display: none !important; }
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
