/**
 * Line Chart — export & portability utilities.
 *
 * Native export paths, zero external dependencies:
 *
 *  - synthesizeSVG()        — build a standalone SVG string from chart props.
 *                             Reproduces EVERY data-ink mark of the live render:
 *                             one <path> per series (multi sub-paths around
 *                             null gaps), emphasis-vs-grey palette resolution,
 *                             light horizontal gridlines, value-positioned Y
 *                             ticks + X ticks, direct line-end labels (with the
 *                             same vertical collision avoidance the DOM uses),
 *                             a horizontal reference line, vertical event
 *                             markers + rotated labels, shaded x-range bands,
 *                             last-value dots, header / trend / source /
 *                             caption / watermark — so the export looks like
 *                             the screen.
 *  - svgToPNG()             — rasterize that SVG via Image + Canvas at @2x
 *                             (retina) by default. Returns a Blob.
 *  - pointsToCSV()          — emit RFC-4180-style TIDY CSV: an `x` column plus
 *                             one column per series, missing points blank.
 *
 * Plus small helpers: downloadBlob(), copyImageToClipboard().
 *
 * Forward-compatibility — turning the component config into something portable
 * so a Python/Jupyter/anywidget bridge or a WordPress embed can round-trip it
 * without React:
 *
 *  - toJSON()               — strip callbacks / refs / ReactNode / functions
 *                             from a props bag, return a plain JSON-friendly
 *                             config object ($schema "brock-ui/line-chart@1").
 *  - fromJSON()             — counterpart; turn a JSON config back into a
 *                             partial LineChartProps you can spread.
 *  - renderToHTMLString()   — sync renderer for static HTML embed (no React
 *                             runtime needed at the consumer). Builds the same
 *                             SVG via the synthesizeSVG pipeline (canon §8
 *                             static parity).
 *
 * Lives in its own file (not the React component) so the synthesis logic can
 * be audited and tested independently, and so the component file stays a
 * reasonable size. Shipped alongside the component through the shadcn registry
 * as a companion file.
 */

import type {
  LineChartBand,
  LineChartCurve,
  LineChartEvent,
  LineChartXScale,
  LineChartYScale,
} from "./line-chart";

/* ─── Shared data transforms — chart-transforms.ts is the math core every
       Brock UI chart imports (canon §4). The Line Chart only needs
       `computeStat` (for the reference line); re-exported here so the
       component has one import surface, matching the sibling exports. ──── */

import { computeStat } from "./chart-transforms";

export { computeStat } from "./chart-transforms";

/* ─── Public types ──────────────────────────────────────────────────── */

/**
 * One resolved point along a series, in export space. `x` is the resolved
 * numeric position on the (possibly time / ordinal) X scale; `y` is the value,
 * or `null` to mark a GAP in the line (the path breaks — never interpolated).
 */
export type ExportPoint = {
  /** Resolved numeric X coordinate on the chart's X scale. */
  x: number;
  /** Y value, or null for a missing point (gap). */
  y: number | null;
  /** Original (pre-resolution) X label for tooltips / CSV. */
  xLabel?: string;
};

/**
 * One series after normalization (mirrors NormalizedSeries inside the
 * component). Colors are already resolved to concrete hex/rgb at export time
 * — no CSS vars leak into the SVG.
 */
export type ExportSeries = {
  /** Display name — also the direct line-end label text. */
  name: string;
  /** Stable addressing key (defaults to name in the component). */
  key?: string;
  /** Resolved stroke color (hex/rgb — NOT a CSS var). */
  color: string;
  /** Dashed stroke (e.g. for a projected / forecast series). */
  dashed?: boolean;
  /** Emphasized series — drawn at full weight in the accent color. */
  emphasis?: boolean;
  /** Resolved points, sorted ascending by x. */
  points: ExportPoint[];
};

/** All the context needed to synthesize a faithful SVG export. */
export type SynthesisContext = {
  /** Output canvas in CSS pixels. */
  width: number;
  height: number;
  /** Series data (already normalized — see normalize() in line-chart.tsx). */
  series: ExportSeries[];
  /** X domain [min, max] in resolved numeric space. */
  xMin: number;
  xMax: number;
  /** Y domain [min, max] (nice'd, includes the reference line). */
  yMin: number;
  yMax: number;
  /** Y scale kind — 'linear' or 'log'. Log maps via log10. */
  yScale: LineChartYScale;
  /** X scale kind — affects only tick label formatting in export. */
  xScale: LineChartXScale;
  /** Line curve — 'linear' (polyline) or 'monotone' (smoothed). */
  curve: LineChartCurve;
  /** Stroke width in px. */
  lineWidth: number;
  /** Draw point markers? Already resolved from 'auto' by the caller. */
  showMarkers: boolean;
  /** Draw the emphasized last-value dot + label? */
  lastValueDot: boolean;
  /** Light horizontal gridlines. */
  gridlines: boolean;
  /** Direct line-end labels (replaces a legend). */
  directLabels: boolean;
  /** Append the last value to each direct label. */
  directLabelValues: boolean;
  /** Fallback accent color (resolved hex/rgb — NOT a CSS var). */
  accent: string;
  /** Muted grey for non-emphasized series + ticks + source. */
  seriesMuted: string;
  /** Foreground color (axis text, labels). */
  foreground: string;
  /** Muted color (ticks, source, reference line). */
  muted: string;
  /** Border / gridline / baseline color. */
  border: string;
  /** Background color (label chips). */
  background: string;
  /** Y-axis tick values + a formatter. */
  yTicks: number[];
  yAxisFormat: (v: number) => string;
  formatValue: (v: number) => string;
  /** X-axis tick positions (resolved numeric) + a formatter. */
  xTicks: number[];
  xAxisFormat: (v: number) => string;
  /** Show inline Y-axis tick column? */
  showYTicks: boolean;
  /** Show X-axis tick labels? */
  showXTicks: boolean;
  /** Y-axis title (rotated). */
  yAxisTitle?: string;
  /** X-axis title (below ticks). */
  xAxisTitle?: string;
  /** Header. */
  headerTitle?: string;
  headerSubtitle?: string;
  /** Trend percent (decimal, e.g. 0.184). Renders in the top-right corner. */
  trend?: number;
  /** Reference line, already resolved to a numeric value by the caller. */
  referenceLine?: { value: number; label?: string };
  /** Vertical event markers (resolved numeric x). */
  events?: Array<{ x: number; label?: string; color?: string }>;
  /** Shaded x-range bands (resolved numeric from/to). */
  bands?: Array<{ from: number; to: number; label?: string; color?: string }>;
  /** Source attribution. */
  source?: string;
  /**
   * Short editorial caption rendered as italic muted text below the source
   * line. Equivalent to the in-app `Caption` sub-component.
   */
  caption?: string;
  /**
   * Diagonal watermark text rendered at low opacity in the center of the chart
   * area (drawn first in SVG so lines cover it). Use sparingly.
   */
  watermark?: string;
  /** Accessible description (becomes <title> + <desc>). */
  description: string;
  /** Pixel-font fallback chain. */
  pixelFontFamily?: string;
  /** Mono-font fallback chain (for tick labels / source / numbers). */
  monoFontFamily?: string;
  /** Sans-font fallback chain (for header / labels). */
  sansFontFamily?: string;
};

