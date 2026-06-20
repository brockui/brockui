/**
 * Column Chart — export & portability utilities.
 *
 * Native export paths, zero external dependencies:
 *
 *  - synthesizeSVG()        — build a standalone SVG string from chart props.
 *                             Patterns (hatching) are emitted as <pattern>
 *                             defs; per-bar colors, highlight outlines, goal
 *                             lines, plot bands, data labels, notes, header,
 *                             trend, source — all reproduced so the export
 *                             looks like the screen.
 *  - svgToPNG()             — rasterize that SVG via Image + Canvas at @2x
 *                             (retina) by default. Returns a Blob.
 *  - pointsToCSV()          — emit RFC-4180-style CSV of the visible points.
 *
 * Plus small helpers: downloadBlob(), copyImageToClipboard().
 *
 * Forward-compatibility (Z6) — turning the component config into something
 * portable so a Python/Jupyter/anywidget bridge or a WordPress embed can
 * round-trip it without React:
 *
 *  - toJSON()               — strip callbacks / refs / ReactNode / functions
 *                             from a props bag, return a plain JSON-friendly
 *                             config object.
 *  - fromJSON()             — counterpart; turn a JSON config back into a
 *                             partial ColumnChartProps you can spread.
 *  - renderToHTMLString()   — sync renderer for static HTML embed (no React
 *                             runtime needed at the consumer).
 *
 * Lives in its own file (not the React component) so the synthesis logic can
 * be audited and tested independently, and so the component file stays a
 * reasonable size. Shipped alongside the component through the shadcn
 * registry as a companion file.
 */

import type {
  ColumnChartAnnotation,
  ColumnChartBand,
  ColumnChartPattern,
  ColumnChartPatternStyle,
} from "./column-chart";

/* ─── Public types ──────────────────────────────────────────────────── */

/** One bar after normalization (mirrors NormalizedPoint inside the component). */
export type ExportPoint = {
  label?: string;
  value: number;
  pattern: ColumnChartPattern;
  color?: string;
  highlight?: boolean;
  note?: string;
  /** Stable addressing key (defaults to label / input index in the component). */
  key?: string;
  /** Position in the ORIGINAL input, before sort/topN. Used by annotations. */
  inputIndex?: number;
};

/* ─── Shared data transforms — moved to chart-transforms.ts (math core).
       Re-exported here so existing imports keep working. ────────────── */

import {
  computeStat,
  resolveTopNConfig,
  transformDataPoints,
} from "./chart-transforms";

export {
  resolveTopNConfig,
  transformDataPoints,
  computeStat,
  type ColumnChartTopNConfig,
} from "./chart-transforms";

