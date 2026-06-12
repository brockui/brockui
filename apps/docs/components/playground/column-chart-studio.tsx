/**
 * ColumnChartStudio — Highcharts × Flourish-inspired interface.
 *
 *  ┌─ Code ────┬─ Chart ─────────┬─ Settings ──┐
 *  │ live TSX  │  rendered chart │  12 panels  │
 *  └───────────┴─────────────────┴─────────────┘
 *
 * Every setting in the right rail mutates state → chart re-renders → code
 * regenerates. Code panel is read-only with a copy button (paste-into-app).
 *
 * The 12 MUST settings (sections):
 *  1. Data (preset)        7.  Color (accent)
 *  2. Header               8.  Bar style (radius + gap)
 *  3. X-axis               9.  Reference line
 *  4. Y-axis               10. Trend
 *  5. Number format        11. Source
 *  6. Data labels          12. Animation
 */

"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  ColumnChart,
  type ColumnChartDataPoint,
  type ColumnChartHandle,
  type ColumnChartSlots,
  type ColumnChartTooltipSlotProps,
} from "@/components/charts/column-chart";
import { toJSON } from "@/components/charts/column-chart-export";
import { CopyButton } from "@/components/ui/copy-button";

/* ─── Presets ────────────────────────────────────────────────────────── */

/**
 * Curated 18-swatch palette in Tailwind 500-range hues. Brock orange is first
 * so the Studio always opens on brand. Hover title shows the human name.
 */
const PALETTE = [
  { name: "Brock", value: "#F54900" },
  { name: "Red", value: "#EF4444" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Lime", value: "#84CC16" },
  { name: "Green", value: "#10B981" },
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Sky", value: "#0EA5E9" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Purple", value: "#A855F7" },
  { name: "Fuchsia", value: "#D946EF" },
  { name: "Pink", value: "#EC4899" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Zinc", value: "#71717A" },
] as const;

const DEFAULT_ACCENT = "#F54900";

const HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_RE.test(withHash)) return null;
  if (withHash.length === 4) {
    // Expand #rgb → #rrggbb
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

function isInPalette(hex: string): boolean {
  const normalized = hex.toLowerCase();
  return PALETTE.some((c) => c.value.toLowerCase() === normalized);
}

const RADII = [
  { name: "Sharp", value: 0 },
  { name: "Subtle", value: 2 },
  { name: "Rounded", value: 6 },
] as const;

const DENSITIES = [
  { name: "Compact", value: 1 },
  { name: "Normal", value: 4 },
  { name: "Spacious", value: 10 },
] as const;

const PATTERN_STYLES = [
  { name: "Diagonal", value: "diagonal" },
  { name: "Reverse", value: "diagonal-reverse" },
  { name: "Vertical", value: "vertical" },
  { name: "Horizontal", value: "horizontal" },
  { name: "Dots", value: "dots" },
] as const;

const NOTATIONS = [
  { name: "Std", value: "standard" },
  { name: "Compact", value: "compact" },
  { name: "Sci", value: "scientific" },
] as const;

const NUMBER_STYLES = [
  { name: "Decimal", value: "decimal" },
  { name: "Currency", value: "currency" },
  { name: "Percent", value: "percent" },
] as const;

type DatasetKey =
  | "weekly"
  | "daily"
  | "twoWeeks"
  | "month"
  | "fortyDays"
  | "quarter";

/**
 * Pseudo-random but stable series — deterministic so the Studio looks the same
 * each render. Sine-modulated with a bit of variance so the shape is readable.
 */
function generateSeries(n: number, base: number, amplitude: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const wave = Math.sin(i / Math.max(2, n / 6)) * amplitude;
    const noise = ((i * 31) % 11) - 5; // -5..+5, deterministic
    out.push(Math.max(0, Math.round(base + wave + noise * (amplitude / 10))));
  }
  return out;
}

function dayLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
}

const DATASETS: Record<
  DatasetKey,
  {
    label: string;
    data: number[];
    labels: string[];
    suggestedGoal: number;
    suggestedGoalLabel: string;
  }
> = {
  weekly: {
    label: "7d",
    data: [142, 168, 187, 159, 203, 178, 215],
    labels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    suggestedGoal: 190,
    suggestedGoalLabel: "Weekly target",
  },
  daily: {
    label: "14d",
    data: [42, 68, 51, 89, 73, 105, 96, 82, 119, 87, 64, 93, 110, 78],
    labels: dayLabels(14),
    suggestedGoal: 100,
    suggestedGoalLabel: "Daily target",
  },
  twoWeeks: {
    label: "20d",
    data: generateSeries(20, 80, 30),
    labels: dayLabels(20),
    suggestedGoal: 100,
    suggestedGoalLabel: "Target",
  },
  month: {
    label: "30d",
    data: generateSeries(30, 90, 40),
    labels: dayLabels(30),
    suggestedGoal: 120,
    suggestedGoalLabel: "Monthly target",
  },
  fortyDays: {
    label: "40d",
    data: generateSeries(40, 95, 45),
    labels: dayLabels(40),
    suggestedGoal: 130,
    suggestedGoalLabel: "Target",
  },
  quarter: {
    label: "90d",
    data: generateSeries(90, 100, 60),
    labels: dayLabels(90),
    suggestedGoal: 150,
    suggestedGoalLabel: "Quarter target",
  },
};

/* ─── State shape ────────────────────────────────────────────────────── */

type StudioState = {
  // data
  period: DatasetKey;
  sortIdx: number; // 0 = none, 1 = asc, 2 = desc
  topNEnabled: boolean;
  topNValue: number;
  // states
  stateMode: "ready" | "loading" | "loading-overlay" | "error";
  errorMessage: string;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
  withRetry: boolean;
  // export
  exportPNG: boolean;
  exportSVG: boolean;
  exportCSV: boolean;
  exportCopy: boolean;
  exportFileName: string;
  // events
  eventsEnabled: boolean;
  lastClickIndex: number | null;
  lastClickLabel: string | null;
  lastClickValue: number | null;
  hoverIndex: number | null;
  hoverLabel: string | null;
  focusIndex: number | null;
  focusLabel: string | null;
  // slots (Studio demo)
  slotTooltip: boolean;
  slotEmpty: boolean;
  slotCaption: boolean;
  slotWatermark: boolean;
  // editorial
  captionText: string;
  watermarkText: string;
  annotationsEnabled: boolean;
  annotationText: string;
  annotationLabel: string;
  annotationY: number;
  annotationAnchor: "top" | "bottom" | "left" | "right";
  annotationArrow: boolean;
  // forward-compat
  dataDescription: string;
  testId: string;
  showJSON: boolean;
  // header
  headerTitle: string;
  headerSubtitle: string;
  // x-axis
  xAxisTitle: string;
  xAxisHideTicks: boolean;
  // y-axis
  yAxisTitle: string;
  yAxisHideTicks: boolean;
  yAxisMaxEnabled: boolean;
  yAxisMax: number;
  // number format
  numberPrefix: string;
  numberSuffix: string;
  numberDecimals: number;
  numberNotationIdx: number;
  numberStyleIdx: number;
  numberCurrency: string;
  // bands
  bandsEnabled: boolean;
  bandFrom: number;
  bandTo: number;
  bandLabel: string;
  // data labels
  dataLabelsShow: boolean;
  // color
  accentValue: string;
  recentColors: string[];
  // bar style
  radiusIdx: number;
  densityIdx: number;
  // pattern
  hatchMode: "none" | "first" | "last" | "all";
  hatchIndex: number;
  patternStyleIdx: number;
  // scalability
  minBarWidth: number;
  scrollEnabled: boolean;
  // emphasis
  emphasisMode: "none" | "peak" | "current" | "index";
  emphasisIndex: number;
  emphasisColor: string;
  emphasisNote: string;
  // reference line
  refShow: boolean;
  refStatIdx: number; // 0 = fixed value, 1 = mean, 2 = median
  refValue: number;
  refLabel: string;
  // trend
  trendShow: boolean;
  trendValue: number;
  // source
  sourceShow: boolean;
  sourceText: string;
  // animation
  animationEnabled: boolean;
  animationDuration: number;
};