/* ─── SVG synthesis ─────────────────────────────────────────────────── */

const DEFAULT_PIXEL = "'Departure Mono', 'PixelOperatorMono', monospace";
const DEFAULT_MONO = "Hack, 'JetBrains Mono', 'Fira Code', monospace";
const DEFAULT_SANS = "Geist, system-ui, -apple-system, sans-serif";

/** Escape text content for safe inclusion inside <text> nodes. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Round to 2 decimals for tidy SVG numbers. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Map a Y data value to a pixel Y, honoring linear / log scales. Log uses
 * log10 of clamped-positive values (the caller has already dropped
 * non-positive points on a log scale; this is a defensive floor).
 */
function makeYToPx(
  yMin: number,
  yMax: number,
  yScale: LineChartYScale,
  top: number,
  areaHeight: number,
): (v: number) => number {
  if (yScale === "log") {
    const lo = Math.log10(Math.max(yMin, Number.MIN_VALUE));
    const hi = Math.log10(Math.max(yMax, Number.MIN_VALUE));
    const span = hi - lo || 1;
    return (v: number) => {
      const lv = Math.log10(Math.max(v, Number.MIN_VALUE));
      return top + (1 - (lv - lo) / span) * areaHeight;
    };
  }
  const span = yMax - yMin || 1;
  return (v: number) => top + (1 - (v - yMin) / span) * areaHeight;
}

/** Map an X data value to a pixel X. */
function makeXToPx(
  xMin: number,
  xMax: number,
  left: number,
  areaWidth: number,
): (v: number) => number {
  const span = xMax - xMin || 1;
  return (v: number) => left + ((v - xMin) / span) * areaWidth;
}

/**
 * Build the `d` attribute for one series, breaking the path into sub-paths
 * wherever a point's `y` is null (a GAP — never interpolated). `monotone`
 * uses a Catmull-Rom → cubic Bézier conversion clamped to be monotone-ish
 * (Fritsch-Carlson-lite: tangents zeroed at local extrema), matching the live
 * canvas/DOM curve closely enough for visual parity.
 */
function buildLinePath(
  points: ExportPoint[],
  xToPx: (v: number) => number,
  yToPx: (v: number) => number,
  curve: LineChartCurve,
): string {
  // Split into contiguous runs of non-null points.
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y)) {
      if (current.length > 0) runs.push(current);
      current = [];
      continue;
    }
    current.push({ x: xToPx(p.x), y: yToPx(p.y) });
  }
  if (current.length > 0) runs.push(current);

  const segs: string[] = [];
  for (const run of runs) {
    if (run.length === 0) continue;
    if (run.length === 1) {
      // A lone point: emit a degenerate move so a marker can still anchor it,
      // but draw a 0.01px line so the stroke renders a dot under round caps.
      segs.push(`M ${r2(run[0].x)} ${r2(run[0].y)} l 0.01 0`);
      continue;
    }
    if (curve === "monotone") {
      segs.push(monotonePath(run));
    } else {
      segs.push(
        `M ${run
          .map((pt) => `${r2(pt.x)} ${r2(pt.y)}`)
          .join(" L ")}`.replace(/^M (\S+ \S+) L/, "M $1 L"),
      );
    }
  }
  return segs.join(" ");
}

/** Monotone cubic interpolation (smooth without overshoot). */
function monotonePath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  // Secants
  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = pts[i + 1].x - pts[i].x || 1e-6;
    dy[i] = pts[i + 1].y - pts[i].y;
    slope[i] = dy[i] / dx[i];
  }
  // Tangents (Fritsch–Carlson)
  const m: number[] = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2;
    }
  }
  const d: string[] = [`M ${r2(pts[0].x)} ${r2(pts[0].y)}`];
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d.push(
      `C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(pts[i + 1].x)} ${r2(
        pts[i + 1].y,
      )}`,
    );
  }
  return d.join(" ");
}

/** The last non-null point of a series, or null if the series is all gaps. */
function lastDefined(points: ExportPoint[]): { x: number; y: number } | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = points[i];
    if (p.y !== null && Number.isFinite(p.y)) return { x: p.x, y: p.y };
  }
  return null;
}

/* ─── DOM-render helpers (shared math so the live chart matches the export) ── */

/** A point shape both the component's NormalizedPoint and ExportPoint satisfy. */
type XYPoint = { x: number; y: number | null };

/**
 * Build a percent-space `d` attribute for one series, for the live DOM SVG
 * (which uses a `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` so the
 * percent coordinates fill the element). Breaks at null gaps and supports the
 * same `linear` / `monotone` curve as the export — so the on-screen path and
 * the exported SVG path are computed identically.
 */
export function buildLinePathForDom<P extends XYPoint>(
  points: readonly P[],
  xToPct: (v: number) => number,
  yToPct: (v: number) => number,
  curve: LineChartCurve,
): string {
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y)) {
      if (current.length > 0) runs.push(current);
      current = [];
      continue;
    }
    current.push({ x: xToPct(p.x), y: yToPct(p.y as number) });
  }
  if (current.length > 0) runs.push(current);

  const segs: string[] = [];
  for (const run of runs) {
    if (run.length === 0) continue;
    if (run.length === 1) {
      segs.push(`M ${r2(run[0].x)} ${r2(run[0].y)} l 0.01 0`);
      continue;
    }
    if (curve === "monotone") {
      segs.push(monotonePath(run));
    } else {
      segs.push(`M ${run.map((pt) => `${r2(pt.x)} ${r2(pt.y)}`).join(" L ")}`);
    }
  }
  return segs.join(" ");
}

/**
 * The last non-null point of a series (the actual element, by reference) — used
 * by the DOM render to flag the last-value dot / direct label. Returns the
 * original point object so the caller can compare by identity.
 */
export function lastDefinedDom<P extends XYPoint>(
  points: readonly P[],
): P | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = points[i];
    if (p.y !== null && Number.isFinite(p.y)) return p;
  }
  return null;
}

/**
 * Nudge a list of label Y positions apart so none overlap. Greedy from top:
 * after sorting by desired Y, each label is pushed down to at least
 * `prev + minGap`. Mirrors the DOM collision-avoidance pass.
 */