/** All the context needed to synthesize a faithful SVG export. */
export type SynthesisContext = {
  /** Output canvas in CSS pixels. */
  width: number;
  height: number;
  /** Bars data (already normalized — see normalize() in column-chart.tsx). */
  points: ExportPoint[];
  /** Max value used for bar-height scaling (includes the reference line). */
  max: number;
  /** Min value (<= 0). Non-zero when the data has negatives — bars grow down. */
  min: number;
  /** True if every value is zero — only the baseline is drawn. */
  allZero: boolean;
  /** Gap between bars in px. */
  gap: number;
  /** Top-corner radius in px. */
  barRadius: number;
  /** Chart-level pattern style for hatched bars. */
  patternStyle: ColumnChartPatternStyle;
  /** Fallback accent color (resolved hex/rgb — NOT a CSS var). */
  accent: string;
  /** Foreground color, used for axis text + highlight outlines. */
  foreground: string;
  /** Muted color, used for ticks + source + goal line. */
  muted: string;
  /** Border / baseline color. */
  border: string;
  /** Background color, used for label chips. */
  background: string;
  /** Y-axis tick values + a formatter. */
  yTicks: number[];
  yAxisFormat: (v: number) => string;
  formatValue: (v: number) => string;
  labelFormat: (v: number) => string;
  /** Show inline labels above bars? */
  showLabels: boolean;
  /** Show Y-axis tick column? */
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
  /** Plot bands. */
  bands?: readonly ColumnChartBand[];
  /** Source attribution. */
  source?: string;
  /**
   * Short editorial caption rendered as italic muted text below the source
   * line. Equivalent to the in-app `Caption` sub-component.
   */
  caption?: string;
  /**
   * Diagonal watermark text rendered at low opacity in the center of the
   * chart area (behind bars in the DOM render, drawn first in SVG so bars
   * cover it). Use sparingly.
   */
  watermark?: string;
  /**
   * Free-floating annotations — text cards at specific (x, y) data points
   * with optional dashed connector arrow to that point.
   */
  annotations?: readonly ColumnChartAnnotation[];
  /** Accessible description (becomes <title> + <desc>). */
  description: string;
  /** Pixel-font fallback chain. */
  pixelFontFamily?: string;
  /** Mono-font fallback chain (for tick labels / source / numbers). */
  monoFontFamily?: string;
  /** Sans-font fallback chain (for header / error text). */
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
 * Resolve an annotation's `x` against the export points. A number is an
 * INPUT-order index (resolved via the point's `inputIndex`, so the annotation
 * travels with its datum through sort/topN; falls back to positional when
 * inputIndex is absent). A string matches `key` first, then `label`
 * (case-insensitive). Returns -1 if no match — e.g. the datum was collapsed
 * into "Other". Mirrors the in-app resolveAnnotationIndex.
 */
function resolveAnnotationIndexForExport(
  x: number | string,
  points: ExportPoint[],
): number {
  if (typeof x === "number") {
    const byInput = points.findIndex((p) => p.inputIndex === x);
    if (byInput !== -1) return byInput;
    if (points.some((p) => p.inputIndex !== undefined)) return -1;
    return x >= 0 && x < points.length ? x : -1;
  }
  const target = x.toLowerCase();
  const byKey = points.findIndex((p) => (p.key ?? "").toLowerCase() === target);
  if (byKey !== -1) return byKey;
  return points.findIndex((p) => (p.label ?? "").toLowerCase() === target);
}

/** Stable 6-char hash of a color hex for unique pattern IDs. */
function colorHash(color: string): string {
  let h = 0;
  for (let i = 0; i < color.length; i += 1) {
    h = (h * 31 + color.charCodeAt(i)) | 0;
  }
  // 6 hex chars, unsigned
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

/** Build the <pattern> def for one (style, color) combination. */
function buildPatternDef(
  id: string,
  style: ColumnChartPatternStyle,
  color: string,
): string {
  // 6×6 tile keeps stripe density consistent with the rendered .brock-bar-hatched
  const stroke = `stroke="${color}" stroke-width="2"`;
  switch (style) {
    case "diagonal":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" ${stroke}/></pattern>`;
    case "diagonal-reverse":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="6" ${stroke}/></pattern>`;
    case "vertical":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6"><line x1="0" y1="0" x2="0" y2="6" ${stroke}/></pattern>`;
    case "horizontal":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6"><line x1="0" y1="0" x2="6" y2="0" ${stroke}/></pattern>`;
    case "dots":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6"><circle cx="3" cy="3" r="1.2" fill="${color}"/></pattern>`;
  }
}

/**
 * Round only the top-left and top-right corners of a bar — bottom corners stay
 * flat (column charts are anchored to baseline). Output: an SVG path.
 */
function topRoundedBarPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const safe = Math.min(r, w / 2, h);
  if (safe <= 0) {
    return `M ${r2(x)} ${r2(y)} h ${r2(w)} v ${r2(h)} h ${r2(-w)} Z`;
  }
  return [
    `M ${r2(x)} ${r2(y + safe)}`,
    `Q ${r2(x)} ${r2(y)} ${r2(x + safe)} ${r2(y)}`,
    `L ${r2(x + w - safe)} ${r2(y)}`,
    `Q ${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + safe)}`,
    `L ${r2(x + w)} ${r2(y + h)}`,
    `L ${r2(x)} ${r2(y + h)}`,
    `Z`,
  ].join(" ");
}

/**
 * Mirror of topRoundedBarPath for NEGATIVE bars — rounds the bottom corners,
 * top edge stays flat (anchored to the zero baseline).
 */
function bottomRoundedBarPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const safe = Math.min(r, w / 2, h);
  if (safe <= 0) {
    return `M ${r2(x)} ${r2(y)} h ${r2(w)} v ${r2(h)} h ${r2(-w)} Z`;
  }
  return [
    `M ${r2(x)} ${r2(y)}`,
    `L ${r2(x + w)} ${r2(y)}`,
    `L ${r2(x + w)} ${r2(y + h - safe)}`,
    `Q ${r2(x + w)} ${r2(y + h)} ${r2(x + w - safe)} ${r2(y + h)}`,
    `L ${r2(x + safe)} ${r2(y + h)}`,
    `Q ${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - safe)}`,
    `Z`,
  ].join(" ");
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
    points,
    max,
    allZero,
    gap,
    barRadius,
    patternStyle,
    accent,
    foreground,
    muted,
    border,
    background,
    yTicks,
    min,
    yAxisFormat,
    labelFormat,
    showLabels,
    showYTicks,
    showXTicks,
    yAxisTitle,
    xAxisTitle,
    headerTitle,
    headerSubtitle,
    trend,
    referenceLine,
    bands,
    source,
    caption,
    watermark,
    annotations,
    description,
  } = ctx;

  const pixelFont = ctx.pixelFontFamily ?? DEFAULT_PIXEL;
  const monoFont = ctx.monoFontFamily ?? DEFAULT_MONO;
  const sansFont = ctx.sansFontFamily ?? DEFAULT_SANS;

  // ─── Layout math (mirrors the React render) ───
  const yAxisTickWidth = showYTicks ? 40 : 0;
  const yAxisTitleWidth = yAxisTitle ? 24 : 0;
  const yAxisTotalWidth = yAxisTickWidth + yAxisTitleWidth;

  // Headers occupy: title 18 + subtitle 14 + margin 12 = up to 44px; trend 16
  const hasHeader = !!(headerTitle || headerSubtitle);
  const hasTrend = trend !== undefined;
  const headerHeight =
    (hasHeader ? (headerTitle && headerSubtitle ? 38 : 22) : 0) +
    (hasTrend && !hasHeader ? 22 : 0);
  const headerPad = headerHeight > 0 ? 12 : 0;

  // Source occupies ~24px below
  const sourceHeight = source ? 28 : 8;
  // X-axis labels ~22px
  const hasAnyLabel = points.some((p) => p.label !== undefined);
  const xAxisLabelHeight = hasAnyLabel && showXTicks ? 22 : 0;
  const xAxisTitleHeight = xAxisTitle ? 18 : 0;

  // Notes sit above the bar; data labels too. Reserve space.
  const hasNotes = points.some((p) => p.note);
  const notesPad = hasNotes ? 22 : 0;
  const labelsPad = showLabels ? 18 : 0;

  const barsTop = headerHeight + headerPad + notesPad + labelsPad;
  const barsBottom = height - sourceHeight - xAxisLabelHeight - xAxisTitleHeight;
  const barsAreaHeight = Math.max(20, barsBottom - barsTop);
  // Zero baseline: with negatives the axis line moves up from the bottom edge.
  // range = max - min; when min === 0 baselineY === barsBottom (unchanged).
  const range = max - min;
  const baselineY =
    range > 0 ? barsTop + (max / range) * barsAreaHeight : barsBottom;
  const barsLeft = yAxisTotalWidth;
  const barsAreaWidth = Math.max(20, width - barsLeft);

  const total = points.length;
  const barWidth =
    total > 0 ? Math.max(0, (barsAreaWidth - (total - 1) * gap) / total) : 0;

  // ─── Patterns ───
  // Collect every (style, color) tuple for hatched bars; emit <pattern> defs.
  const patternKeys = new Set<string>();
  const patternDefs: string[] = [];
  function ensurePattern(color: string): string {
    const id = `brock-pat-${patternStyle}-${colorHash(color)}`;
    if (!patternKeys.has(id)) {
      patternKeys.add(id);
      patternDefs.push(buildPatternDef(id, patternStyle, color));
    }
    return id;
  }

  // ─── Body parts ───
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
    // Iconly trend arrow (0–24 viewBox) scaled to 12px, placed left of the
    // value — matches the on-screen TrendIndicator (no unicode ↗ glyph).
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

  // Y-axis title (rotated)
  if (yAxisTitle) {
    const cx = 8;
    const cy = barsTop + barsAreaHeight / 2;
    parts.push(
      `<text x="${cx}" y="${r2(cy)}" font-family="${monoFont}" font-size="10" fill="${muted}" text-anchor="middle" transform="rotate(-90 ${cx} ${r2(cy)})" letter-spacing="0.06em">${escapeXml(yAxisTitle.toUpperCase())}</text>`,
    );
  }

  // Y-axis ticks (right-aligned at axis edge)
  if (showYTicks) {
    yTicks.forEach((tick, i) => {
      // Position by value so the 0-tick sits exactly on the baseline when the
      // scale spans negatives. (For the all-positive [max, mid, 0] scale this
      // is identical to even spacing.)
      const rawY =
        range > 0
          ? barsTop + ((max - tick) / range) * barsAreaHeight
          : barsBottom;
      const tickY =
        i === 0 ? rawY + 4 : i === yTicks.length - 1 ? rawY - 2 : rawY + 4;
      parts.push(
        `<text x="${r2(barsLeft - 6)}" y="${r2(tickY)}" text-anchor="end" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(yAxisFormat(tick))}</text>`,
      );
    });
    // Vertical Y-axis line
    parts.push(
      `<line x1="${r2(barsLeft)}" y1="${r2(barsTop)}" x2="${r2(barsLeft)}" y2="${r2(barsBottom)}" stroke="${border}" stroke-width="1"/>`,
    );
  }

  // Baseline (X-axis) — drawn at the ZERO line, which equals the bottom edge
  // only when the data has no negatives.
  parts.push(
    `<line x1="${r2(barsLeft)}" y1="${r2(baselineY)}" x2="${r2(width)}" y2="${r2(baselineY)}" stroke="${border}" stroke-width="1"/>`,
  );

  // Watermark — diagonal text at low opacity, drawn BEFORE bars/bands so
  // bars and axes sit on top. Mirrors the in-app Watermark component.
  if (watermark) {
    const wmCenterX = r2(barsLeft + barsAreaWidth / 2);
    const wmCenterY = r2(barsTop + barsAreaHeight / 2);
    const fontSize = Math.min(96, Math.max(32, Math.floor(barsAreaHeight / 3)));
    parts.push(
      `<text x="${wmCenterX}" y="${wmCenterY}" text-anchor="middle" dominant-baseline="middle" font-family="${pixelFont}" font-size="${fontSize}" fill="${foreground}" fill-opacity="0.06" letter-spacing="0.06em" transform="rotate(-20 ${wmCenterX} ${wmCenterY})">${escapeXml(watermark.toUpperCase())}</text>`,
    );
  }

  // Plot bands (behind bars)
  if (bands && total > 0) {
    for (const band of bands) {
      const from = Math.max(0, Math.min(total - 1, band.from));
      const to = Math.max(from, Math.min(total - 1, band.to));
      const span = to - from + 1;
      const bandX = barsLeft + from * (barWidth + gap);
      const bandW = span * barWidth + (span - 1) * gap;
      const fill = band.color ?? `${foreground}10`;
      parts.push(
        `<rect x="${r2(bandX)}" y="${r2(barsTop)}" width="${r2(bandW)}" height="${r2(barsAreaHeight)}" fill="${fill}"/>`,
      );
      if (band.label) {
        parts.push(
          `<text x="${r2(bandX + 6)}" y="${r2(barsTop + 12)}" font-family="${monoFont}" font-size="10" fill="${muted}" letter-spacing="0.06em">${escapeXml(band.label.toUpperCase())}</text>`,
        );
      }
    }
  }

  // Bars
  if (!allZero && total > 0) {
    points.forEach((point, i) => {
      const fillColor = point.color ?? accent;
      const useHatched = point.pattern === "hatched";
      const patternId = useHatched ? ensurePattern(fillColor) : null;

      const x = barsLeft + i * (barWidth + gap);
      const isNegative = point.value < 0;
      const ratio =
        range > 0
          ? Math.max(Math.abs(point.value) / range, point.value !== 0 ? 0.01 : 0)
          : 0;
      const h = ratio * barsAreaHeight;
      // Positive bars grow up from the baseline; negative bars grow down.
      const y = isNegative ? baselineY : baselineY - h;

      const fill = useHatched ? `url(#${patternId})` : fillColor;
      const path = isNegative
        ? bottomRoundedBarPath(x, y, barWidth, h, barRadius)
        : topRoundedBarPath(x, y, barWidth, h, barRadius);
      const strokeAttr = useHatched
        ? ` stroke="${fillColor}" stroke-width="1"`
        : "";
      parts.push(`<path d="${path}" fill="${fill}"${strokeAttr}/>`);

      // Highlight outline (2px foreground)
      if (point.highlight) {
        const hpath = isNegative
          ? bottomRoundedBarPath(x - 1, y, barWidth + 2, h + 1, barRadius + 1)
          : topRoundedBarPath(x - 1, y - 1, barWidth + 2, h + 1, barRadius + 1);
        parts.push(
          `<path d="${hpath}" fill="none" stroke="${foreground}" stroke-width="2"/>`,
        );
      }

      // Inline data label at the OUTER end of the bar (above for positive,
      // below for negative — the Datawrapper convention).
      if (showLabels && point.value !== 0) {
        const labelY = isNegative ? y + h + 12 : y - 4;
        parts.push(
          `<text x="${r2(x + barWidth / 2)}" y="${r2(labelY)}" text-anchor="middle" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(labelFormat(point.value))}</text>`,
        );
      }

      // Note at the outer end (sits beyond the data label if present)
      if (point.note && point.value !== 0) {
        const noteY = isNegative
          ? y + h + (showLabels ? 26 : 12)
          : showLabels
            ? y - 18
            : y - 4;
        parts.push(
          `<text x="${r2(x + barWidth / 2)}" y="${r2(noteY)}" text-anchor="middle" font-family="${monoFont}" font-size="10" letter-spacing="0.06em" fill="${foreground}">${escapeXml(point.note)}</text>`,
        );
      }
    });
  }

  // Free-floating annotations (text card + optional dashed connector).
  // Drawn AFTER bars but BEFORE goal so important reference lines still win.
  if (annotations && annotations.length > 0 && total > 0 && max > 0) {
    for (const annotation of annotations) {
      const idx = resolveAnnotationIndexForExport(annotation.x, points);
      if (idx < 0) continue;
      const xCenter = barsLeft + idx * (barWidth + gap) + barWidth / 2;
      const yRatio =
        range > 0 ? Math.max(0, Math.min(1, (max - annotation.y) / range)) : 1;
      const yPoint = barsTop + yRatio * barsAreaHeight;
      const anchor = annotation.anchor ?? "top";
      const cardColor = annotation.color ?? foreground;
      // Approximate card width — 5.5px per char + 8px padding for the chip.
      const approxCardW = annotation.text.length * 5.5 + 10;
      const cardH = 14;
      const gapToPoint = 8;
      let cardX: number;
      let cardY: number;
      let lineX1: number;
      let lineY1: number;
      switch (anchor) {
        case "bottom":
          cardX = xCenter - approxCardW / 2;
          cardY = yPoint + gapToPoint;
          lineX1 = xCenter;
          lineY1 = yPoint + 1;
          break;
        case "left":
          cardX = xCenter - gapToPoint - approxCardW;
          cardY = yPoint - cardH / 2;
          lineX1 = xCenter - 1;
          lineY1 = yPoint;
          break;
        case "right":
          cardX = xCenter + gapToPoint;
          cardY = yPoint - cardH / 2;
          lineX1 = xCenter + 1;
          lineY1 = yPoint;
          break;
        case "top":
        default:
          cardX = xCenter - approxCardW / 2;
          cardY = yPoint - gapToPoint - cardH;
          lineX1 = xCenter;
          lineY1 = yPoint - 1;
          break;
      }
      // Background chip
      parts.push(
        `<rect x="${r2(cardX)}" y="${r2(cardY)}" width="${r2(approxCardW)}" height="${cardH}" fill="${background}" stroke="${border}" stroke-width="1" rx="2"/>`,
      );
      // Text
      parts.push(
        `<text x="${r2(cardX + approxCardW / 2)}" y="${r2(cardY + cardH - 4)}" text-anchor="middle" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${cardColor}">${escapeXml(annotation.text)}</text>`,
      );
      // Connector arrow
      if (annotation.arrow) {
        // line endpoints: from card edge → (xCenter, yPoint)
        let cx2: number;
        let cy2: number;
        switch (anchor) {
          case "bottom":
            cx2 = xCenter;
            cy2 = cardY;
            break;
          case "left":
            cx2 = cardX + approxCardW;
            cy2 = cardY + cardH / 2;
            break;
          case "right":
            cx2 = cardX;
            cy2 = cardY + cardH / 2;
            break;
          case "top":
          default:
            cx2 = xCenter;
            cy2 = cardY + cardH;
            break;
        }
        parts.push(
          `<line x1="${r2(lineX1)}" y1="${r2(lineY1)}" x2="${r2(cx2)}" y2="${r2(cy2)}" stroke="${cardColor}" stroke-width="1" stroke-dasharray="2 2"/>`,
        );
      }
    }
  }

  // Goal line (drawn on top of bars)
  if (referenceLine && Number.isFinite(referenceLine.value) && range > 0) {
    const goalY =
      barsTop + ((max - referenceLine.value) / range) * barsAreaHeight;
    parts.push(
      `<line x1="${r2(barsLeft)}" y1="${r2(goalY)}" x2="${r2(width)}" y2="${r2(goalY)}" stroke="${muted}" stroke-width="1" stroke-dasharray="4 2"/>`,
    );
    const goalText = referenceLine.label
      ? `${referenceLine.label} · ${ctx.formatValue(referenceLine.value)}`
      : ctx.formatValue(referenceLine.value);
    // Opaque bordered pill at the START (left) edge — mirrors the DOM render:
    // the right corner is the busiest (trend + tallest bars' labels), the left
    // sits in clear space. Drawn last so it reads on top of bars.
    const txt = escapeXml(goalText);
    const approxW = goalText.length * 5.5 + 10;
    parts.push(
      `<rect x="${r2(barsLeft)}" y="${r2(goalY - 12)}" width="${r2(approxW)}" height="14" rx="2" fill="${background}" stroke="${border}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${r2(barsLeft + 5)}" y="${r2(goalY - 2)}" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${txt}</text>`,
    );
  }

  // X-axis labels
  if (hasAnyLabel && showXTicks) {
    const everyNth = total <= 24 ? 1 : Math.ceil(total / 12);
    points.forEach((point, i) => {
      if (!point.label || i % everyNth !== 0) return;
      const cx = barsLeft + i * (barWidth + gap) + barWidth / 2;
      parts.push(
        `<text x="${r2(cx)}" y="${r2(barsBottom + 14)}" text-anchor="middle" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(point.label)}</text>`,
      );
    });
  }

  // X-axis title
  if (xAxisTitle) {
    const xtY = barsBottom + xAxisLabelHeight + 14;
    parts.push(
      `<text x="${r2(barsLeft + barsAreaWidth / 2)}" y="${r2(xtY)}" text-anchor="middle" font-family="${monoFont}" font-size="10" fill="${muted}" letter-spacing="0.06em">${escapeXml(xAxisTitle.toUpperCase())}</text>`,
    );
  }

  // Source line
  if (source) {
    parts.push(
      `<text x="0" y="${r2(height - 6)}" font-family="${monoFont}" font-size="10" fill="${muted}" letter-spacing="0.06em">${escapeXml(`SOURCE: ${source.toUpperCase()}`)}</text>`,
    );
  }

  // Caption (italic muted text). If no source, sits at the bottom edge; if
  // source is present, stacks above it.
  if (caption) {
    const capY = source ? height - 18 : height - 6;
    parts.push(
      `<text x="0" y="${r2(capY)}" font-family="${sansFont}" font-size="11" font-style="italic" fill="${muted}">${escapeXml(caption)}</text>`,
    );
  }

  // ─── Assemble ───
  const defsBlock = patternDefs.length
    ? `<defs>${patternDefs.join("")}</defs>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(description)}">${defsBlock}<rect width="${width}" height="${height}" fill="${background}"/>${parts.join("")}</svg>`;
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
  // Parse width/height out of the SVG so we know the canvas size.
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
 * Serialize bars to RFC-4180-style CSV. Default header row is `label,value`.
 * Per-bar fields (color, highlight, note) are added as extra columns only
 * when at least one row has a value for them — keeps the file lean for the
 * common single-series case.
 */
