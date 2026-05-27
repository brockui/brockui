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

import type { CSSProperties, KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";

/** Fill pattern for a bar — solid accent fill, or diagonal hatching. */
export type ColumnChartPattern = "solid" | "hatched";

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
};

/** Goal/threshold reference line drawn across the chart. */
export type ColumnChartGoal = {
  /** Value at which to draw the line. Included in max scale calculation. */
  value: number;
  /** Optional label (e.g. "Q3 target"). Rendered with the value in Hack mono. */
  label?: string;
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
   */
  hatchUntilIndex?: number;
};

type NormalizedPoint = {
  label?: string;
  value: number;
  pattern: ColumnChartPattern;
};

const defaultFormat = (v: number): string => v.toLocaleString();

/** Build a formatter from a numberFormat config object. */
function makeFormatter(config?: {
  prefix?: string;
  suffix?: string;
  decimals?: number;
}): (v: number) => string {
  if (!config) return defaultFormat;
  const decimals = config.decimals ?? 0;
  const prefix = config.prefix ?? "";
  const suffix = config.suffix ?? "";
  return (v: number) =>
    `${prefix}${v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
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
): NormalizedPoint[] {
  const patternFor = (i: number, override?: ColumnChartPattern): ColumnChartPattern => {
    if (override) return override;
    if (hatchUntilIndex !== undefined && i < hatchUntilIndex) return "hatched";
    return defaultPattern;
  };

  const raw: NormalizedPoint[] = isObjectForm(data)
    ? data.map((d, i) => ({
        label: d.label,
        value: d.value,
        pattern: patternFor(i, d.pattern),
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
}: ColumnChartProps) {
  const points = normalize(data, labels, pattern, hatchUntilIndex);
  const captionId = useId();

  // Number formatting cascade: explicit overrides > numberFormat > default
  const baseFormatter = makeFormatter(numberFormat);
  const effectiveFormatValue = formatValue ?? baseFormatter;
  const effectiveYAxisFormat = yAxisFormat ?? baseFormatter;
  const effectiveLabelFormat = dataLabels?.format ?? effectiveFormatValue;

  if (points.length === 0) {
    return <EmptyState height={height} source={source} className={className} />;
  }

  const dataMax = points.reduce((m, p) => Math.max(m, p.value), 0);
  // Goal value participates in scale so it stays visible above all bars
  const goalBased =
    goal && Number.isFinite(goal.value) && goal.value > 0
      ? Math.max(dataMax, goal.value)
      : dataMax;
  // yAxis.max overrides everything if provided
  const max = yAxis?.max !== undefined ? yAxis.max : goalBased;
  const allZero = max === 0;

  const effectiveGap = points.length > 60 ? Math.max(1, gap - 2) : gap;
  const showAllLabels = points.length <= 24;
  const everyNth = showAllLabels ? 1 : Math.ceil(points.length / 12);

  const yTicks = allZero ? [0] : [max, Math.round(max / 2), 0];
  const hasAnyLabel = points.some((p) => p.label !== undefined);
  const accessibleDescription = description ?? autoDescription(points, source);

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

  return (
    <figure
      className={className}
      role="figure"
      aria-labelledby={captionId}
      style={figureStyle}
    >
      {(header?.title || header?.subtitle) && (
        <Header title={header.title} subtitle={header.subtitle} />
      )}

      {trend !== undefined && <TrendIndicator value={trend} />}

      <div className="flex" style={{ height }}>
        {hasYAxisTitle && <YAxisTitle title={yAxis!.title!} />}
        {showYTicks && (
          <YAxis ticks={yTicks} format={effectiveYAxisFormat} />
        )}

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
        />
      </div>

      {hasAnyLabel && showXTicks && (
        <XAxis
          points={points}
          gap={effectiveGap}
          everyNth={everyNth}
          paddingLeft={yAxisTotalLeft}
        />
      )}

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
      className={`brock-bars relative flex flex-1 items-end border-b border-border ${
        animationEnabled ? "brock-bars-animated" : ""
      }`}
      style={{ gap }}
      role="img"
      aria-label={ariaLabel}
    >
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
          point.pattern === "hatched" ? "brock-bar-hatched" : "bg-brock-accent"
        }`}
        style={
          {
            height: `${barHeight}%`,
            animationDelay: animationEnabled ? `${index * 30}ms` : undefined,
            borderTopLeftRadius: barRadius > 0 ? barRadius : undefined,
            borderTopRightRadius: barRadius > 0 ? barRadius : undefined,
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
      /* Hatched fill — diagonal stripe pattern at the accent color.
         Outline keeps the bar shape readable when stripes thin out near baseline. */
      .brock-bar-hatched {
        background-color: transparent;
        background-image: repeating-linear-gradient(
          45deg,
          var(--brock-accent) 0,
          var(--brock-accent) 2px,
          transparent 2px,
          transparent 6px
        );
        outline: 1px solid var(--brock-accent);
        outline-offset: -1px;
      }
    `}</style>
  );
}