function avoidLabelCollisions(
  desired: Array<{ idx: number; y: number }>,
  minGap: number,
  top: number,
  bottom: number,
): Map<number, number> {
  const sorted = [...desired].sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const item of sorted) {
    let y = Math.max(item.y, prev + minGap);
    if (y < top) y = top;
    item.y = y;
    prev = y;
  }
  // If we overflowed the bottom, shift the whole stack up.
  const overflow = sorted.length > 0 ? sorted[sorted.length - 1].y - bottom : 0;
  if (overflow > 0) {
    for (const item of sorted) item.y -= overflow;
  }
  const out = new Map<number, number>();
  for (const item of sorted) out.set(item.idx, item.y);
  return out;
}

/**
 * Synthesize a standalone, self-contained SVG string of the chart.
 *
 * The output uses no external fonts (system fallbacks are listed) and no CSS
 * variables — all colors are resolved at synthesis time. It can be opened in
 * Illustrator/Figma/any browser, embedded in print, or fed to svgToPNG().
 */
export function synthesizeSVG(ctx: SynthesisContext): string {
  const {
    width,
    height,
    series,
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
    accent,
    foreground,
    muted,
    border,
    background,
    yTicks,
    yAxisFormat,
    xTicks,
    xAxisFormat,
    showYTicks,
    showXTicks,
    yAxisTitle,
    xAxisTitle,
    headerTitle,
    headerSubtitle,
    trend,
    referenceLine,
    events,
    bands,
    source,
    caption,
    watermark,
    description,
  } = ctx;

  const pixelFont = ctx.pixelFontFamily ?? DEFAULT_PIXEL;
  const monoFont = ctx.monoFontFamily ?? DEFAULT_MONO;
  const sansFont = ctx.sansFontFamily ?? DEFAULT_SANS;

  // ─── Layout math (mirrors the React render) ───
  const yAxisTickWidth = showYTicks ? 44 : 0;
  const yAxisTitleWidth = yAxisTitle ? 24 : 0;
  const yAxisTotalWidth = yAxisTickWidth + yAxisTitleWidth;

  // Reserve room on the RIGHT for direct line-end labels.
  const directLabelWidth =
    directLabels && series.length > 0
      ? Math.max(
          0,
          ...series.map((s) => {
            const text = directLabelValues
              ? `${s.name} ${ctx.formatValue(lastDefined(s.points)?.y ?? 0)}`
              : s.name;
            return text.length * 6 + 8;
          }),
        )
      : 0;

  const hasHeader = !!(headerTitle || headerSubtitle);
  const hasTrend = trend !== undefined;
  const headerHeight =
    (hasHeader ? (headerTitle && headerSubtitle ? 38 : 22) : 0) +
    (hasTrend && !hasHeader ? 22 : 0);
  const headerPad = headerHeight > 0 ? 12 : 0;

  const sourceHeight = source ? 28 : 8;
  const xAxisLabelHeight = showXTicks ? 22 : 0;
  const xAxisTitleHeight = xAxisTitle ? 18 : 0;
  // Events with labels need headroom at the top of the plot.
  const eventsPad = events && events.some((e) => e.label) ? 16 : 0;

  const plotTop = headerHeight + headerPad + eventsPad;
  const plotBottom = height - sourceHeight - xAxisLabelHeight - xAxisTitleHeight;
  const plotHeight = Math.max(20, plotBottom - plotTop);
  const plotLeft = yAxisTotalWidth;
  const plotWidth = Math.max(20, width - plotLeft - directLabelWidth);

  const xToPx = makeXToPx(xMin, xMax, plotLeft, plotWidth);
  const yToPx = makeYToPx(yMin, yMax, yScale, plotTop, plotHeight);

  const parts: string[] = [];

  // <title> / <desc> for a11y (screen readers reading the standalone SVG).
  parts.push(`<title>${escapeXml(description)}</title>`);
  parts.push(`<desc>${escapeXml(description)}</desc>`);

  // Header
  if (headerTitle) {
    parts.push(
      `<text x="0" y="16" font-family="${sansFont}" font-size="14" font-weight="500" fill="${foreground}">${escapeXml(headerTitle)}</text>`,
    );
  }
  if (headerSubtitle) {
    const y = headerTitle ? 32 : 16;
    parts.push(
      `<text x="0" y="${y}" font-family="${sansFont}" font-size="11" fill="${muted}">${escapeXml(headerSubtitle)}</text>`,
    );
  }
  if (hasTrend) {
    const isPositive = trend! >= 0;
    const pct = `${isPositive ? "+" : ""}${(trend! * 100).toFixed(1)}%`;
    const fill = isPositive ? accent : muted;
    // Iconly trend arrow (0–24 viewBox) scaled to 12px, left of the value —
    // matches the on-screen TrendIndicator (no unicode ↗ glyph).
    const textW = pct.length * 6.6;
    const arrowX = r2(width - textW - 3 - 12);
    const arrowPaths = isPositive
      ? '<path d="M16.0913 7.09137H20.9999L20.9999 12"/><path d="M20.9999 7.09033L13.2269 14.8634L9.13651 10.772L3 16.9086"/>'
      : '<path d="M16.0903 16.9095L20.9999 16.9096L20.999 12.0009"/><path d="M21 16.9086L13.2269 9.13649L9.13654 13.2269L3 7.09033"/>';
    parts.push(
      `<g transform="translate(${arrowX},5) scale(0.5)" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${arrowPaths}</g>`,
      `<text x="${r2(width)}" y="16" text-anchor="end" font-family="${monoFont}" font-size="11" font-variant-numeric="tabular-nums" fill="${fill}">${escapeXml(pct)}</text>`,
    );
  }

  // Watermark — drawn BEFORE everything in the plot so lines/axes sit on top.
  if (watermark) {
    const wmCenterX = r2(plotLeft + plotWidth / 2);
    const wmCenterY = r2(plotTop + plotHeight / 2);
    const fontSize = Math.min(96, Math.max(32, Math.floor(plotHeight / 3)));
    parts.push(
      `<text x="${wmCenterX}" y="${wmCenterY}" text-anchor="middle" dominant-baseline="middle" font-family="${pixelFont}" font-size="${fontSize}" fill="${foreground}" fill-opacity="0.06" letter-spacing="0.06em" transform="rotate(-20 ${wmCenterX} ${wmCenterY})">${escapeXml(watermark.toUpperCase())}</text>`,
    );
  }

  // Shaded x-range bands (behind everything in the plot).
  if (bands && bands.length > 0) {
    for (const band of bands) {
      const x1 = xToPx(Math.max(xMin, Math.min(xMax, band.from)));
      const x2 = xToPx(Math.max(xMin, Math.min(xMax, band.to)));
      const left = Math.min(x1, x2);
      const w = Math.abs(x2 - x1);
      const fill = band.color ?? `${foreground}0d`;
      parts.push(
        `<rect x="${r2(left)}" y="${r2(plotTop)}" width="${r2(w)}" height="${r2(plotHeight)}" fill="${fill}"/>`,
      );
      if (band.label) {
        parts.push(
          `<text x="${r2(left + 4)}" y="${r2(plotTop + 12)}" font-family="${monoFont}" font-size="10" fill="${muted}" letter-spacing="0.06em">${escapeXml(band.label.toUpperCase())}</text>`,
        );
      }
    }
  }

  // Light horizontal gridlines (Tufte/FT permit them for time-series).
  if (gridlines) {
    for (const tick of yTicks) {
      const gy = yToPx(tick);
      parts.push(
        `<line x1="${r2(plotLeft)}" y1="${r2(gy)}" x2="${r2(plotLeft + plotWidth)}" y2="${r2(gy)}" stroke="${border}" stroke-width="1" stroke-opacity="0.6"/>`,
      );
    }
  }

  // Y-axis title (rotated)
  if (yAxisTitle) {
    const cx = 8;
    const cy = plotTop + plotHeight / 2;
    parts.push(
      `<text x="${cx}" y="${r2(cy)}" font-family="${monoFont}" font-size="10" fill="${muted}" text-anchor="middle" transform="rotate(-90 ${cx} ${r2(cy)})" letter-spacing="0.06em">${escapeXml(yAxisTitle.toUpperCase())}</text>`,
    );
  }

  // Y-axis ticks (right-aligned at the axis edge)
  if (showYTicks) {
    yTicks.forEach((tick) => {
      const ty = yToPx(tick);
      parts.push(
        `<text x="${r2(plotLeft - 6)}" y="${r2(ty + 3)}" text-anchor="end" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(yAxisFormat(tick))}</text>`,
      );
    });
    // Vertical Y-axis line.
    parts.push(
      `<line x1="${r2(plotLeft)}" y1="${r2(plotTop)}" x2="${r2(plotLeft)}" y2="${r2(plotBottom)}" stroke="${border}" stroke-width="1"/>`,
    );
  }

  // Baseline (X axis) along the bottom of the plot.
  parts.push(
    `<line x1="${r2(plotLeft)}" y1="${r2(plotBottom)}" x2="${r2(plotLeft + plotWidth)}" y2="${r2(plotBottom)}" stroke="${border}" stroke-width="1"/>`,
  );

  // Reference line (horizontal dashed) — drawn under the data lines.
  if (referenceLine && Number.isFinite(referenceLine.value)) {
    const ry = yToPx(referenceLine.value);
    parts.push(
      `<line x1="${r2(plotLeft)}" y1="${r2(ry)}" x2="${r2(plotLeft + plotWidth)}" y2="${r2(ry)}" stroke="${muted}" stroke-width="1" stroke-dasharray="4 2"/>`,
    );
    const refText = referenceLine.label
      ? `${referenceLine.label} · ${ctx.formatValue(referenceLine.value)}`
      : ctx.formatValue(referenceLine.value);
    const approxW = refText.length * 5.5 + 10;
    parts.push(
      `<rect x="${r2(plotLeft)}" y="${r2(ry - 12)}" width="${r2(approxW)}" height="14" rx="2" fill="${background}" stroke="${border}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${r2(plotLeft + 5)}" y="${r2(ry - 2)}" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(refText)}</text>`,
    );
  }

  // Vertical event markers (thin line + rotated label at the top).
  if (events && events.length > 0) {
    for (const evt of events) {
      if (evt.x < xMin || evt.x > xMax) continue;
      const ex = xToPx(evt.x);
      const color = evt.color ?? muted;
      parts.push(
        `<line x1="${r2(ex)}" y1="${r2(plotTop)}" x2="${r2(ex)}" y2="${r2(plotBottom)}" stroke="${color}" stroke-width="1" stroke-dasharray="3 3"/>`,
      );
      if (evt.label) {
        parts.push(
          `<text x="${r2(ex)}" y="${r2(plotTop - 4)}" text-anchor="end" font-family="${monoFont}" font-size="9" fill="${color}" letter-spacing="0.04em" transform="rotate(-90 ${r2(ex)} ${r2(plotTop - 4)})">${escapeXml(evt.label.toUpperCase())}</text>`,
        );
      }
    }
  }

  // ─── Series lines ───
  series.forEach((s) => {
    const d = buildLinePath(s.points, xToPx, yToPx, curve);
    if (!d) return;
    const dashAttr = s.dashed ? ` stroke-dasharray="5 3"` : "";
    parts.push(
      `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${r2(
        lineWidth,
      )}" stroke-linejoin="round" stroke-linecap="round"${dashAttr}/>`,
    );

    // Markers on the points themselves.
    if (showMarkers) {
      for (const p of s.points) {
        if (p.y === null || !Number.isFinite(p.y)) continue;
        parts.push(
          `<circle cx="${r2(xToPx(p.x))}" cy="${r2(yToPx(p.y))}" r="${r2(
            Math.max(1.5, lineWidth),
          )}" fill="${s.color}"/>`,
        );
      }
    }
  });

  // Last-value emphasized dots (drawn over the lines).
  if (lastValueDot) {
    series.forEach((s) => {
      const last = lastDefined(s.points);
      if (!last) return;
      parts.push(
        `<circle cx="${r2(xToPx(last.x))}" cy="${r2(yToPx(last.y))}" r="${r2(
          lineWidth + 1.5,
        )}" fill="${s.color}" stroke="${background}" stroke-width="1.5"/>`,
      );
    });
  }

  // Direct line-end labels with vertical collision avoidance.
  if (directLabels && series.length > 0) {
    const desired: Array<{ idx: number; y: number }> = [];
    series.forEach((s, i) => {
      const last = lastDefined(s.points);
      if (!last) return;
      desired.push({ idx: i, y: yToPx(last.y) });
    });
    const resolved = avoidLabelCollisions(desired, 13, plotTop, plotBottom);
    series.forEach((s, i) => {
      const last = lastDefined(s.points);
      if (!last) return;
      const ly = resolved.get(i) ?? yToPx(last.y);
      const text = directLabelValues
        ? `${s.name} ${ctx.formatValue(last.y)}`
        : s.name;
      parts.push(
        `<text x="${r2(plotLeft + plotWidth + 6)}" y="${r2(ly + 3)}" font-family="${monoFont}" font-size="10" fill="${s.color}">${escapeXml(text)}</text>`,
      );
    });
  }

  // X-axis ticks
  if (showXTicks && xTicks.length > 0) {
    xTicks.forEach((tick) => {
      const tx = xToPx(tick);
      parts.push(
        `<text x="${r2(tx)}" y="${r2(plotBottom + 14)}" text-anchor="middle" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(xAxisFormat(tick))}</text>`,
      );
    });
  }

  // X-axis title
  if (xAxisTitle) {
    const xtY = plotBottom + xAxisLabelHeight + 14;
    parts.push(
      `<text x="${r2(plotLeft + plotWidth / 2)}" y="${r2(xtY)}" text-anchor="middle" font-family="${monoFont}" font-size="10" fill="${muted}" letter-spacing="0.06em">${escapeXml(xAxisTitle.toUpperCase())}</text>`,
    );
  }

  // Source line
  if (source) {
    parts.push(
      `<text x="0" y="${r2(height - 6)}" font-family="${monoFont}" font-size="10" fill="${muted}" letter-spacing="0.06em">${escapeXml(`SOURCE: ${source.toUpperCase()}`)}</text>`,
    );
  }

  // Caption
  if (caption) {
    const capY = source ? height - 18 : height - 6;
    parts.push(
      `<text x="0" y="${r2(capY)}" font-family="${sansFont}" font-size="11" font-style="italic" fill="${muted}">${escapeXml(caption)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(description)}"><rect width="${width}" height="${height}" fill="${background}"/>${parts.join("")}</svg>`;
}

/* ─── PNG conversion ────────────────────────────────────────────────── */

/**
 * Rasterize an SVG string into a PNG Blob via Image + Canvas.
 *
 * `scale` controls device-pixel density — 2 by default (retina-ready). The
 * SVG itself is rendered at its native size; scale multiplies the canvas
 * resolution so the PNG stays sharp when shared / printed.
 */
export async function svgToPNG(
  svgString: string,
  scale = 2,
  background?: string,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("svgToPNG requires a browser environment");
  }
  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/);
  const width = widthMatch ? Number(widthMatch[1]) : 800;
  const height = heightMatch ? Number(heightMatch[1]) : 400;

  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load SVG into Image"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) throw new Error("2D canvas context unavailable");
    if (background) {
      ctx2d.fillStyle = background;
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/png",
        1,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ─── CSV ──────────────────────────────────────────────────────────── */

/**
 * Serialize the chart to RFC-4180-style TIDY CSV: an `x` column (the union of
 * every series' x positions, sorted ascending) plus one column per series.
 * A cell is blank when that series has no point (or a null point) at that x —
 * the honest representation of a gap. The `x` value uses the original label
 * when available, otherwise its resolved numeric position.
 */
export function pointsToCSV(series: ExportSeries[]): string {
  // Collect the union of x positions across all series (keyed by numeric x,
  // remembering a display label if any series provided one).
  const xMap = new Map<number, string>();
  for (const s of series) {
    for (const p of s.points) {
      if (!xMap.has(p.x)) {
        xMap.set(p.x, p.xLabel ?? String(p.x));
      } else if (p.xLabel && xMap.get(p.x) === String(p.x)) {
        xMap.set(p.x, p.xLabel);
      }
    }
  }
  const xs = [...xMap.keys()].sort((a, b) => a - b);

  // Per-series lookup from numeric x → value.
  const lookups = series.map((s) => {
    const m = new Map<number, number | null>();
    for (const p of s.points) m.set(p.x, p.y);
    return m;
  });

  const header = ["x", ...series.map((s) => s.name)];
  const lines = [header.map(csvCell).join(",")];
  for (const x of xs) {
    const row: string[] = [csvCell(xMap.get(x) ?? String(x))];
    lookups.forEach((m) => {
      const v = m.get(x);
      row.push(v === null || v === undefined ? "" : csvCell(String(v)));
    });
    lines.push(row.join(","));
  }
  // RFC 4180 uses CRLF
  return lines.join("\r\n") + "\r\n";
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/* ─── Download + clipboard helpers ──────────────────────────────────── */

/** Trigger a browser download for any Blob, with a chosen file name. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Copy a PNG Blob to the system clipboard via the async Clipboard API.
 * Resolves on success; rejects with the underlying error (e.g. permission
 * denied, http-only origin) so the caller can fall back to download.
 */
export async function copyImageToClipboard(blob: Blob): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Clipboard API unavailable in this environment");
  }
  const ClipboardItemCtor =
    (window as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (!ClipboardItemCtor) {
    throw new Error("ClipboardItem unavailable in this environment");
  }
  await navigator.clipboard.write([
    new ClipboardItemCtor({ [blob.type]: blob }),
  ]);
}

/* ─── Forward-compat: JSON portability ──────────────────────────────── */

/**
 * The JSON shape we round-trip via toJSON / fromJSON. Mirrors the subset of
 * LineChartProps that is JSON-safe (no functions, no React nodes, no refs).
 *
 * Deliberately re-declares the relevant fields (instead of `Pick<...>`-ing
 * from LineChartProps) so the JSON contract is stable across React-side
 * refactors and so it can serve as the contract for a Python anywidget bridge
 * or a WordPress embed builder.
 *
 * `data` accepts the same three input forms the component does: a single
 * `number[]`, a single `LineChartDataPoint[]`, or a `LineChartSeries[]`.
 */
export type LineChartJSON = {
  /** Schema version — bump when the JSON shape changes in a non-additive way. */
  $schema?: string;
  data:
    | number[]
    | Array<{ x?: number | string; y: number | null; key?: string; note?: string }>
    | Array<{
        name: string;
        data: Array<
          | number
          | null
          | { x?: number | string; y: number | null; key?: string; note?: string }
        >;
        color?: string;
        key?: string;
        dashed?: boolean;
        emphasis?: boolean;
      }>;
  labels?: Array<string | number>;
  x?: Array<string | number>;
  height?: number;
  accent?: string;
  lineWidth?: number;
  curve?: LineChartCurve;
  markers?: "auto" | "always" | "none";
  xScale?: LineChartXScale;
  yScale?: LineChartYScale;
  gridlines?: boolean;
  legend?: "none" | "direct" | "top";
  directLabels?: boolean;
  directLabelValues?: boolean;
  emphasisSeries?: string;
  lastValueDot?: boolean;
  yBaselineZero?: boolean;
  header?: { title?: string; subtitle?: string };
  xAxis?: { title?: string; hideTicks?: boolean; ticks?: number };
  yAxis?: {
    title?: string;
    min?: number;
    max?: number;
    hideTicks?: boolean;
    ticks?: number;
  };
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    locale?: string;
    notation?: "standard" | "compact" | "scientific" | "engineering";
    style?: "decimal" | "currency" | "percent";
    currency?: string;
  };
  trend?: number;
  referenceLine?: {
    value: number | { stat: "mean" | "median" };
    label?: string;
  };
  events?: LineChartEvent[];
  bands?: LineChartBand[];
  source?: string;
  description?: string;
  animation?: { enabled?: boolean; duration?: number };
  loading?: boolean;
  error?: string;
  loadingLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
  exportable?:
    | boolean
    | { png?: boolean; svg?: boolean; csv?: boolean; copy?: boolean };
  exportFileName?: string;
  caption?: string;
  watermark?: string;
  chartType?: string;
  dataDescription?: string;
};

export const LINE_CHART_JSON_SCHEMA = "brock-ui/line-chart@1";

/**
 * The set of props that are JSON-safe — everything not in this set is dropped
 * by `toJSON()`. Keeps the export small and prevents accidentally leaking
 * functions / React nodes / refs.
 */
const JSON_SAFE_KEYS: Array<keyof LineChartJSON> = [
  "data",
  "labels",
  "x",
  "height",
  "accent",
  "lineWidth",
  "curve",
  "markers",
  "xScale",
  "yScale",
  "gridlines",
  "legend",
  "directLabels",
  "directLabelValues",
  "emphasisSeries",
  "lastValueDot",
  "yBaselineZero",
  "header",
  "xAxis",
  "yAxis",
  "numberFormat",
  "trend",
  "referenceLine",
  "events",
  "bands",
  "source",
  "description",
  "animation",
  "loading",
  "error",
  "loadingLabel",
  "errorLabel",
  "retryLabel",
  "exportable",
  "exportFileName",
  "caption",
  "watermark",
  "chartType",
  "dataDescription",
];

/**
 * Serialize a props-like object to a portable JSON config. Anything that isn't
 * JSON-safe (callbacks like `onPointClick`, render fns like `formatValue`,
 * React nodes like `loadingFallback`, slot components, refs, `className`,
 * the `xAxis.format` function) is dropped on the floor. Specifically:
 *
 *  - `error` is normalized: Error instances become their `.message` string;
 *    `null` is dropped entirely.
 *  - `xAxis.format` is dropped (function); declarative bits stay.
 *  - `numberFormat` is kept whole (already JSON-safe).
 *  - `exportFileName` is kept only when it is a string (not a function).
 *
 * The result includes `$schema` so consumers can tell which version of the
 * contract they're reading.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJSON(props: Record<string, any>): LineChartJSON {
  const out: LineChartJSON = {
    $schema: LINE_CHART_JSON_SCHEMA,
    data: [],
  };

  for (const key of JSON_SAFE_KEYS) {
    if (!(key in props)) continue;
    const value = props[key];
    if (value === undefined) continue;

    if (key === "error") {
      if (value === null) continue;
      if (value instanceof Error) {
        out.error = value.message;
      } else if (typeof value === "string") {
        out.error = value;
      }
      continue;
    }
    if (key === "exportFileName") {
      if (typeof value === "string") out.exportFileName = value;
      continue;
    }
    if (key === "xAxis") {
      // Drop the `format` function; keep declarative bits.
      if (typeof value === "object" && value !== null) {
        out.xAxis = {
          title: value.title,
          hideTicks: value.hideTicks,
          ticks: value.ticks,
        };
      }
      continue;
    }

    // Arrays / nested objects — already JSON-safe, but make a defensive shallow
    // copy so callers can mutate the result without mutating props.
    if (
      key === "data" ||
      key === "labels" ||
      key === "x" ||
      key === "events" ||
      key === "bands"
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = Array.isArray(value) ? value.slice() : value;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = value;
  }

  return out;
}

/**
 * Reverse of `toJSON()` — turn a JSON config back into a partial props bag
 * that can be spread onto `<LineChart {...props} />`. Currently a thin
 * pass-through (the JSON shape is intentionally a strict subset of the props
 * shape) but the indirection means we can later layer migrations on top.
 *
 * Unknown keys are dropped silently, including the `$schema` field. If
 * `$schema` is present and doesn't match a known version, a console.warn fires
 * in development.
 */
export function fromJSON(input: LineChartJSON): Partial<LineChartJSON> {
  if (
    process.env.NODE_ENV !== "production" &&
    input.$schema &&
    input.$schema !== LINE_CHART_JSON_SCHEMA
  ) {
    console.warn(
      `[brock-ui] fromJSON: unknown $schema "${input.$schema}". Expected "${LINE_CHART_JSON_SCHEMA}". The config may not render correctly.`,
    );
  }
  const out: Partial<LineChartJSON> = {};
  for (const key of JSON_SAFE_KEYS) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value === undefined) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = value;
  }
  return out;
}