export function pointsToCSV(points: ExportPoint[]): string {
  const hasColor = points.some((p) => p.color !== undefined);
  const hasHighlight = points.some((p) => p.highlight !== undefined);
  const hasNote = points.some((p) => p.note !== undefined);

  const header: string[] = ["label", "value"];
  if (hasColor) header.push("color");
  if (hasHighlight) header.push("highlight");
  if (hasNote) header.push("note");

  const lines = [header.join(",")];
  for (const p of points) {
    const row: string[] = [csvCell(p.label ?? ""), csvCell(String(p.value))];
    if (hasColor) row.push(csvCell(p.color ?? ""));
    if (hasHighlight) row.push(csvCell(p.highlight ? "true" : ""));
    if (hasNote) row.push(csvCell(p.note ?? ""));
    lines.push(row.join(","));
  }
  // RFC 4180 uses CRLF
  return lines.join("\r\n") + "\r\n";
}

function csvCell(value: string): string {
  // Quote if the cell contains comma, quote, or newline; double internal quotes.
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
 * ColumnChartProps that is JSON-safe (no functions, no React nodes, no refs).
 *
 * Deliberately re-declares the relevant fields (instead of `Pick<...>`-ing
 * from ColumnChartProps) so the JSON contract is stable across React-side
 * refactors and so it can serve as the contract for a Python anywidget bridge
 * or a WordPress embed builder.
 */
export type ColumnChartJSON = {
  /** Schema version — bump when the JSON shape changes in a non-additive way. */
  $schema?: string;
  data: Array<
    | number
    | {
        label?: string;
        value: number;
        pattern?: ColumnChartPattern;
        color?: string;
        highlight?: boolean;
        note?: string;
      }
  >;
  labels?: string[];
  height?: number;
  gap?: number;
  accent?: string;
  barRadius?: number;
  header?: { title?: string; subtitle?: string };
  xAxis?: { title?: string; hideTicks?: boolean };
  yAxis?: {
    title?: string;
    /** Extend-only headroom; values below the data max are ignored. */
    max?: number;
    hideTicks?: boolean;
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
  dataLabels?: { show?: boolean | "auto" };
  trend?: number;
  referenceLine?: {
    value: number | { stat: "mean" | "median" };
    label?: string;
  };
  source?: string;
  description?: string;
  pattern?: ColumnChartPattern;
  hatchUntilIndex?: number;
  hatchFromIndex?: number;
  patternStyle?: ColumnChartPatternStyle;
  minBarWidth?: number;
  scroll?: "none" | "auto";
  sort?: "none" | "asc" | "desc";
  topN?:
    | number
    | { n: number; label?: string; pinned?: boolean; distinct?: boolean };
  bands?: ColumnChartBand[];
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
  annotations?: ColumnChartAnnotation[];
  chartType?: string;
  dataDescription?: string;
};

export const COLUMN_CHART_JSON_SCHEMA = "brock-ui/column-chart/v1";

/**
 * The set of props that are JSON-safe — everything not in this set is dropped
 * by `toJSON()`. Keeps the export small and prevents accidentally leaking
 * functions / React nodes / refs.
 */
const JSON_SAFE_KEYS: Array<keyof ColumnChartJSON> = [
  "data",
  "labels",
  "height",
  "gap",
  "accent",
  "barRadius",
  "header",
  "xAxis",
  "yAxis",
  "numberFormat",
  "dataLabels",
  "trend",
  "referenceLine",
  "source",
  "description",
  "pattern",
  "hatchUntilIndex",
  "hatchFromIndex",
  "patternStyle",
  "minBarWidth",
  "scroll",
  "sort",
  "topN",
  "bands",
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
  "annotations",
  "chartType",
  "dataDescription",
];

/**
 * Serialize a props-like object to a portable JSON config. Anything that
 * isn't JSON-safe (callbacks like `onBarClick`, render fns like `formatValue`,
 * React nodes like `loadingFallback`, slot components, refs, `className`) is
 * dropped on the floor. Specifically:
 *
 *  - `error` is normalized: Error instances become their `.message` string;
 *    `null` is dropped entirely.
 *  - `dataLabels.format` is dropped (function); declarative bits (show) stay.
 *  - `numberFormat` is kept whole (already JSON-safe).
 *  - `exportable` may be `true` or an object — both stay.
 *  - `exportFileName` is kept only when it is a string (not a function).
 *
 * The result includes `$schema` so consumers can tell which version of the
 * contract they're reading.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJSON(props: Record<string, any>): ColumnChartJSON {
  const out: ColumnChartJSON = {
    $schema: COLUMN_CHART_JSON_SCHEMA,
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
    if (key === "dataLabels") {
      // Drop the `format` function; keep declarative ("auto" survives).
      if (typeof value === "object" && value !== null) {
        out.dataLabels = {
          show: value.show === "auto" ? "auto" : !!value.show,
        };
      }
      continue;
    }

    // Bands / annotations / data — already JSON-safe, but make a defensive
    // shallow copy so callers can mutate the result without mutating props.
    if (
      key === "bands" ||
      key === "annotations" ||
      key === "data" ||
      key === "labels"
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
 * that can be spread onto `<ColumnChart {...props} />`. Currently a thin
 * pass-through (the JSON shape is intentionally a strict subset of the props
 * shape) but the indirection means we can later layer migrations on top.
 *
 * Unknown keys are dropped silently, including the `$schema` field. If
 * `$schema` is present and doesn't match a known version, a console.warn
 * fires in development.
 */
export function fromJSON(input: ColumnChartJSON): Partial<ColumnChartJSON> {
  if (
    process.env.NODE_ENV !== "production" &&
    input.$schema &&
    input.$schema !== COLUMN_CHART_JSON_SCHEMA
  ) {
    console.warn(
      `[brock-ui] fromJSON: unknown $schema "${input.$schema}". Expected "${COLUMN_CHART_JSON_SCHEMA}". The config may not render correctly.`,
    );
  }
  const out: Partial<ColumnChartJSON> = {};
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
 * Options for `renderToHTMLString`. All optional — sensible defaults make
 * the call site short for the common case.
 */
export type RenderToHTMLOptions = {
  /** Override SVG width. Default 800. */
  width?: number;
  /** Override SVG height. Default 400. */
  height?: number;
  /** Theme color overrides — defaults are light-theme safe. */
  colors?: Partial<{
    accent: string;
    foreground: string;
    muted: string;
    border: string;
    background: string;
    /** Fill for the muted "Other" aggregate bar created by topN. */
    otherFill: string;
  }>;
  /** Number formatter to apply across Y-axis / tooltip / inline labels. */
  formatValue?: (v: number) => string;
};

const DEFAULT_RENDER_COLORS = {
  accent: "#F54900",
  foreground: "#0a0a0a",
  muted: "#666666",
  border: "#e5e5e5",
  background: "#ffffff",
  otherFill: "#a1a1aa",
};

/**
 * Render a chart config to a self-contained HTML string. Output is a `<div>`
 * with `role="img"` + the inline SVG + an optional caption block underneath.
 * No external CSS, no external fonts (system fallbacks listed in the SVG),
 * no JavaScript — paste-able into WordPress, Notion, Jupyter, an email, or
 * a server-rendered page where the React runtime isn't available.
 *
 * Resolves bar heights and Y-axis ticks the same way the React render does,
 * via the existing `synthesizeSVG` pipeline — so the static HTML matches the
 * live React chart pixel-for-pixel (modulo the watermark / annotation chips,
 * which use the same SVG path either way).
 */
export function renderToHTMLString(
  input: ColumnChartJSON,
  options: RenderToHTMLOptions = {},
): string {
  const width = options.width ?? 800;
  const height = options.height ?? 400;
  const colors = { ...DEFAULT_RENDER_COLORS, ...(options.colors ?? {}) };
  const fmt: (v: number) => string =
    options.formatValue ?? ((v: number) => v.toLocaleString());

  // Normalize raw `data` (number[] or object[]) into ExportPoints, stamped
  // with input order + key so annotations resolve identically to the live
  // chart, then run the SAME transform pipeline (topN -> sort).
  const labels = input.labels ?? [];
  const inputPoints: ExportPoint[] = input.data
    .map((d, i) => {
      if (typeof d === "number") {
        return {
          label: labels[i],
          value: d,
          pattern: "solid" as ColumnChartPattern,
          key: labels[i] ?? String(i),
          inputIndex: i,
        };
      }
      return {
        label: d.label,
        value: d.value,
        pattern: d.pattern ?? "solid",
        color: d.color,
        highlight: d.highlight,
        note: d.note,
        key: d.label ?? String(i),
        inputIndex: i,
      };
    })
    .filter((p) => Number.isFinite(p.value));

  const topNConfig = resolveTopNConfig(input.topN);
  const exportPoints = transformDataPoints(
    inputPoints,
    input.sort ?? "none",
    topNConfig,
    (sum, _collapsed, config): ExportPoint => ({
      label: config.label,
      value: sum,
      pattern: "solid",
      // The muted "Other" fill, resolved to a concrete color for the SVG.
      color: config.distinct ? colors.otherFill : undefined,
      key: config.label,
    }),
  );

  // Reference line: resolve a stat ({ stat: "mean" | "median" }) against the
  // ORIGINAL input values — bucketing must not move the statistic.
  const referenceLine = input.referenceLine
    ? {
        value:
          typeof input.referenceLine.value === "number"
            ? input.referenceLine.value
            : computeStat(
                inputPoints.map((p) => p.value),
                input.referenceLine.value.stat,
              ),
        label:
          input.referenceLine.label ??
          (typeof input.referenceLine.value === "object"
            ? input.referenceLine.value.stat === "mean"
              ? "Mean"
              : "Median"
            : undefined),
      }
    : undefined;

  const dataMax = exportPoints.reduce((m, p) => Math.max(m, p.value), 0);
  const dataMin = exportPoints.reduce((m, p) => Math.min(m, p.value), 0);
  const refValue =
    referenceLine && Number.isFinite(referenceLine.value)
      ? referenceLine.value
      : undefined;
  const refBased =
    refValue !== undefined && refValue > 0
      ? Math.max(dataMax, refValue)
      : dataMax;
  const max =
    input.yAxis?.max !== undefined ? Math.max(input.yAxis.max, refBased) : refBased;
  const min =
    refValue !== undefined && refValue < 0
      ? Math.min(dataMin, refValue)
      : dataMin;
  const allZero = max === 0 && min === 0;
  const yTicks = allZero
    ? [0]
    : min < 0
      ? [max, 0, min]
      : [max, Math.round(max / 2), 0];

  // dataLabels "auto": direct labels + hidden Y axis for small N — same
  // editorial rule as the live chart.
  // "auto" is the default — mirrors the live chart's editorial default.
  const labelsMode = input.dataLabels?.show ?? "auto";
  const autoLabels = labelsMode === "auto";
  const showLabels =
    labelsMode === true ||
    (autoLabels && exportPoints.length > 0 && exportPoints.length <= 8);
  const showYTicks =
    input.yAxis?.hideTicks !== undefined
      ? !input.yAxis.hideTicks
      : !(autoLabels && showLabels);

  const description =
    input.description ??
    `Column chart with ${exportPoints.length} data point${
      exportPoints.length === 1 ? "" : "s"
    }${input.source ? `. Source: ${input.source}.` : "."}`;

  const ctx: SynthesisContext = {
    width,
    height,
    points: exportPoints,
    max,
    min,
    allZero,
    gap: input.gap ?? 4,
    barRadius: input.barRadius ?? 0,
    patternStyle: input.patternStyle ?? "diagonal",
    accent: input.accent ?? colors.accent,
    foreground: colors.foreground,
    muted: colors.muted,
    border: colors.border,
    background: colors.background,
    yTicks,
    yAxisFormat: fmt,
    formatValue: fmt,
    labelFormat: fmt,
    showLabels,
    showYTicks,
    showXTicks: !input.xAxis?.hideTicks,
    yAxisTitle: input.yAxis?.title,
    xAxisTitle: input.xAxis?.title,
    headerTitle: input.header?.title,
    headerSubtitle: input.header?.subtitle,
    trend: input.trend,
    referenceLine,
    bands: input.bands,
    source: input.source,
    caption: input.caption,
    watermark: input.watermark,
    annotations: input.annotations,
    description,
  };

  const svg = synthesizeSVG(ctx);

  // Wrap in a portable container with role=img + ARIA label, and forward the
  // chart-type / data-description hints so AI tooling can still read them
  // even from the static markup.
  const dataAttrs: string[] = [];
  if (input.chartType) {
    dataAttrs.push(`data-chart-type="${escapeAttr(input.chartType)}"`);
  }
  if (input.dataDescription) {
    dataAttrs.push(
      `data-description="${escapeAttr(input.dataDescription)}"`,
    );
  }

  return `<div role="img" aria-label="${escapeAttr(description)}" ${dataAttrs.join(" ")}>${svg}</div>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
