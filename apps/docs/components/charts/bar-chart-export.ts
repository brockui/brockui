/**
 * Bar Chart (horizontal) — export & portability utilities.
 *
 * Native export paths, zero external dependencies:
 *
 *  - synthesizeSVG()        — build a standalone SVG string from chart props,
 *                             in HORIZONTAL geometry: a left category-label
 *                             column, a vertical zero baseline, bars growing
 *                             right (positive) / left (negative), value labels
 *                             at the bars' outer ends, hatched <pattern> defs
 *                             per (style, color), highlight outlines, a
 *                             vertical reference line with its chip at the
 *                             top, value-positioned X ticks, caption,
 *                             watermark, source — all reproduced so the
 *                             export looks like the screen.
 *  - svgToPNG()             — rasterize that SVG via Image + Canvas at @2x
 *                             (retina) by default. Returns a Blob.
 *  - pointsToCSV()          — emit RFC-4180-style CSV of the visible points.
 *
 * Plus small helpers: downloadBlob(), copyImageToClipboard().
 *
 * Forward-compatibility — turning the component config into something
 * portable so a Python/Jupyter/anywidget bridge or a WordPress embed can
 * round-trip it without React:
 *
 *  - toJSON()               — strip callbacks / refs / ReactNode / functions
 *                             from a props bag, return a plain JSON-friendly
 *                             config object ($schema "brock-ui/bar-chart/v1").
 *  - fromJSON()             — counterpart; turn a JSON config back into a
 *                             partial BarChartProps you can spread.
 *  - renderToHTMLString()   — sync renderer for static HTML embed (no React
 *                             runtime needed at the consumer). Applies the
 *                             SAME transformDataPoints / computeStat pipeline
 *                             as the live chart (canon §8 static parity),
 *                             negatives included.
 *
 * Lives in its own file (not the React component) so the synthesis logic can
 * be audited and tested independently, and so the component file stays a
 * reasonable size. Shipped alongside the component through the shadcn
 * registry as a companion file.
 */

import type {
  BarChartPattern,
  BarChartPatternStyle,
  BarChartTopN,
} from "./bar-chart";

/* ─── Public types ──────────────────────────────────────────────────── */

/** One bar after normalization (mirrors NormalizedPoint inside the component). */
export type ExportPoint = {
  label?: string;
  value: number;
  pattern: BarChartPattern;
  color?: string;
  highlight?: boolean;
  note?: string;
  /** Stable addressing key (defaults to label / input index in the component). */
  key?: string;
  /** Position in the ORIGINAL input, before sort/topN. */
  inputIndex?: number;
};