/* ─── Forward-compat: static HTML render ────────────────────────────── */

/**
 * Options for `renderToHTMLString`. All optional — sensible defaults make the
 * call site short for the common case.
 */
export type RenderToHTMLOptions = {
  /** Override SVG width. Default 800. */
  width?: number;
  /** Override SVG height. Default 400. */
  height?: number;
  /** Theme color overrides — defaults are light-theme safe. */
  colors?: Partial<{
    accent: string;
    seriesMuted: string;
    foreground: string;
    muted: string;
    border: string;
    background: string;
  }>;
  /** Number formatter to apply across Y-axis / labels / reference line. */
  formatValue?: (v: number) => string;
};

const DEFAULT_RENDER_COLORS = {
  accent: "#F54900",
  seriesMuted: "#a1a1aa",
  foreground: "#0a0a0a",
  muted: "#666666",
  border: "#e5e5e5",
  background: "#ffffff",
};

/** A restrained categorical greyscale ramp for non-emphasized series. */
const GREY_RAMP = ["#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8"];

/**
 * Resolve an x value to a numeric coordinate + display label, deterministically
 * (NEVER `Date.now()` / arg-less `new Date()` — timestamps are derived from the
 * input only). Shared by the live component, the static render path, and event
 * / band resolution so categories always align.
 *
 *  - `undefined` → falls back to the point's array index.
 *  - number      → used as-is (linear / time-as-epoch).
 *  - string on `time` scale → `Date.parse` (input-derived) when parseable.
 *  - string on `point` scale (or unparseable) → stable index via `ordinalMap`.
 */