const INITIAL_STATE: StudioState = {
  period: "weekly",
  sortIdx: 0,
  topNEnabled: false,
  topNValue: 5,
  stateMode: "ready",
  errorMessage: "Couldn't load metrics — the upstream API timed out.",
  loadingLabel: "Loading…",
  errorLabel: "Error",
  retryLabel: "Retry",
  withRetry: true,
  exportPNG: true,
  exportSVG: true,
  exportCSV: true,
  exportCopy: true,
  exportFileName: "active-users-7d",
  eventsEnabled: true,
  lastClickIndex: null,
  lastClickLabel: null,
  lastClickValue: null,
  hoverIndex: null,
  hoverLabel: null,
  focusIndex: null,
  focusLabel: null,
  slotTooltip: false,
  slotEmpty: false,
  slotCaption: false,
  slotWatermark: false,
  captionText: "",
  watermarkText: "",
  annotationsEnabled: false,
  annotationText: "← peak",
  annotationLabel: "FRI",
  annotationY: 220,
  annotationAnchor: "top",
  annotationArrow: true,
  dataDescription: "",
  testId: "",
  showJSON: false,
  headerTitle: "Active users",
  headerSubtitle: "Last 7 days",
  xAxisTitle: "",
  xAxisHideTicks: false,
  yAxisTitle: "",
  yAxisHideTicks: false,
  yAxisMaxEnabled: false,
  yAxisMax: 250,
  numberPrefix: "",
  numberSuffix: "",
  numberDecimals: 0,
  numberNotationIdx: 0,
  numberStyleIdx: 0,
  numberCurrency: "USD",
  bandsEnabled: false,
  bandFrom: 2,
  bandTo: 4,
  bandLabel: "Q3 push",
  dataLabelsShow: false,
  accentValue: DEFAULT_ACCENT,
  recentColors: [],
  radiusIdx: 0,
  densityIdx: 1,
  hatchMode: "none",
  hatchIndex: 4,
  patternStyleIdx: 0,
  minBarWidth: 4,
  scrollEnabled: false,
  emphasisMode: "none",
  emphasisIndex: 0,
  emphasisColor: "",
  emphasisNote: "← peak",
  refShow: true,
  refStatIdx: 0,
  refValue: 190,
  refLabel: "Weekly target",
  trendShow: true,
  trendValue: 0.184,
  sourceShow: true,
  sourceText: "Brock Analytics, 2026",
  animationEnabled: true,
  animationDuration: 400,
};

/* ─── Code generator ─────────────────────────────────────────────────── */

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * Resolve the emphasized bar index from the current Studio state. Returns -1
 * when emphasis is off, the data range is empty, or the user-supplied index
 * falls outside the series.
 */
function emphasisIdxOf(s: StudioState, ds: { data: number[] }): number {
  if (s.emphasisMode === "none" || ds.data.length === 0) return -1;
  if (s.emphasisMode === "peak") {
    let best = 0;
    for (let i = 1; i < ds.data.length; i += 1) {
      if (ds.data[i] > ds.data[best]) best = i;
    }
    return best;
  }
  if (s.emphasisMode === "current") return ds.data.length - 1;
  const idx = Math.max(0, Math.min(ds.data.length - 1, s.emphasisIndex));
  return idx;
}