/* ─── Shared data transforms — chart-transforms.ts is the math core every
       Brock UI chart imports (canon §4). Re-exported here so the component
       has one import surface. ───────────────────────────────────────── */

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
  /** Bars data (already normalized — see normalize() in bar-chart.tsx). */
  points: ExportPoint[];
  /** Max value used for bar-length scaling (includes the reference line). */
  max: number;
  /** Min value (<= 0). Non-zero when the data has negatives — bars grow left. */
  min: number;
  /** True if every value is zero — only the baseline is drawn. */
  allZero: boolean;
  /** Gap between bar rows in px. */
  gap: number;
  /** Outer-corner radius in px. */
  barRadius: number;
  /** Chart-level pattern style for hatched bars. */
  patternStyle: BarChartPatternStyle;
  /** Width of the left category-label column in px. */
  labelWidth: number;
  /** Fallback accent color (resolved hex/rgb — NOT a CSS var). */
  accent: string;
  /** Foreground color, used for axis text + highlight outlines. */
  foreground: string;
  /** Muted color, used for ticks + source + reference line. */
  muted: string;
  /** Border / baseline color. */
  border: string;
  /** Background color, used for label chips. */
  background: string;
  /** X-axis (value) tick values + a formatter. */
  xTicks: number[];
  xAxisFormat: (v: number) => string;
  formatValue: (v: number) => string;
  labelFormat: (v: number) => string;
  /** Show inline value labels at bar ends? */
  showLabels: boolean;
  /** Show the X-axis (value) tick row? */
  showXTicks: boolean;
  /** Show the left category-label column? */
  showCategoryLabels: boolean;
  /** X-axis (value) title (below ticks). */
  xAxisTitle?: string;
  /** Y-axis (category) title (rotated, left of the label column). */
  yAxisTitle?: string;
  /** Header. */
  headerTitle?: string;
  headerSubtitle?: string;
  /** Reference line, already resolved to a numeric value by the caller. */
  referenceLine?: { value: number; label?: string };
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
  style: BarChartPatternStyle,
  color: string,
): string {
  // 6×6 tile keeps stripe density consistent with the rendered .brock-hbar-hatched
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
 * Round only the right corners of a bar — left edge stays flat (positive
 * horizontal bars are anchored to the baseline on their left). Output: an
 * SVG path. The horizontal mirror of Column's topRoundedBarPath.
 */
export function rightRoundedBarPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const safe = Math.min(r, h / 2, w);
  if (safe <= 0) {
    return `M ${r2(x)} ${r2(y)} h ${r2(w)} v ${r2(h)} h ${r2(-w)} Z`;
  }
  return [
    `M ${r2(x)} ${r2(y)}`,
    `L ${r2(x + w - safe)} ${r2(y)}`,
    `Q ${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + safe)}`,
    `L ${r2(x + w)} ${r2(y + h - safe)}`,
    `Q ${r2(x + w)} ${r2(y + h)} ${r2(x + w - safe)} ${r2(y + h)}`,
    `L ${r2(x)} ${r2(y + h)}`,
    `Z`,
  ].join(" ");
}

/**
 * Mirror of rightRoundedBarPath for NEGATIVE bars — rounds the left corners,
 * right edge stays flat (anchored to the zero baseline).
 */