export function resolveXValue(
  value: number | string | undefined,
  fallbackIndex: number,
  xScale: LineChartXScale,
  ordinalMap: Map<string, number>,
): { x: number; label: string } {
  if (value === undefined) {
    return { x: fallbackIndex, label: String(fallbackIndex) };
  }
  if (typeof value === "number") {
    return { x: value, label: String(value) };
  }
  if (xScale === "time") {
    // Parse an ISO-ish string deterministically via Date.parse (input-derived).
    const ts = Date.parse(value);
    if (Number.isFinite(ts)) return { x: ts, label: value };
  }
  // Ordinal / point scale — map each distinct label to a stable index.
  if (!ordinalMap.has(value)) ordinalMap.set(value, ordinalMap.size);
  return { x: ordinalMap.get(value)!, label: value };
}

/**
 * Render a chart config to a self-contained HTML string. Output is a `<div>`
 * with `role="img"` + the inline SVG. No external CSS, no external fonts
 * (system fallbacks listed in the SVG), no JavaScript — paste-able into
 * WordPress, Notion, Jupyter, an email, or a server-rendered page where the
 * React runtime isn't available.
 *
 * Builds the SVG via the SAME `synthesizeSVG` pipeline the live chart uses, so
 * the static HTML matches the live React chart.
 */
