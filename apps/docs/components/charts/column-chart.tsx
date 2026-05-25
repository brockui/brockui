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

/** One data point in object form. Easier to map from DataFrames / SQL rows. */
export type ColumnChartDataPoint = {
  /** X-axis label (rendered in Departure Mono pixel font). Optional. */
  label?: string;
  /** Y-axis value. Negative values are clamped to 0 (use Diverging Bar Chart for ±). */
  value: number;
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

  /** Source attribution rendered below the chart (FT/Bloomberg pattern). */
  source?: string;

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
};

type NormalizedPoint = {
  label?: string;
  value: number;
};

const defaultFormat = (v: number): string => v.toLocaleString();

function isObjectForm(
  data: readonly number[] | readonly ColumnChartDataPoint[],
): data is readonly ColumnChartDataPoint[] {
  return data.length > 0 && typeof data[0] === "object" && data[0] !== null;
}

function normalize(
  data: readonly number[] | readonly ColumnChartDataPoint[],
  labels?: readonly string[],
): NormalizedPoint[] {
  const raw: NormalizedPoint[] = isObjectForm(data)
    ? data.map((d) => ({ label: d.label, value: d.value }))
    : (data as readonly number[]).map((value, i) => ({
        label: labels?.[i],
        value,
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
  source,
  description,
  yAxisFormat = defaultFormat,
  formatValue = defaultFormat,
  className,
}: ColumnChartProps) {
  const points = normalize(data, labels);
  const captionId = useId();

  if (points.length === 0) {
    return <EmptyState height={height} source={source} className={className} />;
  }

  const max = points.reduce((m, p) => Math.max(m, p.value), 0);
  const allZero = max === 0;

  const effectiveGap = points.length > 60 ? Math.max(1, gap - 2) : gap;
  const showAllLabels = points.length <= 24;
  const everyNth = showAllLabels ? 1 : Math.ceil(points.length / 12);

  const yTicks = allZero ? [0] : [max, Math.round(max / 2), 0];
  const hasAnyLabel = points.some((p) => p.label !== undefined);
  const accessibleDescription = description ?? autoDescription(points, source);

  return (
    <figure
      className={className}
      role="figure"
      aria-labelledby={captionId}
    >
      {trend !== undefined && <TrendIndicator value={trend} />}

      <div className="flex" style={{ height }}>
        <YAxis ticks={yTicks} format={yAxisFormat} />

        <BarsGroup
          points={points}
          max={max}
          allZero={allZero}
          gap={effectiveGap}
          formatValue={formatValue}
          ariaLabel={accessibleDescription}
        />
      </div>

      {hasAnyLabel && (
        <XAxis
          points={points}
          gap={effectiveGap}
          everyNth={everyNth}
          paddingLeft={40}
        />
      )}

      {source && <ChartSource source={source} />}

      <figcaption id={captionId} className="sr-only">
        {accessibleDescription}
      </figcaption>

      <DataTableSummary
        points={points}
        formatValue={formatValue}
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
        className="flex items-center justify-center border-b border-l border-white/10 font-pixel text-xs tracking-wider text-muted-foreground/60"
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
      className="flex w-10 shrink-0 flex-col justify-between border-r border-white/10 pr-2 font-mono text-[10px] tabular-nums text-muted-foreground/60"
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
}: {
  points: NormalizedPoint[];
  max: number;
  allZero: boolean;
  gap: number;
  formatValue: (v: number) => string;
  ariaLabel: string;
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

  return (
    <div
      className="brock-bars flex flex-1 items-end border-b border-white/10"
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
          onKeyDown={(e) => handleKey(e, i)}
          onFocus={() => setFocusIndex(i)}
        />
      ))}
    </div>
  );
}

function Bar({
  ref,
  index,
  point,
  max,
  allZero,
  formatValue,
  isTabStop,
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
      <div
        className="brock-bar w-full bg-brock-accent transition-[filter] duration-150 group-hover/bar:brightness-110 group-focus-visible/bar:brightness-110"
        style={
          {
            height: `${barHeight}%`,
            animationDelay: `${index * 30}ms`,
          } as CSSProperties
        }
        aria-hidden
      />
      {!allZero && (
        <Tooltip label={point.label} value={formatValue(point.value)} />
      )}
    </div>
  );
}

function Tooltip({ label, value }: { label?: string; value: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 flex-col items-center gap-1 group-hover/bar:flex group-focus-visible/bar:flex"
      aria-hidden
    >
      {label && (
        <span className="bg-foreground px-1.5 py-0.5 font-pixel text-[10px] tracking-wider whitespace-nowrap text-background uppercase">
          {label}
        </span>
      )}
      <span className="rounded-[2px] border border-white/10 bg-background px-2 py-1 font-mono text-xs tabular-nums whitespace-nowrap text-foreground">
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
      .brock-bars .brock-bar {
        animation: brock-bar-rise 400ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
      }
      @keyframes brock-bar-rise {
        from { transform: scaleY(0); transform-origin: bottom; }
        to   { transform: scaleY(1); transform-origin: bottom; }
      }
      @media (prefers-reduced-motion: reduce) {
        .brock-bars .brock-bar { animation: none; }
      }
    `}</style>
  );
}
