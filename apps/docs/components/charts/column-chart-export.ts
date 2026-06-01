/**
 * Column Chart — export utilities.
 *
 * Three native export paths, zero external dependencies:
 *
 *  - synthesizeSVG()  — build a standalone SVG string from chart props.
 *                       Patterns (hatching) are emitted as <pattern> defs;
 *                       per-bar colors, highlight outlines, goal lines, plot
 *                       bands, data labels, notes, header, trend, source —
 *                       all reproduced so the export looks like the screen.
 *  - svgToPNG()       — rasterize that SVG via Image + Canvas at @2x (retina)
 *                       by default. Returns a Blob.
 *  - pointsToCSV()    — emit RFC-4180-style CSV of the visible data points.
 *
 * Plus small helpers: downloadBlob(), copyImageToClipboard().
 *
 * Lives in its own file (not the React component) so the synthesis logic can
 * be audited and tested independently, and so the component file stays a
 * reasonable size. Shipped alongside the component through the shadcn
 * registry as a companion file.
 */

import type {
  ColumnChartBand,
  ColumnChartGoal,
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
};

/** All the context needed to synthesize a faithful SVG export. */
export type SynthesisContext = {
  /** Output canvas in CSS pixels. */
  width: number;
  height: number;
  /** Bars data (already normalized — see normalize() in column-chart.tsx). */
  points: ExportPoint[];
  /** Max value used for bar-height scaling (includes goal if needed). */
  max: number;
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
  /** Goal line. */
  goal?: ColumnChartGoal;
  /** Plot bands. */
  bands?: readonly ColumnChartBand[];
  /** Source attribution. */
  source?: string;
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
    goal,
    bands,
    source,
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
    const txt = `${isPositive ? "↗ +" : "↘ "}${(trend! * 100).toFixed(1)}%`;
    const fill = isPositive ? accent : muted;
    const y = hasHeader ? 16 : 16;
    parts.push(
      `<text x="${r2(width)}" y="${y}" text-anchor="end" font-family="${monoFont}" font-size="11" font-variant-numeric="tabular-nums" fill="${fill}">${escapeXml(txt)}</text>`,
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
      const tickY =
        i === 0
          ? barsTop + 4
          : i === yTicks.length - 1
            ? barsBottom - 2
            : barsTop + (barsAreaHeight * i) / (yTicks.length - 1) + 4;
      parts.push(
        `<text x="${r2(barsLeft - 6)}" y="${r2(tickY)}" text-anchor="end" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(yAxisFormat(tick))}</text>`,
      );
    });
    // Vertical Y-axis line
    parts.push(
      `<line x1="${r2(barsLeft)}" y1="${r2(barsTop)}" x2="${r2(barsLeft)}" y2="${r2(barsBottom)}" stroke="${border}" stroke-width="1"/>`,
    );
  }

  // Baseline (X-axis)
  parts.push(
    `<line x1="${r2(barsLeft)}" y1="${r2(barsBottom)}" x2="${r2(width)}" y2="${r2(barsBottom)}" stroke="${border}" stroke-width="1"/>`,
  );

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
      const ratio =
        max > 0 ? Math.max(point.value / max, point.value > 0 ? 0.01 : 0) : 0;
      const h = ratio * barsAreaHeight;
      const y = barsBottom - h;

      const fill = useHatched ? `url(#${patternId})` : fillColor;
      const path = topRoundedBarPath(x, y, barWidth, h, barRadius);
      const strokeAttr = useHatched
        ? ` stroke="${fillColor}" stroke-width="1"`
        : "";
      parts.push(`<path d="${path}" fill="${fill}"${strokeAttr}/>`);

      // Highlight outline (2px foreground)
      if (point.highlight) {
        const hpath = topRoundedBarPath(
          x - 1,
          y - 1,
          barWidth + 2,
          h + 1,
          barRadius + 1,
        );
        parts.push(
          `<path d="${hpath}" fill="none" stroke="${foreground}" stroke-width="2"/>`,
        );
      }

      // Inline data label above bar
      if (showLabels && point.value > 0) {
        parts.push(
          `<text x="${r2(x + barWidth / 2)}" y="${r2(y - 4)}" text-anchor="middle" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${escapeXml(labelFormat(point.value))}</text>`,
        );
      }

      // Note above bar (sits above data label if present)
      if (point.note && point.value > 0) {
        const noteY = showLabels ? y - 18 : y - 4;
        parts.push(
          `<text x="${r2(x + barWidth / 2)}" y="${r2(noteY)}" text-anchor="middle" font-family="${monoFont}" font-size="10" letter-spacing="0.06em" fill="${foreground}">${escapeXml(point.note)}</text>`,
        );
      }
    });
  }

  // Goal line (drawn on top of bars)
  if (goal && Number.isFinite(goal.value) && goal.value > 0 && max > 0) {
    const goalY = barsBottom - (goal.value / max) * barsAreaHeight;
    parts.push(
      `<line x1="${r2(barsLeft)}" y1="${r2(goalY)}" x2="${r2(width)}" y2="${r2(goalY)}" stroke="${muted}" stroke-width="1" stroke-dasharray="4 2"/>`,
    );
    const goalText = goal.label
      ? `${goal.label} · ${ctx.formatValue(goal.value)}`
      : `Goal: ${ctx.formatValue(goal.value)}`;
    // White background chip so the label reads on top of bars
    const txt = escapeXml(goalText);
    const approxW = goalText.length * 5.5 + 8;
    parts.push(
      `<rect x="${r2(width - approxW - 2)}" y="${r2(goalY - 11)}" width="${r2(approxW)}" height="13" fill="${background}"/>`,
    );
    parts.push(
      `<text x="${r2(width - 4)}" y="${r2(goalY - 2)}" text-anchor="end" font-family="${monoFont}" font-size="10" font-variant-numeric="tabular-nums" fill="${muted}">${txt}</text>`,
    );
  }

  // X-axis labels
  if (hasAnyLabel && showXTicks) {
    const everyNth = total <= 24 ? 1 : Math.ceil(total / 12);
    points.forEach((point, i) => {
      if (!point.label || i % everyNth !== 0) return;
      const cx = barsLeft + i * (barWidth + gap) + barWidth / 2;
      parts.push(
        `<text x="${r2(cx)}" y="${r2(barsBottom + 14)}" text-anchor="middle" font-family="${pixelFont}" font-size="10" letter-spacing="0.06em" fill="${muted}">${escapeXml(point.label.toUpperCase())}</text>`,
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