export function renderToHTMLString(
  input: LineChartJSON,
  options: RenderToHTMLOptions = {},
): string {
  const width = options.width ?? 800;
  const height = options.height ?? 400;
  const colors = { ...DEFAULT_RENDER_COLORS, ...(options.colors ?? {}) };
  const fmt: (v: number) => string =
    options.formatValue ?? ((v: number) => v.toLocaleString());

  const xScale: LineChartXScale = input.xScale ?? "linear";
  const yScale: LineChartYScale = input.yScale ?? "linear";
  const ordinalMap = new Map<string, number>();

  // Normalize `data` into ExportSeries[]. Three input forms accepted.
  const rawSeries = normalizeJSONData(input);
  const series: ExportSeries[] = rawSeries.map((s, i) => {
    const emphasis =
      s.emphasis === true ||
      (input.emphasisSeries !== undefined &&
        (input.emphasisSeries === s.name || input.emphasisSeries === s.key));
    const points: ExportPoint[] = s.data.map((d, j) => {
      if (d === null) return { x: j, y: null };
      if (typeof d === "number")
        return { x: j, y: d, xLabel: input.labels?.[j] !== undefined ? String(input.labels[j]) : input.x?.[j] !== undefined ? String(input.x[j]) : undefined };
      const rx = resolveXValue(d.x ?? input.labels?.[j] ?? input.x?.[j], j, xScale, ordinalMap);
      return { x: rx.x, y: d.y, xLabel: rx.label };
    });
    points.sort((a, b) => a.x - b.x);
    return {
      name: s.name,
      key: s.key,
      color: emphasis
        ? (s.color ?? colors.accent)
        : (s.color ?? GREY_RAMP[i % GREY_RAMP.length]),
      dashed: s.dashed,
      emphasis,
      points,
    };
  });

  // Single-series default: emphasize it in the accent color.
  if (series.length === 1 && !series[0].emphasis) {
    series[0] = { ...series[0], color: rawSeries[0].color ?? colors.accent, emphasis: true };
  }

  // X domain across all series.
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = allX.length > 0 ? Math.min(...allX) : 0;
  const xMax = allX.length > 0 ? Math.max(...allX) : 1;

  // Reference line over the emphasized (or first) series' defined values.
  const refSeries = series.find((s) => s.emphasis) ?? series[0];
  const refValues = refSeries
    ? refSeries.points.filter((p) => p.y !== null).map((p) => p.y as number)
    : [];
  const referenceLine = input.referenceLine
    ? {
        value:
          typeof input.referenceLine.value === "number"
            ? input.referenceLine.value
            : computeStat(refValues, input.referenceLine.value.stat),
        label:
          input.referenceLine.label ??
          (typeof input.referenceLine.value === "object"
            ? input.referenceLine.value.stat === "mean"
              ? "Mean"
              : "Median"
            : undefined),
      }
    : undefined;

  // Y domain.
  const allY = series.flatMap((s) =>
    s.points.filter((p) => p.y !== null).map((p) => p.y as number),
  );
  const refV =
    referenceLine && Number.isFinite(referenceLine.value)
      ? referenceLine.value
      : undefined;
  const ys = refV !== undefined ? [...allY, refV] : allY;
  const { min: yMin, max: yMax, ticks: yTicks } = computeYDomain(
    ys,
    input.yAxis,
    yScale,
    input.yBaselineZero ?? false,
  );

  // X ticks — categorical scales land ON the categories; numeric/time scales
  // get evenly-spaced ticks across the domain (parity with the live render).
  const xTicks =
    xScale === "point"
      ? makePointTicks(
          series.flatMap((s) => s.points.map((p) => p.x)),
          input.xAxis?.ticks ?? 12,
        )
      : makeXTicks(xMin, xMax, input.xAxis?.ticks ?? 5);
  const xLabelMap = new Map<number, string>();
  for (const s of series) {
    for (const p of s.points) {
      if (p.xLabel && !xLabelMap.has(p.x)) xLabelMap.set(p.x, p.xLabel);
    }
  }

  const markers = input.markers ?? "auto";
  const showMarkers =
    markers === "always" ||
    (markers === "auto" &&
      series.some((s) => s.points.filter((p) => p.y !== null).length <= 20));

  const legend = input.legend ?? "direct";
  const directLabels = input.directLabels ?? legend === "direct";

  const events = input.events
    ?.map((e) => {
      const rx = resolveXValue(e.x, 0, xScale, ordinalMap);
      return { x: rx.x, label: e.label, color: e.color };
    })
    .filter((e) => Number.isFinite(e.x));
  const bands = input.bands
    ?.map((b) => {
      const f = resolveXValue(b.from, 0, xScale, ordinalMap);
      const t = resolveXValue(b.to, 0, xScale, ordinalMap);
      return { from: f.x, to: t.x, label: b.label, color: b.color };
    })
    .filter((b) => Number.isFinite(b.from) && Number.isFinite(b.to));

  const description =
    input.description ??
    `Line chart with ${series.length} series${series.length === 1 ? "" : ""}${
      input.source ? `. Source: ${input.source}.` : "."
    }`;

  const xAxisFormat = (v: number): string => {
    const lbl = xLabelMap.get(v);
    if (lbl) return lbl;
    if (xScale === "time") {
      // Deterministic ISO date slice from the input-derived timestamp.
      return new Date(v).toISOString().slice(0, 10);
    }
    return fmt(v);
  };

  const ctx: SynthesisContext = {
    width,
    height,
    series,
    xMin,
    xMax,
    yMin,
    yMax,
    yScale,
    xScale,
    curve: input.curve ?? "linear",
    lineWidth: input.lineWidth ?? 1.75,
    showMarkers,
    lastValueDot: input.lastValueDot ?? false,
    gridlines: input.gridlines ?? true,
    directLabels,
    directLabelValues: input.directLabelValues ?? false,
    accent: input.accent ?? colors.accent,
    seriesMuted: colors.seriesMuted,
    foreground: colors.foreground,
    muted: colors.muted,
    border: colors.border,
    background: colors.background,
    yTicks,
    yAxisFormat: fmt,
    formatValue: fmt,
    xTicks,
    xAxisFormat,
    showYTicks: input.yAxis?.hideTicks !== true,
    showXTicks: input.xAxis?.hideTicks !== true,
    yAxisTitle: input.yAxis?.title,
    xAxisTitle: input.xAxis?.title,
    headerTitle: input.header?.title,
    headerSubtitle: input.header?.subtitle,
    trend: input.trend,
    referenceLine,
    events,
    bands,
    source: input.source,
    caption: input.caption,
    watermark: input.watermark,
    description,
  };

  const svg = synthesizeSVG(ctx);

  const dataAttrs: string[] = [];
  if (input.chartType) {
    dataAttrs.push(`data-chart-type="${escapeAttr(input.chartType)}"`);
  }
  if (input.dataDescription) {
    dataAttrs.push(`data-description="${escapeAttr(input.dataDescription)}"`);
  }

  return `<div role="img" aria-label="${escapeAttr(description)}" ${dataAttrs.join(" ")}>${svg}</div>`;
}