export function leftRoundedBarPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const safe = Math.min(r, h / 2, w);
  if (safe <= 0) {
    return `M ${r2(x)} ${r2(y)} h ${r2(w)} v ${r2(h)} h ${r2(-w)} Z`;
  }
  return [
    `M ${r2(x + safe)} ${r2(y)}`,
    `L ${r2(x + w)} ${r2(y)}`,
    `L ${r2(x + w)} ${r2(y + h)}`,
    `L ${r2(x + safe)} ${r2(y + h)}`,
    `Q ${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - safe)}`,
    `L ${r2(x)} ${r2(y + safe)}`,
    `Q ${r2(x)} ${r2(y)} ${r2(x + safe)} ${r2(y)}`,
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
    min,
    allZero,
    gap,
    barRadius,
    patternStyle,
    labelWidth,
    accent,
    foreground,
    muted,
    border,
    background,
    xTicks,
    xAxisFormat,
    labelFormat,
    showLabels,
    showXTicks,
    showCategoryLabels,
    xAxisTitle,
    yAxisTitle,
    headerTitle,
    headerSubtitle,
    referenceLine,
    source,
    caption,
    watermark,
    description,
  } = ctx;

  const pixelFont = ctx.pixelFontFamily ?? DEFAULT_PIXEL;
  const monoFont = ctx.monoFontFamily ?? DEFAULT_MONO;
  const sansFont = ctx.sansFontFamily ?? DEFAULT_SANS;

  // ─── Layout math (mirrors the React render, axes swapped) ───
  const yAxisTitleWidth = yAxisTitle ? 24 : 0;
  const labelColWidth = showCategoryLabels ? labelWidth : 0;
  const barsLeft = yAxisTitleWidth + labelColWidth;

  // Headers occupy: title 18 + subtitle 14 + margin 12 = up to 44px.
  const hasHeader = !!(headerTitle || headerSubtitle);
  const headerHeight = hasHeader ? (headerTitle && headerSubtitle ? 38 : 22) : 0;
  const headerPad = headerHeight > 0 ? 12 : 0;
  // Reference chip sits ABOVE the bars area — reserve a strip for it.
  const refChipPad = referenceLine ? 14 : 0;

  // Source occupies ~24px below
  const sourceHeight = source ? 28 : 8;
  // X-axis (value) tick row ~22px
  const xTickRowHeight = showXTicks ? 22 : 0;
  const xAxisTitleHeight = xAxisTitle ? 18 : 0;

  // Outer-end value labels + notes extend RIGHT of the bars — reserve a
  // fixed text budget so they don't clip at the canvas edge (the same
  // no-text-measurement policy the live render uses).
  const hasNotes = points.some((p) => p.note);
  const rightPad = showLabels || hasNotes ? 48 : 8;

  const barsTop = headerHeight + headerPad + refChipPad;
  const barsBottom = height - sourceHeight - xTickRowHeight - xAxisTitleHeight;
  const barsAreaHeight = Math.max(20, barsBottom - barsTop);
  const barsAreaWidth = Math.max(20, width - barsLeft - rightPad);
  // Zero baseline: a VERTICAL line. With min === 0 it sits on the bars area's
  // left edge (the classic left-anchored bar chart).
  const range = max - min;
  const baselineX =
    range > 0 ? barsLeft + ((0 - min) / range) * barsAreaWidth : barsLeft;

  const total = points.length;
  const rowH =
    total > 0 ? Math.max(0, (barsAreaHeight - (total - 1) * gap) / total) : 0;

  // ─── Patterns ───
  // Collect every (style, color) tuple for hatched bars; emit <pattern> defs.
  const patternKeys = new Set<string>();
  const patternDefs: string[] = [];
  function ensurePattern(color: string): string {
    const id = `brock-hpat-${patternStyle}-${colorHash(color)}`;
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

  // Y-axis (category) title — rotated, left of the label column.
  if (yAxisTitle) {
    const cx = 8;
    const cy = barsTop + barsAreaHeight / 2;
    parts.push(
      `<text x="${cx}" y="${r2(cy)}" font-family="${monoFont}" font-size="10" fill="${muted}" text-anchor="middle" transform="rotate(-90 ${cx} ${r2(cy)})" letter-spacing="0.06em">${escapeXml(yAxisTitle.toUpperCase())}</text>`,
    );
  }

  // Category labels (left column, right-aligned at the bars edge). CSS
  // truncation has no SVG equivalent — approximate with a character budget
  // derived from the column width, ellipsis beyond it. The FULL label always
  // survives in the <title>/<desc> consumer context and the live sr-table.
  if (showCategoryLabels && total > 0) {
    const maxChars = Math.max(3, Math.floor((labelColWidth - 10) / 6));
    points.forEach((point, i) => {
      if (!point.label) return;
      const text =
        point.label.length > maxChars
          ? `${point.label.slice(0, maxChars - 1)}…`
          : point.label;
      const cy = barsTop + i * (rowH + gap) + rowH / 2 + 3.5;
      parts.push(
        `<text x="${r2(barsLeft - 6)}" y="${r2(cy)}" text-anchor="end" font-family="${monoFont}" font-size="11" fill="${muted}">${escapeXml(text)}</text>`,
      );
    });
  }

  // Baseline (zero axis) — a VERTICAL line, which equals the left edge only
  // when the data has no negatives.
  parts.push(
    `<line x1="${r2(baselineX)}" y1="${r2(barsTop)}" x2="${r2(baselineX)}" y2="${r2(barsBottom)}" stroke="${border}" stroke-width="1"/>`,
  );

  // Bottom edge of the bars area — drawn when the tick row renders, so the
  // value-positioned ticks visually hang off an axis (mirrors Column's
  // Y-axis line under showYTicks).
  if (showXTicks) {
    parts.push(
      `<line x1="${r2(barsLeft)}" y1="${r2(barsBottom)}" x2="${r2(barsLeft + barsAreaWidth)}" y2="${r2(barsBottom)}" stroke="${border}" stroke-width="1"/>`,
    );
  }

  // Watermark — diagonal text at low opacity, drawn BEFORE bars so bars and
  // axes sit on top. Mirrors the in-app Watermark component.
  if (watermark) {
    const wmCenterX = r2(barsLeft + barsAreaWidth / 2);
    const wmCenterY = r2(barsTop + barsAreaHeight / 2);
    const fontSize = Math.min(96, Math.max(32, Math.floor(barsAreaHeight / 3)));
    parts.push(
      `<text x="${wmCenterX}" y="${wmCenterY}" text-anchor="middle" dominant-baseline="middle" font-family="${pixelFont}" font-size="${fontSize}" fill="${foreground}" fill-opacity="0.06" letter-spacing="0.06em" transform="rotate(-20 ${wmCenterX} ${wmCenterY})">${escapeXml(watermark.toUpperCase())}</text>`,
    );
  }

  // Bars
  if (!allZero && total > 0) {
    points.forEach((point, i) => {
      const fillColor = point.color ?? accent;
      const useHatched = point.pattern === "hatched";
      const patternId = useHatched ? ensurePattern(fillColor) : null;

      const y = barsTop + i * (rowH + gap);
      const isNegative = point.value < 0;
      const ratio =
        range > 0
          ? Math.max(Math.abs(point.value) / range, point.value !== 0 ? 0.01 : 0)
          : 0;
      const w = ratio * barsAreaWidth;
      // Positive bars grow right from the baseline; negative bars grow left.
      const x = isNegative ? baselineX - w : baselineX;

      const fill = useHatched ? `url(#${patternId})` : fillColor;
      const path = isNegative
        ? leftRoundedBarPath(x, y, w, rowH, barRadius)
        : rightRoundedBarPath(x, y, w, rowH, barRadius);
      const strokeAttr = useHatched
        ? ` stroke="${fillColor}" stroke-width="1"`
        : "";
      parts.push(`<path d="${path}" fill="${fill}"${strokeAttr}/>`);

      // Highlight outline (2px foreground)
      if (point.highlight) {
        const hpath = isNegative
          ? leftRoundedBarPath(x - 1, y - 1, w + 1, rowH + 2, barRadius + 1)
          : rightRoundedBarPath(x, y - 1, w + 1, rowH + 2, barRadius + 1);
        parts.push(
          `<path d="${hpath}" fill="none" stroke="${foreground}" stroke-width="2"/>`,
        );
      }

      // Inline data label at the OUTER end of the bar (right of positive,
      // left of negative — the Datawrapper convention). Deep bars (longer
      // than 86% of the range) flip the label INSIDE in background color,
      // matching the live render.
      const isDeep = w > barsAreaWidth * 0.86;
      const labelCy = y + rowH / 2 + 3.5;
      if (showLabels && point.value !== 0) {
        let labelX: number;
        let anchor: string;
        let fillCol: string;
        if (isNegative) {
          labelX = isDeep ? x + 4 : x - 4;
          anchor = isDeep ? "start" : "end";
          fillCol = isDeep ? background : muted;
        } else {
          labelX = isDeep ? x + w - 4 : x + w + 4;
          anchor = isDeep ? "end" : "start";
          fillCol = isDeep ? background : muted;
        }
        parts.push(
          `<text x="${r2(labelX)}" y="${r2(labelCy)}" text-anchor="${anchor}" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${fillCol}">${escapeXml(labelFormat(point.value))}</text>`,
        );
      }

      // Note at the outer end (sits beyond the value label if present — the
      // same fixed 44px budget the live render uses).
      if (point.note && point.value !== 0) {
        const noteOffset = showLabels ? 44 : 4;
        let noteX: number;
        let anchor: string;
        let fillCol: string;
        if (isNegative) {
          noteX = isDeep ? x + noteOffset : x - noteOffset;
          anchor = isDeep ? "start" : "end";
          fillCol = isDeep ? background : foreground;
        } else {
          noteX = isDeep ? x + w - noteOffset : x + w + noteOffset;
          anchor = isDeep ? "end" : "start";
          fillCol = isDeep ? background : foreground;
        }
        parts.push(
          `<text x="${r2(noteX)}" y="${r2(labelCy)}" text-anchor="${anchor}" font-family="${monoFont}" font-size="10" letter-spacing="0.06em" fill="${fillCol}">${escapeXml(point.note)}</text>`,
        );
      }
    });
  }

  // Reference line (drawn on top of bars) — VERTICAL, chip at the top.
  if (referenceLine && Number.isFinite(referenceLine.value) && range > 0) {
    const refX =
      barsLeft + ((referenceLine.value - min) / range) * barsAreaWidth;
    parts.push(
      `<line x1="${r2(refX)}" y1="${r2(barsTop)}" x2="${r2(refX)}" y2="${r2(barsBottom)}" stroke="${muted}" stroke-width="1" stroke-dasharray="4 2"/>`,
    );
    const refText = referenceLine.label
      ? `${referenceLine.label} · ${ctx.formatValue(referenceLine.value)}`
      : ctx.formatValue(referenceLine.value);
    // Background chip so the label reads on top of bars / the line.
    const txt = escapeXml(refText);
    const approxW = refText.length * 5.5 + 8;
    parts.push(
      `<rect x="${r2(refX - approxW / 2)}" y="${r2(barsTop - 13)}" width="${r2(approxW)}" height="13" fill="${background}"/>`,
    );
    parts.push(
      `<text x="${r2(refX)}" y="${r2(barsTop - 3)}" text-anchor="middle" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${txt}</text>`,
    );
  }

  // X-axis (value) ticks — value-positioned along the bottom edge.
  if (showXTicks) {
    for (const tick of xTicks) {
      const pct = range > 0 ? (tick - min) / range : 0;
      const tx = barsLeft + pct * barsAreaWidth;
      const anchor = pct <= 0 ? "start" : pct >= 1 ? "end" : "middle";
      parts.push(
        `<text x="${r2(tx)}" y="${r2(barsBottom + 14)}" text-anchor="${anchor}" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(xAxisFormat(tick))}</text>`,
      );
    }
  }

  // X-axis (value) title
  if (xAxisTitle) {
    const xtY = barsBottom + xTickRowHeight + 14;
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

/* ─── Generic helpers — duplicated from column-chart-export by design:
       registry items stay self-contained (a consumer installing only the
       Bar Chart gets a working export pipeline without pulling Column);
       chart-transforms.ts is the ONLY shared file (the math core). ───── */

/* ─── PNG conversion ────────────────────────────────────────────────── */

/**
 * Rasterize an SVG string into a PNG Blob via Image + Canvas.
 *
 * `scale` controls device-pixel density — 2 by default (retina-ready). The
 * SVG itself is rendered at its native size; scale multiplies the canvas
 * resolution so the PNG stays sharp when shared / printed.
 *
 * Duplicated from column-chart-export by design — registry items stay
 * self-contained; chart-transforms.ts is the only shared file.
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
 *
 * Duplicated from column-chart-export by design — registry items stay
 * self-contained; chart-transforms.ts is the only shared file.
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

/**
 * Trigger a browser download for any Blob, with a chosen file name.
 *
 * Duplicated from column-chart-export by design — registry items stay
 * self-contained; chart-transforms.ts is the only shared file.
 */
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
 *
 * Duplicated from column-chart-export by design — registry items stay
 * self-contained; chart-transforms.ts is the only shared file.
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
 * BarChartProps that is JSON-safe (no functions, no React nodes, no refs).
 *
 * Deliberately re-declares the relevant fields (instead of `Pick<...>`-ing
 * from BarChartProps) so the JSON contract is stable across React-side
 * refactors and so it can serve as the contract for a Python anywidget bridge
 * or a WordPress embed builder.
 */
export type BarChartJSON = {
  /** Schema version — bump when the JSON shape changes in a non-additive way. */
  $schema?: string;
  data: Array<
    | number
    | {
        label?: string;
        value: number;
        pattern?: BarChartPattern;
        color?: string;
        highlight?: boolean;
        note?: string;
      }
  >;
  labels?: string[];
  barThickness?: number;
  gap?: number;
  maxHeight?: number;
  labelWidth?: number;
  accent?: string;
  barRadius?: number;
  header?: { title?: string; subtitle?: string };
  xAxis?: {
    title?: string;
    /** Extend-only headroom; values below the data max are ignored. */
    max?: number;
    hideTicks?: boolean;
  };
  yAxis?: { title?: string; hideTicks?: boolean };
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
  referenceLine?: {
    value: number | { stat: "mean" | "median" };
    label?: string;
  };
  source?: string;
  description?: string;
  pattern?: BarChartPattern;
  patternStyle?: BarChartPatternStyle;
  scroll?: "none" | "auto";
  sort?: "none" | "asc" | "desc";
  topN?:
    | number
    | { n: number; label?: string; pinned?: boolean; distinct?: boolean };
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

export const BAR_CHART_JSON_SCHEMA = "brock-ui/bar-chart/v1";

/**
 * The set of props that are JSON-safe — everything not in this set is dropped
 * by `toJSON()`. Keeps the export small and prevents accidentally leaking
 * functions / React nodes / refs. Note what's NOT here vs Column: no trend,
 * no bands, no annotations, no hatchUntilIndex/hatchFromIndex, no height,
 * no minBarWidth — the v1 scope cuts and the horizontal pre-decisions.
 */
const JSON_SAFE_KEYS: Array<keyof BarChartJSON> = [
  "data",
  "labels",
  "barThickness",
  "gap",
  "maxHeight",
  "labelWidth",
  "accent",
  "barRadius",
  "header",
  "xAxis",
  "yAxis",
  "numberFormat",
  "dataLabels",
  "referenceLine",
  "source",
  "description",
  "pattern",
  "patternStyle",
  "scroll",
  "sort",
  "topN",
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
 * Serialize a props-like object to a portable JSON config. Anything that
 * isn't JSON-safe (callbacks like `onBarClick`, render fns like `formatValue`,
 * React nodes like `loadingFallback`, slot components, refs, `className`) is
 * dropped on the floor. Specifically:
 *
 *  - `error` is normalized: Error instances become their `.message` string;
 *    `null` is dropped entirely.
 *  - `dataLabels.format` is dropped (function); declarative bits (show) stay —
 *    `"auto"` survives as the literal string.
 *  - `numberFormat` is kept whole (already JSON-safe).
 *  - `exportable` may be `true` or an object — both stay.
 *  - `exportFileName` is kept only when it is a string (not a function).
 *
 * The result includes `$schema` so consumers can tell which version of the
 * contract they're reading.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJSON(props: Record<string, any>): BarChartJSON {
  const out: BarChartJSON = {
    $schema: BAR_CHART_JSON_SCHEMA,
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

    // data / labels — already JSON-safe, but make a defensive shallow copy
    // so callers can mutate the result without mutating props.
    if (key === "data" || key === "labels") {
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
 * that can be spread onto `<BarChart {...props} />`. Currently a thin
 * pass-through (the JSON shape is intentionally a strict subset of the props
 * shape) but the indirection means we can later layer migrations on top.
 *
 * Unknown keys are dropped silently, including the `$schema` field. If
 * `$schema` is present and doesn't match a known version, a console.warn
 * fires in development.
 */
export function fromJSON(input: BarChartJSON): Partial<BarChartJSON> {
  if (
    process.env.NODE_ENV !== "production" &&
    input.$schema &&
    input.$schema !== BAR_CHART_JSON_SCHEMA
  ) {
    console.warn(
      `[brock-ui] fromJSON: unknown $schema "${input.$schema}". Expected "${BAR_CHART_JSON_SCHEMA}". The config may not render correctly.`,
    );
  }
  const out: Partial<BarChartJSON> = {};
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
  /**
   * Override SVG height. By default the height DERIVES from the item count
   * (the same rule the live chart lives by): rows of `barThickness` + `gap`
   * plus chrome for header/axis/source.
   */
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
  /** Number formatter to apply across X-axis / tooltip / inline labels. */
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
 * with `role="img"` + the inline SVG. No external CSS, no external fonts
 * (system fallbacks listed in the SVG), no JavaScript — paste-able into
 * WordPress, Notion, Jupyter, an email, or a server-rendered page where the
 * React runtime isn't available.
 *
 * Resolves bar lengths, the zero baseline, and X-axis ticks the same way the
 * React render does, via the SAME transformDataPoints / computeStat pipeline
 * (canon §8 static parity) — sort, topN, stat reference lines, and negatives
 * all reproduce identically.
 */
export function renderToHTMLString(
  input: BarChartJSON,
  options: RenderToHTMLOptions = {},
): string {
  const width = options.width ?? 800;
  const colors = { ...DEFAULT_RENDER_COLORS, ...(options.colors ?? {}) };
  const fmt: (v: number) => string =
    options.formatValue ?? ((v: number) => v.toLocaleString());

  // Normalize raw `data` (number[] or object[]) into ExportPoints, stamped
  // with input order + key, then run the SAME transform pipeline
  // (topN -> sort) the live chart uses.
  const labels = input.labels ?? [];
  const inputPoints: ExportPoint[] = input.data
    .map((d, i) => {
      if (typeof d === "number") {
        return {
          label: labels[i],
          value: d,
          pattern: "solid" as BarChartPattern,
          key: labels[i] ?? String(i),
          inputIndex: i,
        };
      }
      return {
        label: d.label,
        value: d.value,
        pattern: d.pattern ?? ("solid" as BarChartPattern),
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

  // Height derives from the displayed item count — no height prop exists on
  // the live chart either (canon §13). Chrome budget covers header + ticks +
  // source for the common case.
  const barThickness = input.barThickness ?? 24;
  const gap = input.gap ?? 8;
  const derivedHeight =
    Math.max(
      40,
      exportPoints.length * barThickness +
        Math.max(0, exportPoints.length - 1) * gap,
    ) + 120;
  const height = options.height ?? derivedHeight;

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
    input.xAxis?.max !== undefined
      ? Math.max(input.xAxis.max, refBased)
      : refBased;
  const min =
    refValue !== undefined && refValue < 0
      ? Math.min(dataMin, refValue)
      : dataMin;
  const allZero = max === 0 && min === 0;
  const xTicks = allZero
    ? [0]
    : min < 0
      ? [max, 0, min]
      : [max, Math.round(max / 2), 0];

  // dataLabels "auto": direct labels at bar ends + hidden X (value) axis for
  // small N — same editorial rule as the live chart, "auto" is the default.
  const labelsMode = input.dataLabels?.show ?? "auto";
  const autoLabels = labelsMode === "auto";
  const showLabels =
    labelsMode === true ||
    (autoLabels && exportPoints.length > 0 && exportPoints.length <= 8);
  const showXTicks =
    input.xAxis?.hideTicks !== undefined
      ? !input.xAxis.hideTicks
      : !(autoLabels && showLabels);
  const hasAnyLabel = exportPoints.some((p) => p.label !== undefined);
  const showCategoryLabels = hasAnyLabel && !input.yAxis?.hideTicks;

  const description =
    input.description ??
    `Bar chart with ${exportPoints.length} data point${
      exportPoints.length === 1 ? "" : "s"
    }${input.source ? `. Source: ${input.source}.` : "."}`;

  const ctx: SynthesisContext = {
    width,
    height,
    points: exportPoints,
    max,
    min,
    allZero,
    gap,
    barRadius: input.barRadius ?? 0,
    patternStyle: input.patternStyle ?? "diagonal",
    labelWidth: input.labelWidth ?? 96,
    accent: input.accent ?? colors.accent,
    foreground: colors.foreground,
    muted: colors.muted,
    border: colors.border,
    background: colors.background,
    xTicks,
    xAxisFormat: fmt,
    formatValue: fmt,
    labelFormat: fmt,
    showLabels,
    showXTicks,
    showCategoryLabels,
    xAxisTitle: input.xAxis?.title,
    yAxisTitle: input.yAxis?.title,
    headerTitle: input.header?.title,
    headerSubtitle: input.header?.subtitle,
    referenceLine,
    source: input.source,
    caption: input.caption,
    watermark: input.watermark,
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