function generateCode(s: StudioState): string {
  const ds = DATASETS[s.period];
  const accent = s.accentValue;
  const radius = RADII[s.radiusIdx];
  const density = DENSITIES[s.densityIdx];
  const emphasisIdx = emphasisIdxOf(s, ds);

  const lines: string[] = [];
  lines.push(`import { ColumnChart } from "@/components/charts/column-chart";`);
  lines.push("");
  if (emphasisIdx >= 0) {
    // Object-form data — single source of truth for value + label + emphasis.
    const parts = ds.data.map((v, i) => {
      const fields = [`label: ${quote(ds.labels[i] ?? "")}`, `value: ${v}`];
      if (i === emphasisIdx) {
        if (s.emphasisColor) fields.push(`color: ${quote(s.emphasisColor)}`);
        fields.push(`highlight: true`);
        if (s.emphasisNote) fields.push(`note: ${quote(s.emphasisNote)}`);
      }
      return `  { ${fields.join(", ")} }`;
    });
    lines.push(`const data = [\n${parts.join(",\n")}\n];`);
  } else {
    lines.push(`const data = [${ds.data.join(", ")}];`);
    lines.push(`const labels = [${ds.labels.map(quote).join(", ")}];`);
  }
  lines.push("");
  lines.push(`export function Example() {`);
  lines.push(`  return (`);
  lines.push(`    <ColumnChart`);
  lines.push(`      data={data}`);
  if (emphasisIdx < 0) {
    lines.push(`      labels={labels}`);
  }
  lines.push(`      height={240}`);
  lines.push(`      gap={${density.value}}`);

  if (accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase()) {
    lines.push(`      accent=${quote(accent)}`);
  }
  if (radius.value !== 0) {
    lines.push(`      barRadius={${radius.value}}`);
  }
  if (s.headerTitle || s.headerSubtitle) {
    const parts: string[] = [];
    if (s.headerTitle) parts.push(`title: ${quote(s.headerTitle)}`);
    if (s.headerSubtitle) parts.push(`subtitle: ${quote(s.headerSubtitle)}`);
    lines.push(`      header={{ ${parts.join(", ")} }}`);
  }
  if (s.xAxisTitle || s.xAxisHideTicks) {
    const parts: string[] = [];
    if (s.xAxisTitle) parts.push(`title: ${quote(s.xAxisTitle)}`);
    if (s.xAxisHideTicks) parts.push(`hideTicks: true`);
    lines.push(`      xAxis={{ ${parts.join(", ")} }}`);
  }
  if (
    s.yAxisTitle ||
    s.yAxisHideTicks ||
    s.yAxisMaxEnabled
  ) {
    const parts: string[] = [];
    if (s.yAxisTitle) parts.push(`title: ${quote(s.yAxisTitle)}`);
    if (s.yAxisMaxEnabled) parts.push(`max: ${s.yAxisMax}`);
    if (s.yAxisHideTicks) parts.push(`hideTicks: true`);
    lines.push(`      yAxis={{ ${parts.join(", ")} }}`);
  }
  const notationVal = NOTATIONS[s.numberNotationIdx].value;
  const styleVal = NUMBER_STYLES[s.numberStyleIdx].value;
  const hasNumberFormat =
    s.numberPrefix ||
    s.numberSuffix ||
    s.numberDecimals > 0 ||
    notationVal !== "standard" ||
    styleVal !== "decimal";
  if (hasNumberFormat) {
    const parts: string[] = [];
    if (s.numberPrefix) parts.push(`prefix: ${quote(s.numberPrefix)}`);
    if (s.numberSuffix) parts.push(`suffix: ${quote(s.numberSuffix)}`);
    if (s.numberDecimals > 0) parts.push(`decimals: ${s.numberDecimals}`);
    if (notationVal !== "standard")
      parts.push(`notation: ${quote(notationVal)}`);
    if (styleVal !== "decimal") parts.push(`style: ${quote(styleVal)}`);
    if (styleVal === "currency")
      parts.push(`currency: ${quote(s.numberCurrency || "USD")}`);
    lines.push(`      numberFormat={{ ${parts.join(", ")} }}`);
  }
  if (s.dataLabelsShow) {
    lines.push(`      dataLabels={{ show: true }}`);
  }
  if (s.trendShow) {
    lines.push(`      trend={${s.trendValue}}`);
  }
  if (s.refShow) {
    const refValueCode =
      s.refStatIdx === 1
        ? `{ stat: "mean" }`
        : s.refStatIdx === 2
          ? `{ stat: "median" }`
          : `${s.refValue}`;
    const refLabelCode =
      s.refStatIdx === 0 && s.refLabel
        ? `, label: ${quote(s.refLabel)}`
        : "";
    lines.push(
      `      referenceLine={{ value: ${refValueCode}${refLabelCode} }}`,
    );
  }
  if (s.sourceShow && s.sourceText) {
    lines.push(`      source=${quote(s.sourceText)}`);
  }
  if (s.hatchMode === "first" && s.hatchIndex > 0) {
    lines.push(`      hatchUntilIndex={${s.hatchIndex}}`);
  } else if (s.hatchMode === "last" && s.hatchIndex >= 0) {
    lines.push(`      hatchFromIndex={${s.hatchIndex}}`);
  } else if (s.hatchMode === "all") {
    lines.push(`      pattern="hatched"`);
  }
  const styleValue = PATTERN_STYLES[s.patternStyleIdx].value;
  if (s.hatchMode !== "none" && styleValue !== "diagonal") {
    lines.push(`      patternStyle=${quote(styleValue)}`);
  }
  if (s.scrollEnabled) {
    lines.push(`      scroll="auto"`);
  }
  if (s.minBarWidth !== 4) {
    lines.push(`      minBarWidth={${s.minBarWidth}}`);
  }
  const sortValue = (["none", "asc", "desc"] as const)[s.sortIdx];
  if (sortValue !== "none") {
    lines.push(`      sort=${quote(sortValue)}`);
  }
  if (s.topNEnabled && s.topNValue > 0) {
    lines.push(`      topN={${s.topNValue}}`);
  }
  if (s.bandsEnabled) {
    const from = Math.max(0, Math.min(ds.data.length - 1, s.bandFrom));
    const to = Math.max(from, Math.min(ds.data.length - 1, s.bandTo));
    const fields: string[] = [`from: ${from}`, `to: ${to}`];
    if (s.bandLabel) fields.push(`label: ${quote(s.bandLabel)}`);
    lines.push(`      bands={[{ ${fields.join(", ")} }]}`);
  }
  if (!s.animationEnabled || s.animationDuration !== 400) {
    const parts: string[] = [];
    if (!s.animationEnabled) parts.push(`enabled: false`);
    if (s.animationDuration !== 400) {
      parts.push(`duration: ${s.animationDuration}`);
    }
    lines.push(`      animation={{ ${parts.join(", ")} }}`);
  }
  // State machine — emit only the props matching the selected preview state.
  if (s.stateMode === "loading" || s.stateMode === "loading-overlay") {
    lines.push(`      loading`);
    if (s.loadingLabel && s.loadingLabel !== "Loading…") {
      lines.push(`      loadingLabel=${quote(s.loadingLabel)}`);
    }
  }
  if (s.stateMode === "error") {
    lines.push(
      `      error=${quote(s.errorMessage || "Something went wrong")}`,
    );
    if (s.errorLabel && s.errorLabel !== "Error") {
      lines.push(`      errorLabel=${quote(s.errorLabel)}`);
    }
    if (s.withRetry) {
      lines.push(`      onRetry={() => refetch()}`);
      if (s.retryLabel && s.retryLabel !== "Retry") {
        lines.push(`      retryLabel=${quote(s.retryLabel)}`);
      }
    }
  }
  // Editorial — caption / watermark / annotations.
  if (s.captionText) {
    lines.push(`      caption=${quote(s.captionText)}`);
  }
  if (s.watermarkText) {
    lines.push(`      watermark=${quote(s.watermarkText)}`);
  }
  // Forward-compat metadata.
  if (s.dataDescription) {
    lines.push(`      dataDescription=${quote(s.dataDescription)}`);
  }
  if (s.testId) {
    lines.push(`      data-testid=${quote(s.testId)}`);
  }
  if (s.annotationsEnabled && s.annotationText) {
    const parts: string[] = [];
    parts.push(`x: ${quote(s.annotationLabel)}`);
    parts.push(`y: ${s.annotationY}`);
    parts.push(`text: ${quote(s.annotationText)}`);
    if (s.annotationAnchor !== "top") {
      parts.push(`anchor: ${quote(s.annotationAnchor)}`);
    }
    if (s.annotationArrow) parts.push(`arrow: true`);
    lines.push(`      annotations={[{ ${parts.join(", ")} }]}`);
  }
  // Slots — emit an illustrative slot dictionary when any are active.
  const anySlot =
    s.slotTooltip || s.slotEmpty || s.slotCaption || s.slotWatermark;
  if (anySlot) {
    lines.push(`      slots={{`);
    if (s.slotTooltip) {
      lines.push(`        tooltip: ({ point, index, value }) => (`);
      lines.push(`          <div className="rounded border p-2">`);
      lines.push(`            <span>#{index + 1}: {value}</span>`);
      lines.push(`          </div>`);
      lines.push(`        ),`);
    }
    if (s.slotEmpty) {
      lines.push(`        empty: ({ height }) => (`);
      lines.push(`          <div style={{ height }}>Custom empty</div>`);
      lines.push(`        ),`);
    }
    if (s.slotCaption) {
      lines.push(`        caption: () => (`);
      lines.push(`          <p className="text-xs italic">Reading note…</p>`);
      lines.push(`        ),`);
    }
    if (s.slotWatermark) {
      lines.push(`        watermark: () => <Logo opacity={0.06} />,`);
    }
    lines.push(`      }}`);
  }
  // Events — emit a short illustrative handler for each enabled callback.
  if (s.eventsEnabled) {
    lines.push(`      onBarClick={(point, index) => {`);
    lines.push(`        console.log("clicked", index, point);`);
    lines.push(`      }}`);
    lines.push(`      onBarHover={(point, index) => {`);
    lines.push(`        // point is null on mouse leave`);
    lines.push(`        setHoverIndex(index);`);
    lines.push(`      }}`);
    lines.push(`      onBarFocus={(point, index) => {`);
    lines.push(`        // Fires on keyboard navigation`);
    lines.push(`        announce(\`Bar \${index + 1}: \${point.value}\`);`);
    lines.push(`      }}`);
  }
  // Export — emit the most concise form. `exportable` true for all-on, an
  // object for partial selection, omitted when fully off.
  const anyExport =
    s.exportPNG || s.exportSVG || s.exportCSV || s.exportCopy;
  const allExport =
    s.exportPNG && s.exportSVG && s.exportCSV && s.exportCopy;
  if (anyExport) {
    if (allExport) {
      lines.push(`      exportable`);
    } else {
      const fields: string[] = [];
      if (s.exportPNG) fields.push("png: true");
      if (s.exportSVG) fields.push("svg: true");
      if (s.exportCSV) fields.push("csv: true");
      if (s.exportCopy) fields.push("copy: true");
      lines.push(`      exportable={{ ${fields.join(", ")} }}`);
    }
    if (s.exportFileName && s.exportFileName !== "chart") {
      lines.push(`      exportFileName=${quote(s.exportFileName)}`);
    }
  }

  lines.push(`    />`);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join("\n");
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function ColumnChartStudio() {
  const [s, setS] = useState<StudioState>(INITIAL_STATE);
  const chartRef = useRef<ColumnChartHandle>(null);

  // Inline demo slot components — show what slot overrides look like
  // without requiring users to wire their own. Each is a tiny illustrative
  // implementation that drops Brock UI defaults.
  const slots = (() => {
    if (
      !s.slotTooltip &&
      !s.slotEmpty &&
      !s.slotCaption &&
      !s.slotWatermark
    ) {
      return undefined;
    }
    const out: ColumnChartSlots = {};
    if (s.slotTooltip) {
      const DemoTooltip: React.FC<ColumnChartTooltipSlotProps> = ({
        point,
        index,
        value,
        label,
      }) => {
        return (
          <div className="flex flex-col gap-1 rounded-[2px] border-2 border-brock-accent bg-background p-2 shadow-lg">
            <span className="font-pixel text-[10px] tracking-wider text-brock-accent uppercase">
              Bar #{index + 1}{label ? ` · ${label}` : ""}
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {value}
            </span>
            {point.note && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {point.note}
              </span>
            )}
          </div>
        );
      };
      out.tooltip = DemoTooltip;
    }
    if (s.slotEmpty) {
      out.empty = function DemoEmpty({ height, source }) {
        return (
          <div>
            <div
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-brock-accent/40 bg-brock-accent/5"
              style={{ height }}
            >
              <span className="font-pixel text-xl tracking-wider text-brock-accent">
                ✺ ✺ ✺
              </span>
              <span className="font-sans text-sm text-foreground">
                Custom empty slot — your data is on holiday.
              </span>
            </div>
            {source && (
              <div className="mt-4 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
                Source: {source}
              </div>
            )}
          </div>
        );
      };
    }
    if (s.slotCaption) {
      out.caption = function DemoCaption() {
        return (
          <div className="mt-2 border-l-2 border-brock-accent bg-muted/30 px-3 py-2 font-sans text-xs text-muted-foreground italic">
            Reading note: bars marked with{" "}
            <span className="font-pixel text-foreground">▒</span> are projected.
            Updated every 5 minutes.
          </div>
        );
      };
    }
    if (s.slotWatermark) {
      out.watermark = function DemoWatermark() {
        return (
          <div className="flex h-full items-center justify-center">
            <span className="rotate-[-20deg] font-pixel text-5xl tracking-wider text-brock-accent/10 select-none">
              BROCK · UI
            </span>
          </div>
        );
      };
    }
    return out;
  })();

  function update<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function setPeriod(period: DatasetKey) {
    const ds = DATASETS[period];
    setS((prev) => ({
      ...prev,
      period,
      refValue: ds.suggestedGoal,
      refLabel: ds.suggestedGoalLabel,
    }));
  }

  const ds = DATASETS[s.period];
  const accent = s.accentValue;
  const radius = RADII[s.radiusIdx];
  const density = DENSITIES[s.densityIdx];
  const code = generateCode(s);

  function pickColor(hex: string) {
    setS((prev) => {
      const fromPalette = isInPalette(hex);
      const cleanedRecent = prev.recentColors.filter(
        (c) => c.toLowerCase() !== hex.toLowerCase(),
      );
      const nextRecent = fromPalette
        ? prev.recentColors
        : [hex, ...cleanedRecent].slice(0, 3);
      return { ...prev, accentValue: hex, recentColors: nextRecent };
    });
  }

  const emphasisIdx = emphasisIdxOf(s, ds);
  const chartData =
    emphasisIdx >= 0
      ? ds.data.map((value, i) => {
          const point: ColumnChartDataPoint = {
            label: ds.labels[i],
            value,
          };
          if (i === emphasisIdx) {
            if (s.emphasisColor) point.color = s.emphasisColor;
            point.highlight = true;
            if (s.emphasisNote) point.note = s.emphasisNote;
          }
          return point;
        })
      : ds.data;

  // For the "loading" preview we need the chart to render the FULL skeleton
  // (no-data + loading). Passing an empty data array triggers that path.
  // "loading-overlay" keeps the data so the overlay variant renders on top.
  // "error" passes the message; the chart will replace itself with ErrorState.
  const effectiveChartData =
    s.stateMode === "loading" ? [] : chartData;
  const effectiveLabels =
    s.stateMode === "loading"
      ? undefined
      : emphasisIdx >= 0
        ? undefined
        : ds.labels;
  const effectiveLoading =
    s.stateMode === "loading" || s.stateMode === "loading-overlay";
  const effectiveError =
    s.stateMode === "error" ? s.errorMessage || "Unknown error" : undefined;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_260px] lg:gap-0">
      {/* ── Code panel (left) ─────────────────────────────────────── */}
      <div className="border border-border bg-card lg:border-r-0">
        <PanelHeader label="Code">
          <CopyButton text={code} />
        </PanelHeader>
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
          <code>{code}</code>
        </pre>
      </div>

      {/* ── Chart panel (center) ──────────────────────────────────── */}
      <div className="border border-border bg-card">
        <PanelHeader label="Chart" />
        <div className="p-6">
          <ColumnChart
            ref={chartRef}
            slots={slots}
            caption={s.captionText || undefined}
            watermark={s.watermarkText || undefined}
            dataDescription={s.dataDescription || undefined}
            data-testid={s.testId || undefined}
            annotations={
              s.annotationsEnabled && s.annotationText
                ? [
                    {
                      x: s.annotationLabel,
                      y: s.annotationY,
                      text: s.annotationText,
                      anchor: s.annotationAnchor,
                      arrow: s.annotationArrow,
                    },
                  ]
                : undefined
            }
            onBarClick={
              s.eventsEnabled
                ? (point, index) =>
                    setS((prev) => ({
                      ...prev,
                      lastClickIndex: index,
                      lastClickLabel: point.label ?? null,
                      lastClickValue: point.value,
                    }))
                : undefined
            }
            onBarHover={
              s.eventsEnabled
                ? (point, index) =>
                    setS((prev) => ({
                      ...prev,
                      hoverIndex: index,
                      hoverLabel: point?.label ?? null,
                    }))
                : undefined
            }
            onBarFocus={
              s.eventsEnabled
                ? (point, index) =>
                    setS((prev) => ({
                      ...prev,
                      focusIndex: index,
                      focusLabel: point.label ?? null,
                    }))
                : undefined
            }
            data={effectiveChartData}
            labels={effectiveLabels}
            loading={effectiveLoading}
            error={effectiveError}
            onRetry={
              s.stateMode === "error" && s.withRetry
                ? () => {
                    // In the Studio demo, "retry" simply flips back to ready
                    // so users can see the flow end-to-end.
                    setS((prev) => ({ ...prev, stateMode: "ready" }));
                  }
                : undefined
            }
            loadingLabel={s.loadingLabel || undefined}
            errorLabel={s.errorLabel || undefined}
            retryLabel={s.retryLabel || undefined}
            exportable={
              s.exportPNG || s.exportSVG || s.exportCSV || s.exportCopy
                ? {
                    png: s.exportPNG,
                    svg: s.exportSVG,
                    csv: s.exportCSV,
                    copy: s.exportCopy,
                  }
                : false
            }
            exportFileName={s.exportFileName || "chart"}
            height={260}
            gap={density.value}
            accent={accent}
            barRadius={radius.value}
            header={
              s.headerTitle || s.headerSubtitle
                ? { title: s.headerTitle, subtitle: s.headerSubtitle }
                : undefined
            }
            xAxis={
              s.xAxisTitle || s.xAxisHideTicks
                ? {
                    title: s.xAxisTitle || undefined,
                    hideTicks: s.xAxisHideTicks,
                  }
                : undefined
            }
            yAxis={
              s.yAxisTitle ||
              s.yAxisHideTicks ||
              s.yAxisMaxEnabled
                ? {
                    title: s.yAxisTitle || undefined,
                    hideTicks: s.yAxisHideTicks,
                    max: s.yAxisMaxEnabled ? s.yAxisMax : undefined,
                  }
                : undefined
            }
            numberFormat={(() => {
              const notation = NOTATIONS[s.numberNotationIdx].value;
              const style = NUMBER_STYLES[s.numberStyleIdx].value;
              const active =
                s.numberPrefix ||
                s.numberSuffix ||
                s.numberDecimals > 0 ||
                notation !== "standard" ||
                style !== "decimal";
              if (!active) return undefined;
              return {
                prefix: s.numberPrefix || undefined,
                suffix: s.numberSuffix || undefined,
                decimals: s.numberDecimals,
                notation,
                style,
                currency:
                  style === "currency" ? s.numberCurrency || "USD" : undefined,
              };
            })()}
            dataLabels={s.dataLabelsShow ? { show: true } : undefined}
            trend={s.trendShow ? s.trendValue : undefined}
            referenceLine={
              s.refShow
                ? {
                    value:
                      s.refStatIdx === 1
                        ? { stat: "mean" as const }
                        : s.refStatIdx === 2
                          ? { stat: "median" as const }
                          : s.refValue,
                    label:
                      s.refStatIdx === 0 && s.refLabel ? s.refLabel : undefined,
                  }
                : undefined
            }
            source={s.sourceShow ? s.sourceText : undefined}
            pattern={s.hatchMode === "all" ? "hatched" : "solid"}
            hatchUntilIndex={
              s.hatchMode === "first" && s.hatchIndex > 0
                ? s.hatchIndex
                : undefined
            }
            hatchFromIndex={
              s.hatchMode === "last" && s.hatchIndex >= 0
                ? s.hatchIndex
                : undefined
            }
            patternStyle={
              s.hatchMode !== "none"
                ? PATTERN_STYLES[s.patternStyleIdx].value
                : undefined
            }
            scroll={s.scrollEnabled ? "auto" : "none"}
            minBarWidth={s.minBarWidth}
            sort={(["none", "asc", "desc"] as const)[s.sortIdx]}
            topN={s.topNEnabled ? s.topNValue : undefined}
            bands={
              s.bandsEnabled
                ? [
                    {
                      from: Math.max(
                        0,
                        Math.min(ds.data.length - 1, s.bandFrom),
                      ),
                      to: Math.max(
                        Math.min(ds.data.length - 1, s.bandFrom),
                        Math.min(ds.data.length - 1, s.bandTo),
                      ),
                      label: s.bandLabel || undefined,
                    },
                  ]
                : undefined
            }
            animation={{
              enabled: s.animationEnabled,
              duration: s.animationDuration,
            }}
          />
        </div>
        {s.showJSON && (
          <div className="border-t border-border">
            <PanelHeader label="JSON · toJSON() output">
              <CopyButton
                text={JSON.stringify(
                  toJSON({
                    data: ds.data,
                    labels: ds.labels,
                    height: 260,
                    gap: density.value,
                    accent,
                    barRadius: radius.value,
                    header:
                      s.headerTitle || s.headerSubtitle
                        ? {
                            title: s.headerTitle,
                            subtitle: s.headerSubtitle,
                          }
                        : undefined,
                    trend: s.trendShow ? s.trendValue : undefined,
                    referenceLine: s.refShow
                      ? {
                          value:
                            s.refStatIdx === 1
                              ? { stat: "mean" as const }
                              : s.refStatIdx === 2
                                ? { stat: "median" as const }
                                : s.refValue,
                          label:
                            s.refStatIdx === 0 && s.refLabel
                              ? s.refLabel
                              : undefined,
                        }
                      : undefined,
                    source: s.sourceShow ? s.sourceText : undefined,
                    caption: s.captionText || undefined,
                    watermark: s.watermarkText || undefined,
                    dataDescription: s.dataDescription || undefined,
                    chartType: "column",
                  }),
                  null,
                  2,
                )}
              />
            </PanelHeader>
            <pre className="max-h-72 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
              <code>
                {JSON.stringify(
                  toJSON({
                    data: ds.data,
                    labels: ds.labels,
                    height: 260,
                    gap: density.value,
                    accent,
                    barRadius: radius.value,
                    header:
                      s.headerTitle || s.headerSubtitle
                        ? {
                            title: s.headerTitle,
                            subtitle: s.headerSubtitle,
                          }
                        : undefined,
                    trend: s.trendShow ? s.trendValue : undefined,
                    referenceLine: s.refShow
                      ? {
                          value:
                            s.refStatIdx === 1
                              ? { stat: "mean" as const }
                              : s.refStatIdx === 2
                                ? { stat: "median" as const }
                                : s.refValue,
                          label:
                            s.refStatIdx === 0 && s.refLabel
                              ? s.refLabel
                              : undefined,
                        }
                      : undefined,
                    source: s.sourceShow ? s.sourceText : undefined,
                    caption: s.captionText || undefined,
                    watermark: s.watermarkText || undefined,
                    dataDescription: s.dataDescription || undefined,
                    chartType: "column",
                  }),
                  null,
                  2,
                )}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* ── Settings panel (right) ────────────────────────────────── */}
      <aside className="border border-border bg-card lg:border-l-0">
        <PanelHeader label="Settings" />
        <div className="divide-y divide-border">
          <Accordion label="Data" defaultOpen>
            <Field label="Preset">
              <Segmented
                options={(Object.keys(DATASETS) as DatasetKey[]).map(
                  (k) => DATASETS[k].label,
                )}
                selectedIndex={(Object.keys(DATASETS) as DatasetKey[]).indexOf(
                  s.period,
                )}
                onSelect={(i) =>
                  setPeriod((Object.keys(DATASETS) as DatasetKey[])[i])
                }
              />
            </Field>
            <Field label="Sort by value">
              <Segmented
                options={["None", "Asc", "Desc"]}
                selectedIndex={s.sortIdx}
                onSelect={(i) => update("sortIdx", i)}
              />
            </Field>
            <Field label="Top-N + Other">
              <div className="space-y-1.5">
                <Toggle
                  label="Roll the long tail into 'Other'"
                  checked={s.topNEnabled}
                  onChange={(v) => update("topNEnabled", v)}
                />
                {s.topNEnabled && (
                  <NumberInput
                    value={s.topNValue}
                    onChange={(v) => update("topNValue", Math.max(1, v))}
                  />
                )}
              </div>
            </Field>
          </Accordion>

          <Accordion label="States">
            <Field label="Mode">
              <Segmented
                options={["Ready", "Loading", "Refresh", "Error"]}
                selectedIndex={
                  {
                    ready: 0,
                    loading: 1,
                    "loading-overlay": 2,
                    error: 3,
                  }[s.stateMode]
                }
                onSelect={(i) =>
                  update(
                    "stateMode",
                    (
                      [
                        "ready",
                        "loading",
                        "loading-overlay",
                        "error",
                      ] as const
                    )[i],
                  )
                }
              />
            </Field>
            {(s.stateMode === "loading" ||
              s.stateMode === "loading-overlay") && (
              <Field label="Loading label">
                <TextInput
                  value={s.loadingLabel}
                  onChange={(v) => update("loadingLabel", v)}
                  placeholder="Loading…"
                />
              </Field>
            )}
            {s.stateMode === "error" && (
              <>
                <Field label="Error message">
                  <TextInput
                    value={s.errorMessage}
                    onChange={(v) => update("errorMessage", v)}
                    placeholder="Couldn't load metrics…"
                  />
                </Field>
                <Field label="Error label">
                  <TextInput
                    value={s.errorLabel}
                    onChange={(v) => update("errorLabel", v)}
                    placeholder="Error"
                  />
                </Field>
                <Toggle
                  label="Show retry button"
                  checked={s.withRetry}
                  onChange={(v) => update("withRetry", v)}
                />
                {s.withRetry && (
                  <Field label="Retry label">
                    <TextInput
                      value={s.retryLabel}
                      onChange={(v) => update("retryLabel", v)}
                      placeholder="Retry"
                    />
                  </Field>
                )}
              </>
            )}
          </Accordion>

          <Accordion label="Export">
            <Field label="Formats">
              <div className="space-y-1.5">
                <Toggle
                  label="PNG button"
                  checked={s.exportPNG}
                  onChange={(v) => update("exportPNG", v)}
                />
                <Toggle
                  label="SVG button"
                  checked={s.exportSVG}
                  onChange={(v) => update("exportSVG", v)}
                />
                <Toggle
                  label="CSV button"
                  checked={s.exportCSV}
                  onChange={(v) => update("exportCSV", v)}
                />
                <Toggle
                  label="Copy-image button"
                  checked={s.exportCopy}
                  onChange={(v) => update("exportCopy", v)}
                />
              </div>
            </Field>
            <Field label="File name">
              <TextInput
                value={s.exportFileName}
                onChange={(v) => update("exportFileName", v)}
                placeholder="active-users-7d"
              />
            </Field>
          </Accordion>

          <Accordion label="Slots">
            <Field label="Demo slot overrides">
              <div className="space-y-1.5">
                <Toggle
                  label="Custom tooltip"
                  checked={s.slotTooltip}
                  onChange={(v) => update("slotTooltip", v)}
                />
                <Toggle
                  label="Custom empty state"
                  checked={s.slotEmpty}
                  onChange={(v) => update("slotEmpty", v)}
                />
                <Toggle
                  label="Reading-note caption"
                  checked={s.slotCaption}
                  onChange={(v) => update("slotCaption", v)}
                />
                <Toggle
                  label="Diagonal watermark"
                  checked={s.slotWatermark}
                  onChange={(v) => update("slotWatermark", v)}
                />
              </div>
            </Field>
            {s.slotEmpty && (
              <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                Switch <code>Data Mode</code> below to test the empty slot, or
                clear the data array in code.
              </div>
            )}
          </Accordion>

          <Accordion label="Events">
            <Toggle
              label="Track click / hover / focus"
              checked={s.eventsEnabled}
              onChange={(v) => update("eventsEnabled", v)}
            />
            {s.eventsEnabled && (
              <>
                <Field label="Last click">
                  <div
                    className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.lastClickIndex !== null
                      ? `#${s.lastClickIndex} · ${s.lastClickLabel ?? "—"} · ${s.lastClickValue}`
                      : "— no clicks yet —"}
                  </div>
                </Field>
                <Field label="Hovering">
                  <div
                    className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.hoverIndex !== null
                      ? `#${s.hoverIndex} · ${s.hoverLabel ?? "—"}`
                      : "— mouse outside —"}
                  </div>
                </Field>
                <Field label="Focused">
                  <div
                    className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.focusIndex !== null
                      ? `#${s.focusIndex} · ${s.focusLabel ?? "—"}`
                      : "— no focus yet —"}
                  </div>
                </Field>
                <Field label="Programmatic focus (ref.focusBar)">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground"
                      onClick={() => chartRef.current?.focusBar(0)}
                    >
                      ◀ First
                    </button>
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground"
                      onClick={() => {
                        const next = (s.focusIndex ?? -1) + 1;
                        chartRef.current?.focusBar(next);
                      }}
                    >
                      Next ▶
                    </button>
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground"
                      onClick={() => chartRef.current?.focusBar(999)}
                    >
                      Last ▶▶
                    </button>
                  </div>
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label="Header">
            <Field label="Title">
              <TextInput
                value={s.headerTitle}
                onChange={(v) => update("headerTitle", v)}
                placeholder="Active users"
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={s.headerSubtitle}
                onChange={(v) => update("headerSubtitle", v)}
                placeholder="Last 7 days"
              />
            </Field>
          </Accordion>

          <Accordion label="X-axis">
            <Field label="Title">
              <TextInput
                value={s.xAxisTitle}
                onChange={(v) => update("xAxisTitle", v)}
                placeholder="Day of week"
              />
            </Field>
            <Toggle
              label="Hide tick labels"
              checked={s.xAxisHideTicks}
              onChange={(v) => update("xAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label="Y-axis">
            <Field label="Title">
              <TextInput
                value={s.yAxisTitle}
                onChange={(v) => update("yAxisTitle", v)}
                placeholder="Users"
              />
            </Field>
            <Toggle
              label="Custom max"
              checked={s.yAxisMaxEnabled}
              onChange={(v) => update("yAxisMaxEnabled", v)}
            />
            {s.yAxisMaxEnabled && (
              <Field label="Max value">
                <NumberInput
                  value={s.yAxisMax}
                  onChange={(v) => update("yAxisMax", v)}
                />
              </Field>
            )}
            <Toggle
              label="Hide tick labels"
              checked={s.yAxisHideTicks}
              onChange={(v) => update("yAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label="Number format">
            <Field label="Prefix">
              <TextInput
                value={s.numberPrefix}
                onChange={(v) => update("numberPrefix", v)}
                placeholder="$"
              />
            </Field>
            <Field label="Suffix">
              <TextInput
                value={s.numberSuffix}
                onChange={(v) => update("numberSuffix", v)}
                placeholder="k"
              />
            </Field>
            <Field label="Decimals">
              <NumberInput
                value={s.numberDecimals}
                onChange={(v) => update("numberDecimals", Math.max(0, v))}
              />
            </Field>
            <Field label="Notation">
              <Segmented
                options={NOTATIONS.map((n) => n.name)}
                selectedIndex={s.numberNotationIdx}
                onSelect={(i) => update("numberNotationIdx", i)}
              />
            </Field>
            <Field label="Style">
              <Segmented
                options={NUMBER_STYLES.map((n) => n.name)}
                selectedIndex={s.numberStyleIdx}
                onSelect={(i) => update("numberStyleIdx", i)}
              />
            </Field>
            {NUMBER_STYLES[s.numberStyleIdx].value === "currency" && (
              <Field label="Currency (ISO 4217)">
                <TextInput
                  value={s.numberCurrency}
                  onChange={(v) => update("numberCurrency", v.toUpperCase())}
                  placeholder="USD"
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Data labels">
            <Toggle
              label="Show value above each bar"
              checked={s.dataLabelsShow}
              onChange={(v) => update("dataLabelsShow", v)}
            />
          </Accordion>

          <Accordion label="Color">
            <Field label="Palette">
              <ColorPalette
                value={s.accentValue}
                onSelect={pickColor}
              />
            </Field>
            <Field label="Custom">
              <ColorCustomInput
                value={s.accentValue}
                onChange={pickColor}
              />
            </Field>
            {s.recentColors.length > 0 && (
              <Field label="Recent">
                <div className="flex gap-1.5">
                  {s.recentColors.map((c) => (
                    <Swatch
                      key={c}
                      color={c}
                      selected={
                        c.toLowerCase() === s.accentValue.toLowerCase()
                      }
                      onClick={() => pickColor(c)}
                      title={c}
                    />
                  ))}
                </div>
              </Field>
            )}
          </Accordion>

          <Accordion label="Bar style">
            <Field label="Corner radius">
              <Segmented
                options={RADII.map((r) => r.name)}
                selectedIndex={s.radiusIdx}
                onSelect={(i) => update("radiusIdx", i)}
              />
            </Field>
            <Field label="Density">
              <Segmented
                options={DENSITIES.map((d) => d.name)}
                selectedIndex={s.densityIdx}
                onSelect={(i) => update("densityIdx", i)}
              />
            </Field>
          </Accordion>

          <Accordion label="Scalability">
            <Toggle
              label="Horizontal scroll when bars don't fit"
              checked={s.scrollEnabled}
              onChange={(v) => update("scrollEnabled", v)}
            />
            <Field label="Min bar width (px)">
              <NumberInput
                value={s.minBarWidth}
                onChange={(v) =>
                  update("minBarWidth", Math.max(1, Math.floor(v)))
                }
              />
            </Field>
          </Accordion>

          <Accordion label="Pattern">
            <Field label="Mode">
              <Segmented
                options={["None", "First", "Last", "All"]}
                selectedIndex={
                  { none: 0, first: 1, last: 2, all: 3 }[s.hatchMode]
                }
                onSelect={(i) =>
                  update(
                    "hatchMode",
                    (["none", "first", "last", "all"] as const)[i],
                  )
                }
              />
            </Field>
            {(s.hatchMode === "first" || s.hatchMode === "last") && (
              <Field
                label={s.hatchMode === "first" ? "Until index" : "From index"}
              >
                <NumberInput
                  value={s.hatchIndex}
                  onChange={(v) =>
                    update("hatchIndex", Math.max(0, Math.floor(v)))
                  }
                />
              </Field>
            )}
            {s.hatchMode !== "none" && (
              <Field label="Style">
                <Select
                  options={PATTERN_STYLES.map((p) => p.name)}
                  selectedIndex={s.patternStyleIdx}
                  onSelect={(i) => update("patternStyleIdx", i)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Emphasis">
            <Field label="Mode">
              <Segmented
                options={["None", "Peak", "Current", "Index"]}
                selectedIndex={
                  { none: 0, peak: 1, current: 2, index: 3 }[s.emphasisMode]
                }
                onSelect={(i) =>
                  update(
                    "emphasisMode",
                    (["none", "peak", "current", "index"] as const)[i],
                  )
                }
              />
            </Field>
            {s.emphasisMode === "index" && (
              <Field label="Bar index">
                <NumberInput
                  value={s.emphasisIndex}
                  onChange={(v) =>
                    update("emphasisIndex", Math.max(0, Math.floor(v)))
                  }
                />
              </Field>
            )}
            {s.emphasisMode !== "none" && (
              <>
                <Field label="Note (above bar)">
                  <TextInput
                    value={s.emphasisNote}
                    onChange={(v) => update("emphasisNote", v)}
                    placeholder="← peak"
                  />
                </Field>
                <Field label="Custom color (optional)">
                  <ColorCustomInput
                    value={s.emphasisColor || s.accentValue}
                    onChange={(v) => update("emphasisColor", v)}
                  />
                </Field>
                {s.emphasisColor && (
                  <button
                    onClick={() => update("emphasisColor", "")}
                    className="cursor-pointer font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase hover:text-foreground"
                  >
                    × clear color (use accent)
                  </button>
                )}
              </>
            )}
          </Accordion>

          <Accordion label="Reference line">
            <Toggle
              label="Show reference line"
              checked={s.refShow}
              onChange={(v) => update("refShow", v)}
            />
            {s.refShow && (
              <>
                <Field label="Mode">
                  <Segmented
                    options={["Value", "Mean", "Median"]}
                    selectedIndex={s.refStatIdx}
                    onSelect={(i) => update("refStatIdx", i)}
                  />
                </Field>
                {s.refStatIdx === 0 && (
                  <>
                    <Field label="Value">
                      <NumberInput
                        value={s.refValue}
                        onChange={(v) => update("refValue", v)}
                      />
                    </Field>
                    <Field label="Label">
                      <TextInput
                        value={s.refLabel}
                        onChange={(v) => update("refLabel", v)}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
          </Accordion>

          <Accordion label="Bands">
            <Toggle
              label="Show plot band"
              checked={s.bandsEnabled}
              onChange={(v) => update("bandsEnabled", v)}
            />
            {s.bandsEnabled && (
              <>
                <Field label="From index">
                  <NumberInput
                    value={s.bandFrom}
                    onChange={(v) =>
                      update("bandFrom", Math.max(0, Math.floor(v)))
                    }
                  />
                </Field>
                <Field label="To index">
                  <NumberInput
                    value={s.bandTo}
                    onChange={(v) =>
                      update("bandTo", Math.max(0, Math.floor(v)))
                    }
                  />
                </Field>
                <Field label="Label">
                  <TextInput
                    value={s.bandLabel}
                    onChange={(v) => update("bandLabel", v)}
                    placeholder="Q3 push"
                  />
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label="Trend">
            <Toggle
              label="Show trend indicator"
              checked={s.trendShow}
              onChange={(v) => update("trendShow", v)}
            />
            {s.trendShow && (
              <Field label="Value (0.184 = +18.4%)">
                <NumberInput
                  value={s.trendValue}
                  step={0.01}
                  onChange={(v) => update("trendValue", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Editorial">
            <Field label="Caption (italic note below source)">
              <TextInput
                value={s.captionText}
                onChange={(v) => update("captionText", v)}
                placeholder="Excludes weekends."
              />
            </Field>
            <Field label="Watermark (diagonal text behind chart)">
              <TextInput
                value={s.watermarkText}
                onChange={(v) => update("watermarkText", v)}
                placeholder="DRAFT"
              />
            </Field>
            <Toggle
              label="Show annotation"
              checked={s.annotationsEnabled}
              onChange={(v) => update("annotationsEnabled", v)}
            />
            {s.annotationsEnabled && (
              <>
                <Field label="Text">
                  <TextInput
                    value={s.annotationText}
                    onChange={(v) => update("annotationText", v)}
                    placeholder="← peak"
                  />
                </Field>
                <Field label="X (label match)">
                  <TextInput
                    value={s.annotationLabel}
                    onChange={(v) => update("annotationLabel", v)}
                    placeholder="FRI"
                  />
                </Field>
                <Field label="Y (data-space value)">
                  <NumberInput
                    value={s.annotationY}
                    onChange={(v) => update("annotationY", v)}
                  />
                </Field>
                <Field label="Anchor">
                  <Segmented
                    options={["Top", "Right", "Bottom", "Left"]}
                    selectedIndex={
                      { top: 0, right: 1, bottom: 2, left: 3 }[
                        s.annotationAnchor
                      ]
                    }
                    onSelect={(i) =>
                      update(
                        "annotationAnchor",
                        (["top", "right", "bottom", "left"] as const)[i],
                      )
                    }
                  />
                </Field>
                <Toggle
                  label="Dashed connector to bar"
                  checked={s.annotationArrow}
                  onChange={(v) => update("annotationArrow", v)}
                />
              </>
            )}
          </Accordion>

          <Accordion label="Source">
            <Toggle
              label="Show source line"
              checked={s.sourceShow}
              onChange={(v) => update("sourceShow", v)}
            />
            {s.sourceShow && (
              <Field label="Text">
                <TextInput
                  value={s.sourceText}
                  onChange={(v) => update("sourceText", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Animation">
            <Toggle
              label="Enable mount animation"
              checked={s.animationEnabled}
              onChange={(v) => update("animationEnabled", v)}
            />
            {s.animationEnabled && (
              <Field label="Duration (ms)">
                <NumberInput
                  value={s.animationDuration}
                  step={50}
                  onChange={(v) =>
                    update("animationDuration", Math.max(0, v))
                  }
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Forward-compat">
            <Field label="dataDescription (AI/LLM metadata)">
              <TextInput
                value={s.dataDescription}
                onChange={(v) => update("dataDescription", v)}
                placeholder="Daily active users, last 7 days"
              />
            </Field>
            <Field label="data-testid (QA selector)">
              <TextInput
                value={s.testId}
                onChange={(v) => update("testId", v)}
                placeholder="active-users-chart"
              />
            </Field>
            <Toggle
              label="Show JSON (portable config)"
              checked={s.showJSON}
              onChange={(v) => update("showJSON", v)}
            />
            {s.showJSON && (
              <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                JSON dumps below the chart panel — paste into a notebook,
                WordPress, or pass to <code>renderToHTMLString()</code>.
              </div>
            )}
          </Accordion>
        </div>
      </aside>
    </div>
  );
}

/* ─── Panel/section primitives ───────────────────────────────────────── */

function PanelHeader({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-border px-3">
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function Accordion({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-foreground hover:bg-muted/40"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

function Swatch({
  color,
  selected,
  onClick,
  title,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-6 w-6 cursor-pointer rounded-[2px] transition-all ${
        selected
          ? "ring-2 ring-offset-2 ring-offset-card"
          : "opacity-70 hover:opacity-100"
      }`}
      style={
        {
          backgroundColor: color,
          ...(selected
            ? ({ "--tw-ring-color": color } as React.CSSProperties)
            : {}),
        } as React.CSSProperties
      }
      aria-label={`Color ${title}`}
      aria-pressed={selected}
      title={title}
    />
  );
}

function ColorPalette({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (hex: string) => void;
}) {
  const lower = value.toLowerCase();
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {PALETTE.map((c) => (
        <Swatch
          key={c.name}
          color={c.value}
          selected={c.value.toLowerCase() === lower}
          onClick={() => onSelect(c.value)}
          title={c.name}
        />
      ))}
    </div>
  );
}

function ColorCustomInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);

  // Keep the text field in sync when accent changes from outside (palette click).
  if (text.toLowerCase() !== value.toLowerCase() && document.activeElement?.tagName !== "INPUT") {
    setText(value);
  }

  function commit(raw: string) {
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-[2px] border border-border bg-transparent p-0.5"
        aria-label="Pick custom color"
        title="Color picker"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        placeholder="#F54900"
        spellCheck={false}
        className="flex-1 rounded-[2px] border border-border bg-background px-2 py-1.5 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground/40 focus:border-brock-accent focus:outline-none"
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[2px] border border-border bg-background px-2 py-1.5 font-sans text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-brock-accent focus:outline-none"
    />
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (!Number.isNaN(next)) onChange(next);
      }}
      className="w-full rounded-[2px] border border-border bg-background px-2 py-1.5 font-mono text-xs tabular-nums text-foreground focus:border-brock-accent focus:outline-none"
    />
  );
}

function Segmented({
  options,
  selectedIndex,
  onSelect,
}: {
  options: readonly string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex rounded-[2px] border border-border bg-muted/40 p-0.5">
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={opt}
            onClick={() => onSelect(i)}
            title={opt}
            className={`min-w-0 flex-1 cursor-pointer truncate rounded-[2px] px-1.5 py-1 text-center text-[11px] transition-colors ${
              selected
                ? "bg-brock-accent text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={selected}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact native-select dropdown for option lists too long or too wordy for a
 * Segmented control in the 260px settings rail. Styled to match the rest of the
 * panel (border, rounded-[2px], mono caret).
 */
function Select({
  options,
  selectedIndex,
  onSelect,
}: {
  options: readonly string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="relative">
      <select
        value={selectedIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full cursor-pointer appearance-none rounded-[2px] border border-border bg-background py-1.5 pr-7 pl-2 font-sans text-xs text-foreground focus:border-brock-accent focus:outline-none"
      >
        {options.map((opt, i) => (
          <option key={opt} value={i}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border transition-colors ${
          checked
            ? "border-brock-accent bg-brock-accent"
            : "border-muted-foreground/50 bg-transparent"
        }`}
      >
        {checked && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-2.5 w-2.5 text-primary-foreground"
            aria-hidden
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span>{label}</span>
    </label>
  );
}