/* ─── Shared helpers for the static render path ─────────────────────── */

type JSONNormalizedSeries = {
  name: string;
  key?: string;
  color?: string;
  dashed?: boolean;
  emphasis?: boolean;
  data: Array<
    | number
    | null
    | { x?: number | string; y: number | null; key?: string; note?: string }
  >;
};

/** Coerce the three `data` input forms into a uniform series list. */
function normalizeJSONData(input: LineChartJSON): JSONNormalizedSeries[] {
  const data = input.data;
  if (!Array.isArray(data) || data.length === 0) return [];
  const first = data[0];
  // Multi-series form: array of { name, data }.
  if (typeof first === "object" && first !== null && "data" in first) {
    return (data as JSONNormalizedSeries[]).map((s) => ({
      name: s.name,
      key: s.key,
      color: s.color,
      dashed: s.dashed,
      emphasis: s.emphasis,
      data: s.data,
    }));
  }
  // Single series — number[] or LineChartDataPoint[].
  return [
    {
      name: input.header?.title ?? "Series",
      data: data as JSONNormalizedSeries["data"],
    },
  ];
}

/**
 * Compute a "nice" Y domain + ticks. Mirrors the component's niceDomain. For
 * linear scales the domain is rounded to a nice step; for log it spans whole
 * powers of ten with 1·2·5 sub-ticks.
 */
/**
 * Snap a positive value to the nearest 1·2·5×10ⁿ step. `floor` → the largest
 * such step ≤ value (the log-axis lower bound); `ceil` → the smallest ≥ value
 * (the upper bound). Keeps the log domain tight instead of jumping a full decade.
 */
function niceLogBound(value: number, dir: "floor" | "ceil"): number {
  if (!(value > 0)) return dir === "floor" ? 1 : 10;
  const p = Math.floor(Math.log10(value));
  const candidates: number[] = [];
  for (let pp = p - 1; pp <= p + 1; pp += 1) {
    for (const m of [1, 2, 5]) candidates.push(m * 10 ** pp);
  }
  candidates.sort((a, b) => a - b);
  if (dir === "floor") {
    let r = candidates[0];
    for (const c of candidates) if (c <= value + 1e-9) r = c;
    return r;
  }
  for (const c of candidates) if (c >= value - 1e-9) return c;
  return candidates[candidates.length - 1];
}

export function computeYDomain(
  values: number[],
  yAxis: { min?: number; max?: number; ticks?: number } | undefined,
  yScale: LineChartYScale,
  baselineZero: boolean,
): { min: number; max: number; ticks: number[] } {
  if (values.length === 0) {
    return { min: 0, max: 1, ticks: [0, 0.5, 1] };
  }
  let dataMin = Math.min(...values);
  let dataMax = Math.max(...values);

  if (yScale === "log") {
    const positives = values.filter((v) => v > 0);
    const lo = positives.length > 0 ? Math.min(...positives) : 1;
    const hi = positives.length > 0 ? Math.max(...positives) : 10;
    // Snap to the nearest 1·2·5 step (NOT the next full decade) so a 100–178
    // series spans 100–200, not 100–1000 — otherwise the data hugs the floor
    // with most of the axis empty.
    const min = yAxis?.min ?? niceLogBound(lo, "floor");
    const max = yAxis?.max ?? niceLogBound(hi, "ceil");
    const minP = Math.floor(Math.log10(min) - 1e-9);
    const maxP = Math.ceil(Math.log10(max) + 1e-9);
    const ticks: number[] = [];
    for (let p = minP; p <= maxP; p += 1) {
      for (const m of [1, 2, 5]) {
        const t = m * 10 ** p;
        if (t >= min - 1e-9 && t <= max + 1e-9) ticks.push(t);
      }
    }
    return { min, max, ticks };
  }

  if (baselineZero) {
    if (dataMin > 0) dataMin = 0;
    if (dataMax < 0) dataMax = 0;
  }
  if (yAxis?.min !== undefined) dataMin = yAxis.min;
  if (yAxis?.max !== undefined) dataMax = yAxis.max;

  const tickCount = yAxis?.ticks ?? 4;
  const nice = niceLinearDomain(dataMin, dataMax, tickCount);
  return nice;
}

/** Round a [min, max] to a nice domain with evenly-spaced ticks. */
function niceLinearDomain(
  min: number,
  max: number,
  tickCount: number,
): { min: number; max: number; ticks: number[] } {
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const range = max - min;
  const rawStep = range / Math.max(1, tickCount);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const niceNorm = norm >= 5 ? 5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5;
  const step = niceNorm * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Guard against fp drift producing a runaway loop.
  for (let t = niceMin; t <= niceMax + step / 2; t += step) {
    ticks.push(Math.round(t / step) * step);
    if (ticks.length > 1000) break;
  }
  return { min: niceMin, max: niceMax, ticks };
}

/** Evenly-spaced X tick positions across [min, max]. */
export function makeXTicks(min: number, max: number, count: number): number[] {
  if (count <= 1 || min === max) return [min];
  const step = (max - min) / (count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) ticks.push(min + i * step);
  return ticks;
}

/**
 * X tick positions for a CATEGORICAL / ordinal ("point") scale. Ticks sit on
 * the actual category positions — never between them (an interpolated tick like
 * "1.25" on a months axis is meaningless). All categories show when they fit
 * under `cap`; beyond that they thin evenly, always keeping the last one.
 */
export function makePointTicks(
  positions: readonly number[],
  cap: number,
): number[] {
  const uniq = Array.from(new Set(positions)).sort((a, b) => a - b);
  if (uniq.length === 0) return [];
  if (uniq.length <= cap) return uniq;
  const step = Math.ceil(uniq.length / cap);
  const out = uniq.filter((_, i) => i % step === 0);
  const last = uniq[uniq.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
