/**
 * LineChartStudio — Highcharts × Flourish-inspired interface, ported from
 * ColumnChartStudio for the multi-series Line Chart (canon §13).
 *
 *  ┌─ Code ────┬─ Chart ─────────┬─ Settings ──┐
 *  │ live TSX  │  rendered chart │  panels     │
 *  └───────────┴─────────────────┴─────────────┘
 *
 * Every setting in the right rail mutates state → chart re-renders → code
 * regenerates. Code panel is read-only with a copy button (paste-into-app).
 *
 * What changed vs Column/Bar (the line-specific surface): a MULTI-SERIES data
 * editor (1–4 series, one emphasized at a time), Lines (curve/width/markers/
 * gridlines/lastValueDot), Scale (linear/log + zero baseline + min/max),
 * Labels & legend (direct / top / none + direct-label values), Emphasis
 * (which series is highlighted), and a single Events & bands accordion (a demo
 * vertical event marker + a shaded x-range band). NO bar-only controls
 * (radius/pattern/topN/sort/min-bar-width). Slots are a code feature — shown as
 * a Usage snippet on the page, not a Studio toggle.
 *
 * The chrome primitives below (Accordion / Field / Segmented / Toggle /
 * TextInput / NumberInput / Select / PanelHeader / PreviewThemeToggle /
 * ColorPalette / Swatch / ColorCustomInput + PALETTE / DEFAULT_ACCENT /
 * normalizeHex) are COPY-PASTED from column-chart-studio, same convention as
 * bar-chart-studio. This is the third copy — the Rule of Three says "extract on
 * the third occurrence", but the Studios deliberately stay self-contained so
 * each ships as one file through the registry; the duplication is intentional.
 */

"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LineChart,
  type LineChartHandle,
  type LineChartSeries,
} from "@/components/charts/line-chart";
import { toJSON } from "@/components/charts/line-chart-export";
import { CopyButton } from "@/components/ui/copy-button";
import {
  StudioThemeToggle,
  useStudioPreviewTheme,
} from "./studio-theme";
import {
  Accordion,
  ColorCustomInput,
  DEFAULT_ACCENT,
  Field,
  NumberInput,
  PanelHeader,
  Segmented,
  Select,
  TextInput,
  Toggle,
} from "./studio-ui";

/* ─── Presets ────────────────────────────────────────────────────────── */

const CURVES = [
  { name: "Linear", value: "linear" },
  { name: "Monotone", value: "monotone" },
] as const;

const MARKERS = [
  { name: "Auto", value: "auto" },
  { name: "Always", value: "always" },
  { name: "None", value: "none" },
] as const;

const Y_SCALES = [
  { name: "Linear", value: "linear" },
  { name: "Log", value: "log" },
] as const;

const LEGENDS = [
  { name: "None", value: "none" },
  { name: "Direct", value: "direct" },
  { name: "Top", value: "top" },
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

type StudioLocale = "en" | "ru";

/* ─── Series presets ─────────────────────────────────────────────────── */

type PresetKey = "twoMetrics" | "countries" | "single";

/**
 * One series in a preset: a name (per-locale), a numeric value list (shared),
 * a stable hue, and dashed/emphasis hints. x labels are shared per preset.
 */
type PresetSeries = {
  name: Record<StudioLocale, string>;
  values: number[];
  color: string;
  dashed?: boolean;
  emphasis?: boolean;
};

type Preset = {
  label: Record<StudioLocale, string>;
  /** Shared x-axis labels across the preset's series. */
  labels: string[];
  series: PresetSeries[];
  suggestedGoal: number;
  suggestedGoalLabel: Record<StudioLocale, string>;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];

const PRESETS: Record<PresetKey, Preset> = {
  twoMetrics: {
    label: { en: "Two metrics", ru: "Две метрики" },
    labels: MONTHS,
    series: [
      {
        name: { en: "Revenue", ru: "Выручка" },
        values: [120, 138, 131, 159, 172, 188],
        color: DEFAULT_ACCENT,
        emphasis: true,
      },
      {
        name: { en: "Costs", ru: "Расходы" },
        values: [98, 104, 109, 112, 118, 121],
        color: "#71717A",
      },
    ],
    suggestedGoal: 150,
    suggestedGoalLabel: { en: "Target", ru: "Цель" },
  },
  countries: {
    label: { en: "Country comparison", ru: "Сравнение стран" },
    labels: QUARTERS,
    series: [
      {
        name: { en: "Kazakhstan", ru: "Казахстан" },
        values: [100, 108, 121, 130, 142, 151, 163, 178],
        color: DEFAULT_ACCENT,
        emphasis: true,
      },
      {
        name: { en: "Region avg", ru: "Среднее по региону" },
        values: [100, 103, 107, 109, 114, 116, 119, 122],
        color: "#71717A",
      },
      {
        name: { en: "Forecast", ru: "Прогноз" },
        values: [100, 105, 112, 118, 126, 133, 140, 149],
        color: "#a1a1aa",
        dashed: true,
      },
    ],
    suggestedGoal: 140,
    suggestedGoalLabel: { en: "Index 140", ru: "Индекс 140" },
  },
  single: {
    label: { en: "Single series", ru: "Один ряд" },
    labels: MONTHS,
    series: [
      {
        name: { en: "Active users", ru: "Активные" },
        values: [142, 168, 159, 203, 178, 215],
        color: DEFAULT_ACCENT,
        emphasis: true,
      },
    ],
    suggestedGoal: 190,
    suggestedGoalLabel: { en: "Weekly target", ru: "Цель недели" },
  },
};

/* ─── State shape ────────────────────────────────────────────────────── */

type StudioSeries = {
  name: string;
  color: string;
  dashed: boolean;
  emphasis: boolean;
  /** Per-series value list — null marks a gap. */
  values: (number | null)[];
};

type StudioState = {
  // data
  preset: PresetKey;
  labels: string[];
  series: StudioSeries[];
  // lines
  curveIdx: number;
  lineWidth: number;
  markersIdx: number;
  gridlines: boolean;
  lastValueDot: boolean;
  // scale
  yScaleIdx: number;
  yBaselineZero: boolean;
  yAxisMinEnabled: boolean;
  yAxisMin: number;
  yAxisMaxEnabled: boolean;
  yAxisMax: number;
  // labels & legend
  legendIdx: number;
  directLabels: boolean;
  directLabelValues: boolean;
  // emphasis
  emphasisIdx: number; // -1 = none
  // reference line
  refShow: boolean;
  refStatIdx: number; // 0 = fixed value, 1 = mean, 2 = median
  refValue: number;
  refLabel: string;
  // events & bands
  eventEnabled: boolean;
  eventX: string;
  eventLabel: string;
  bandEnabled: boolean;
  bandFrom: string;
  bandTo: string;
  bandLabel: string;
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
  // events (callbacks)
  eventsEnabled: boolean;
  lastClickKey: string | null;
  lastClickValue: number | null;
  hoverKey: string | null;
  focusKey: string | null;
  // header
  headerTitle: string;
  headerSubtitle: string;
  // x-axis
  xAxisTitle: string;
  xAxisHideTicks: boolean;
  // y-axis
  yAxisTitle: string;
  yAxisHideTicks: boolean;
  // number format
  numberPrefix: string;
  numberSuffix: string;
  numberDecimals: number;
  numberNotationIdx: number;
  numberStyleIdx: number;
  numberCurrency: string;
  // trend
  trendShow: boolean;
  trendValue: number;
  // editorial
  captionText: string;
  watermarkText: string;
  // source
  sourceShow: boolean;
  sourceText: string;
  // animation
  animationEnabled: boolean;
  animationDuration: number;
  // forward-compat
  dataDescription: string;
  testId: string;
  showJSON: boolean;
};

/** Build the initial series state from a preset, for a locale. */
function seriesFromPreset(preset: Preset, locale: StudioLocale): StudioSeries[] {
  return preset.series.map((s) => ({
    name: s.name[locale],
    color: s.color,
    dashed: s.dashed ?? false,
    emphasis: s.emphasis ?? false,
    values: [...s.values],
  }));
}

const INITIAL_STATE: StudioState = {
  preset: "twoMetrics",
  labels: [...PRESETS.twoMetrics.labels],
  series: seriesFromPreset(PRESETS.twoMetrics, "en"),
  curveIdx: 0,
  lineWidth: 1.75,
  markersIdx: 0,
  gridlines: true,
  lastValueDot: false,
  yScaleIdx: 0,
  yBaselineZero: false,
  yAxisMinEnabled: false,
  yAxisMin: 0,
  yAxisMaxEnabled: false,
  yAxisMax: 200,
  legendIdx: 1,
  directLabels: true,
  directLabelValues: false,
  emphasisIdx: 0,
  refShow: false,
  refStatIdx: 0,
  refValue: 150,
  refLabel: "Target",
  eventEnabled: false,
  eventX: "MAR",
  eventLabel: "Launch",
  bandEnabled: false,
  bandFrom: "APR",
  bandTo: "MAY",
  bandLabel: "Campaign",
  stateMode: "ready",
  errorMessage: "Couldn't load the series — the upstream API timed out.",
  loadingLabel: "Loading…",
  errorLabel: "Error",
  retryLabel: "Retry",
  withRetry: true,
  exportPNG: true,
  exportSVG: true,
  exportCSV: true,
  exportCopy: true,
  exportFileName: "revenue-vs-costs",
  eventsEnabled: true,
  lastClickKey: null,
  lastClickValue: null,
  hoverKey: null,
  focusKey: null,
  headerTitle: "Revenue vs costs",
  headerSubtitle: "Last 6 months",
  xAxisTitle: "",
  xAxisHideTicks: false,
  yAxisTitle: "",
  yAxisHideTicks: false,
  numberPrefix: "",
  numberSuffix: "",
  numberDecimals: 0,
  numberNotationIdx: 0,
  numberStyleIdx: 0,
  numberCurrency: "USD",
  trendShow: false,
  trendValue: 0.184,
  captionText: "",
  watermarkText: "",
  sourceShow: true,
  sourceText: "Brock Analytics, 2026",
  animationEnabled: true,
  animationDuration: 600,
  dataDescription: "",
  testId: "",
  showJSON: false,
};

const MAX_SERIES = 4;

/* ─── Code generator ─────────────────────────────────────────────────── */

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/** Resolve the emphasized series name from state, or undefined for "none". */
function emphasisNameOf(s: StudioState): string | undefined {
  if (s.emphasisIdx < 0 || s.emphasisIdx >= s.series.length) return undefined;
  return s.series[s.emphasisIdx].name;
}

/** Build the LineChartSeries[] the live chart + code both consume. */
function buildSeries(s: StudioState): LineChartSeries[] {
  const emphasisName = emphasisNameOf(s);
  return s.series.map((ser) => ({
    name: ser.name,
    data: ser.values,
    color: ser.color,
    ...(ser.dashed ? { dashed: true } : {}),
    ...(emphasisName !== undefined && ser.name === emphasisName
      ? { emphasis: true }
      : {}),
  }));
}

function generateLineChartCode(s: StudioState): string {
  const emphasisName = emphasisNameOf(s);
  const singleSeries = s.series.length === 1;

  const lines: string[] = [];
  lines.push(`import { LineChart } from "@/components/charts/line-chart";`);
  lines.push("");

  if (singleSeries) {
    const ser = s.series[0];
    lines.push(`const data = [${ser.values.map((v) => (v === null ? "null" : v)).join(", ")}];`);
    lines.push(`const labels = [${s.labels.map(quote).join(", ")}];`);
  } else {
    lines.push(`const data = [`);
    s.series.forEach((ser, i) => {
      const fields = [
        `name: ${quote(ser.name)}`,
        `data: [${ser.values.map((v) => (v === null ? "null" : v)).join(", ")}]`,
      ];
      if (ser.color) fields.push(`color: ${quote(ser.color)}`);
      if (ser.dashed) fields.push(`dashed: true`);
      const trail = i < s.series.length - 1 ? "," : "";
      lines.push(`  { ${fields.join(", ")} }${trail}`);
    });
    lines.push(`];`);
    lines.push(`const labels = [${s.labels.map(quote).join(", ")}];`);
  }
  lines.push("");
  lines.push(`export function Example() {`);
  lines.push(`  return (`);
  lines.push(`    <LineChart`);
  lines.push(`      data={data}`);
  lines.push(`      labels={labels}`);
  lines.push(`      height={240}`);

  const curve = CURVES[s.curveIdx].value;
  if (curve !== "linear") lines.push(`      curve=${quote(curve)}`);
  if (s.lineWidth !== 1.75) lines.push(`      lineWidth={${s.lineWidth}}`);
  const markers = MARKERS[s.markersIdx].value;
  if (markers !== "auto") lines.push(`      markers=${quote(markers)}`);
  if (!s.gridlines) lines.push(`      gridlines={false}`);
  if (s.lastValueDot) lines.push(`      lastValueDot`);

  const yScale = Y_SCALES[s.yScaleIdx].value;
  if (yScale !== "linear") lines.push(`      yScale=${quote(yScale)}`);
  if (s.yBaselineZero) lines.push(`      yBaselineZero`);
  if (s.yAxisTitle || s.yAxisHideTicks || s.yAxisMinEnabled || s.yAxisMaxEnabled) {
    const parts: string[] = [];
    if (s.yAxisTitle) parts.push(`title: ${quote(s.yAxisTitle)}`);
    if (s.yAxisMinEnabled) parts.push(`min: ${s.yAxisMin}`);
    if (s.yAxisMaxEnabled) parts.push(`max: ${s.yAxisMax}`);
    if (s.yAxisHideTicks) parts.push(`hideTicks: true`);
    lines.push(`      yAxis={{ ${parts.join(", ")} }}`);
  }

  const legend = LEGENDS[s.legendIdx].value;
  if (legend !== "direct") lines.push(`      legend=${quote(legend)}`);
  // directLabels defaults to (legend === "direct"); only emit when it diverges.
  const defaultDirect = legend === "direct";
  if (s.directLabels !== defaultDirect) {
    lines.push(`      directLabels={${s.directLabels}}`);
  }
  if (s.directLabelValues) lines.push(`      directLabelValues`);

  if (emphasisName !== undefined && s.series.length > 1) {
    lines.push(`      emphasisSeries=${quote(emphasisName)}`);
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
    if (notationVal !== "standard") parts.push(`notation: ${quote(notationVal)}`);
    if (styleVal !== "decimal") parts.push(`style: ${quote(styleVal)}`);
    if (styleVal === "currency")
      parts.push(`currency: ${quote(s.numberCurrency || "USD")}`);
    lines.push(`      numberFormat={{ ${parts.join(", ")} }}`);
  }

  if (s.trendShow) lines.push(`      trend={${s.trendValue}}`);

  if (s.refShow) {
    const refValueCode =
      s.refStatIdx === 1
        ? `{ stat: "mean" }`
        : s.refStatIdx === 2
          ? `{ stat: "median" }`
          : `${s.refValue}`;
    const refLabelCode =
      s.refStatIdx === 0 && s.refLabel ? `, label: ${quote(s.refLabel)}` : "";
    lines.push(`      referenceLine={{ value: ${refValueCode}${refLabelCode} }}`);
  }

  if (s.eventEnabled) {
    const fields = [`x: ${quote(s.eventX)}`];
    if (s.eventLabel) fields.push(`label: ${quote(s.eventLabel)}`);
    lines.push(`      events={[{ ${fields.join(", ")} }]}`);
  }
  if (s.bandEnabled) {
    const fields = [`from: ${quote(s.bandFrom)}`, `to: ${quote(s.bandTo)}`];
    if (s.bandLabel) fields.push(`label: ${quote(s.bandLabel)}`);
    lines.push(`      bands={[{ ${fields.join(", ")} }]}`);
  }

  if (s.sourceShow && s.sourceText) {
    lines.push(`      source=${quote(s.sourceText)}`);
  }

  if (!s.animationEnabled || s.animationDuration !== 600) {
    const parts: string[] = [];
    if (!s.animationEnabled) parts.push(`enabled: false`);
    if (s.animationDuration !== 600) parts.push(`duration: ${s.animationDuration}`);
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
    lines.push(`      error=${quote(s.errorMessage || "Something went wrong")}`);
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

  if (s.captionText) lines.push(`      caption=${quote(s.captionText)}`);
  if (s.watermarkText) lines.push(`      watermark=${quote(s.watermarkText)}`);

  if (s.dataDescription) {
    lines.push(`      dataDescription=${quote(s.dataDescription)}`);
  }
  if (s.testId) lines.push(`      data-testid=${quote(s.testId)}`);

  if (s.eventsEnabled) {
    lines.push(`      onPointClick={(selection) => {`);
    lines.push(`        console.log("clicked", selection.series.name, selection.point);`);
    lines.push(`      }}`);
    lines.push(`      onPointHover={(selection) => {`);
    lines.push(`        // selection is null on mouse leave`);
    lines.push(`        setHover(selection);`);
    lines.push(`      }}`);
    lines.push(`      onPointFocus={(selection) => {`);
    lines.push(`        // Fires on keyboard navigation`);
    lines.push(`        announce(\`\${selection.series.name}: \${selection.point.y}\`);`);
    lines.push(`      }}`);
  }

  const anyExport = s.exportPNG || s.exportSVG || s.exportCSV || s.exportCopy;
  const allExport = s.exportPNG && s.exportSVG && s.exportCSV && s.exportCopy;
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

export function LineChartStudio() {
  const t = useTranslations("studio");
  const locale: StudioLocale = useLocale() === "ru" ? "ru" : "en";

  // Seeded demo TEXT is locale-aware: on /ru the whole preview, including the
  // editable seed values and the generated code, reads Russian. Only
  // filenames/slugs stay latin.
  const seed =
    locale === "ru"
      ? {
          headerTitle: "Выручка и расходы",
          headerSubtitle: "Последние 6 месяцев",
          errorMessage: "Не удалось загрузить ряд — таймаут API.",
          loadingLabel: "Загрузка…",
          errorLabel: "Ошибка",
          retryLabel: "Повторить",
          refLabel: "Цель",
          eventLabel: "Запуск",
          bandLabel: "Кампания",
        }
      : {};

  const [s, setS] = useState<StudioState>(() => ({
    ...INITIAL_STATE,
    ...seed,
    labels: [...PRESETS.twoMetrics.labels],
    series: seriesFromPreset(PRESETS.twoMetrics, locale),
  }));
  const chartRef = useRef<LineChartHandle>(null);

  // Chart-preview theme — auto (follow the site), or pinned light/dark.
  const {
    previewTheme,
    mode: previewMode,
    setMode: setPreviewMode,
  } = useStudioPreviewTheme();

  function update<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function setPreset(preset: PresetKey) {
    const p = PRESETS[preset];
    // Re-map the demo event / band onto the NEW dataset's labels — otherwise
    // they keep stale category names (e.g. month "MAR" on a quarters preset),
    // resolve to phantom off-range positions, and the event label floats
    // disconnected from any marker.
    const n = p.labels.length;
    const mid = Math.floor(n / 2);
    setS((prev) => ({
      ...prev,
      preset,
      labels: [...p.labels],
      series: seriesFromPreset(p, locale),
      emphasisIdx: p.series.findIndex((ser) => ser.emphasis),
      eventX: p.labels[mid] ?? p.labels[0],
      bandFrom: p.labels[Math.max(0, mid - 1)] ?? p.labels[0],
      bandTo: p.labels[Math.min(n - 1, mid + 1)] ?? p.labels[n - 1],
    }));
  }

  function updateSeries(i: number, patch: Partial<StudioSeries>) {
    setS((prev) => ({
      ...prev,
      series: prev.series.map((ser, j) =>
        j === i ? { ...ser, ...patch } : ser,
      ),
    }));
  }

  function updateSeriesValue(seriesIdx: number, pointIdx: number, value: number) {
    setS((prev) => ({
      ...prev,
      series: prev.series.map((ser, j) =>
        j === seriesIdx
          ? {
              ...ser,
              values: ser.values.map((v, k) => (k === pointIdx ? value : v)),
            }
          : ser,
      ),
    }));
  }

  function addSeries() {
    setS((prev) => {
      if (prev.series.length >= MAX_SERIES) return prev;
      const len = prev.labels.length;
      const palette = ["#71717A", "#a1a1aa", "#d4d4d8"];
      const next: StudioSeries = {
        name: `Series ${prev.series.length + 1}`,
        color: palette[(prev.series.length - 1) % palette.length] ?? "#71717A",
        dashed: false,
        emphasis: false,
        values: Array.from({ length: len }, () => 100),
      };
      return { ...prev, series: [...prev.series, next] };
    });
  }

  function removeSeries(i: number) {
    setS((prev) => {
      if (prev.series.length <= 1) return prev;
      const series = prev.series.filter((_, j) => j !== i);
      // Keep emphasis pointing at a valid index (or none).
      let emphasisIdx = prev.emphasisIdx;
      if (emphasisIdx === i) emphasisIdx = -1;
      else if (emphasisIdx > i) emphasisIdx -= 1;
      return { ...prev, series, emphasisIdx };
    });
  }

  function pickColor(seriesIdx: number, hex: string) {
    updateSeries(seriesIdx, { color: hex });
  }

  // ─── Derived data shared by the live chart AND generateLineChartCode. ───
  const liveSeries = buildSeries(s);
  const singleSeries = s.series.length === 1;
  // Single-series form passes a plain number[]; multi passes LineChartSeries[].
  const chartData = singleSeries ? s.series[0].values : liveSeries;
  const code = generateLineChartCode(s);

  const effectiveData = s.stateMode === "loading" ? [] : chartData;
  const effectiveLoading =
    s.stateMode === "loading" || s.stateMode === "loading-overlay";
  const effectiveError =
    s.stateMode === "error" ? s.errorMessage || "Unknown error" : undefined;

  const numberFormat = (() => {
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
      currency: style === "currency" ? s.numberCurrency || "USD" : undefined,
    };
  })();

  const emphasisName = emphasisNameOf(s);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_260px] lg:gap-0">
      {/* ── Code panel (left) ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card lg:rounded-r-none lg:border-r-0">
        <PanelHeader label={t("panels.code")}>
          <CopyButton text={code} />
        </PanelHeader>
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
          <code>{code}</code>
        </pre>
      </div>

      {/* ── Chart panel (center) ──────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card lg:rounded-none">
        <PanelHeader label={t("panels.chart")}>
          <StudioThemeToggle mode={previewMode} onChange={setPreviewMode} />
        </PanelHeader>
        <div className={`${previewTheme} bg-background p-6`}>
          <LineChart
            ref={chartRef}
            data={effectiveData}
            labels={s.labels}
            height={260}
            curve={CURVES[s.curveIdx].value}
            lineWidth={s.lineWidth}
            markers={MARKERS[s.markersIdx].value}
            gridlines={s.gridlines}
            lastValueDot={s.lastValueDot}
            yScale={Y_SCALES[s.yScaleIdx].value}
            yBaselineZero={s.yBaselineZero}
            legend={LEGENDS[s.legendIdx].value}
            directLabels={s.directLabels}
            directLabelValues={s.directLabelValues}
            emphasisSeries={
              !singleSeries && emphasisName !== undefined
                ? emphasisName
                : undefined
            }
            yAxis={
              s.yAxisTitle ||
              s.yAxisHideTicks ||
              s.yAxisMinEnabled ||
              s.yAxisMaxEnabled
                ? {
                    title: s.yAxisTitle || undefined,
                    hideTicks: s.yAxisHideTicks,
                    min: s.yAxisMinEnabled ? s.yAxisMin : undefined,
                    max: s.yAxisMaxEnabled ? s.yAxisMax : undefined,
                  }
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
            header={
              s.headerTitle || s.headerSubtitle
                ? { title: s.headerTitle, subtitle: s.headerSubtitle }
                : undefined
            }
            numberFormat={numberFormat}
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
            events={
              s.eventEnabled
                ? [{ x: s.eventX, label: s.eventLabel || undefined }]
                : undefined
            }
            bands={
              s.bandEnabled
                ? [
                    {
                      from: s.bandFrom,
                      to: s.bandTo,
                      label: s.bandLabel || undefined,
                    },
                  ]
                : undefined
            }
            source={s.sourceShow ? s.sourceText : undefined}
            caption={s.captionText || undefined}
            watermark={s.watermarkText || undefined}
            dataDescription={s.dataDescription || undefined}
            data-testid={s.testId || undefined}
            loading={effectiveLoading}
            error={effectiveError}
            onRetry={
              s.stateMode === "error" && s.withRetry
                ? () => setS((prev) => ({ ...prev, stateMode: "ready" }))
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
            animation={{
              enabled: s.animationEnabled,
              duration: s.animationDuration,
            }}
            onPointClick={
              s.eventsEnabled
                ? (selection) =>
                    setS((prev) => ({
                      ...prev,
                      lastClickKey: `${selection.series.name} · ${selection.point.x}`,
                      lastClickValue:
                        typeof selection.point.y === "number"
                          ? selection.point.y
                          : null,
                    }))
                : undefined
            }
            onPointHover={
              s.eventsEnabled
                ? (selection) =>
                    setS((prev) => ({
                      ...prev,
                      hoverKey: selection
                        ? `${selection.series.name} · ${selection.point.x}`
                        : null,
                    }))
                : undefined
            }
            onPointFocus={
              s.eventsEnabled
                ? (selection) =>
                    setS((prev) => ({
                      ...prev,
                      focusKey: `${selection.series.name} · ${selection.point.x}`,
                    }))
                : undefined
            }
          />
        </div>
        {s.showJSON && (
          <div className="border-t border-border">
            <PanelHeader label={t("panels.json")}>
              <CopyButton text={jsonOf(s, liveSeries)} />
            </PanelHeader>
            <pre className="max-h-72 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
              <code>{jsonOf(s, liveSeries)}</code>
            </pre>
          </div>
        )}
      </div>

      {/* ── Settings panel (right) ────────────────────────────────── */}
      <aside className="rounded-lg border border-border bg-card lg:rounded-l-none lg:border-l-0">
        <PanelHeader label={t("panels.settings")} />
        <div className="divide-y divide-border">
          <Accordion label={t("sections.data")} defaultOpen>
            <Field label={t("fields.preset")} hint={t("tips.preset")}>
              <Segmented
                options={(Object.keys(PRESETS) as PresetKey[]).map(
                  (k) => PRESETS[k].label[locale],
                )}
                selectedIndex={(Object.keys(PRESETS) as PresetKey[]).indexOf(
                  s.preset,
                )}
                onSelect={(i) =>
                  setPreset((Object.keys(PRESETS) as PresetKey[])[i])
                }
              />
            </Field>
            <div className="space-y-3">
              {s.series.map((ser, si) => (
                <div
                  key={si}
                  className="space-y-1.5 rounded-lg border border-border p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <TextInput
                        value={ser.name}
                        onChange={(v) => updateSeries(si, { name: v })}
                        placeholder={t("placeholders.seriesName")}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSeries(si)}
                      disabled={s.series.length <= 1}
                      aria-label={t("aria.removeSeries")}
                      title={t("aria.removeSeries")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <ColorCustomInput
                      value={ser.color}
                      onChange={(hex) => pickColor(si, hex)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Toggle
                      label={t("toggles.dashedSeries")}
                      hint={t("tips.dashedSeries")}
                      checked={ser.dashed}
                      onChange={(v) => updateSeries(si, { dashed: v })}
                    />
                    <button
                      type="button"
                      onClick={() => update("emphasisIdx", si)}
                      aria-pressed={s.emphasisIdx === si}
                      className={`shrink-0 cursor-pointer rounded-md border px-2 py-1 font-sans text-[11px] transition-colors ${
                        s.emphasisIdx === si
                          ? "border-brock-accent/60 bg-brock-accent/10 text-brock-accent"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {t("toggles.emphasizeSeries")}
                    </button>
                  </div>
                  <Field label={t("fields.values")} hint={t("tips.values")}>
                    <div className="grid grid-cols-4 gap-1">
                      {ser.values.map((v, pi) => (
                        <input
                          key={pi}
                          type="number"
                          value={v ?? ""}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isNaN(next)) {
                              updateSeriesValue(si, pi, next);
                            }
                          }}
                          className="w-full rounded-md border border-border bg-background px-1 py-1 font-mono text-[10px] tabular-nums text-foreground outline-none transition-colors focus-visible:border-brock-accent/40 focus-visible:ring-2 focus-visible:ring-brock-accent/40"
                        />
                      ))}
                    </div>
                  </Field>
                </div>
              ))}
              {s.series.length < MAX_SERIES && (
                <button
                  type="button"
                  onClick={addSeries}
                  className="w-full rounded-md border border-dashed border-border py-1.5 font-sans text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t("buttons.addSeries")}
                </button>
              )}
              <div className="font-sans text-[11px] text-muted-foreground/60">
                {t("hints.sharedXLabels")}
              </div>
            </div>
          </Accordion>

          <Accordion label={t("sections.lines")}>
            <Field label={t("fields.curve")} hint={t("tips.curve")}>
              <Segmented
                options={[t("options.curve.linear"), t("options.curve.monotone")]}
                selectedIndex={s.curveIdx}
                onSelect={(i) => update("curveIdx", i)}
              />
            </Field>
            <Field label={t("fields.lineWidth")} hint={t("tips.lineWidth")}>
              <NumberInput
                value={s.lineWidth}
                step={0.25}
                onChange={(v) => update("lineWidth", Math.max(0.5, v))}
              />
            </Field>
            <Field label={t("fields.markers")} hint={t("tips.markers")}>
              <Segmented
                options={[
                  t("options.markers.auto"),
                  t("options.markers.always"),
                  t("options.markers.none"),
                ]}
                selectedIndex={s.markersIdx}
                onSelect={(i) => update("markersIdx", i)}
              />
            </Field>
            <Toggle
              label={t("toggles.gridlines")}
              hint={t("tips.gridlines")}
              checked={s.gridlines}
              onChange={(v) => update("gridlines", v)}
            />
            <Toggle
              label={t("toggles.lastValueDot")}
              hint={t("tips.lastValueDot")}
              checked={s.lastValueDot}
              onChange={(v) => update("lastValueDot", v)}
            />
          </Accordion>

          <Accordion label={t("sections.scale")}>
            <Field label={t("fields.yScale")} hint={t("tips.yScale")}>
              <Segmented
                options={[t("options.yScale.linear"), t("options.yScale.log")]}
                selectedIndex={s.yScaleIdx}
                onSelect={(i) => update("yScaleIdx", i)}
              />
            </Field>
            <Toggle
              label={t("toggles.yBaselineZero")}
              hint={t("tips.yBaselineZero")}
              checked={s.yBaselineZero}
              onChange={(v) => update("yBaselineZero", v)}
            />
            <Toggle
              label={t("toggles.customMin")}
              hint={t("tips.customMin")}
              checked={s.yAxisMinEnabled}
              onChange={(v) => update("yAxisMinEnabled", v)}
            />
            {s.yAxisMinEnabled && (
              <Field label={t("fields.minValue")} hint={t("tips.minValue")}>
                <NumberInput
                  value={s.yAxisMin}
                  onChange={(v) => update("yAxisMin", v)}
                />
              </Field>
            )}
            <Toggle
              label={t("toggles.customMax")}
              hint={t("tips.customMax")}
              checked={s.yAxisMaxEnabled}
              onChange={(v) => update("yAxisMaxEnabled", v)}
            />
            {s.yAxisMaxEnabled && (
              <Field label={t("fields.maxValue")} hint={t("tips.maxValue")}>
                <NumberInput
                  value={s.yAxisMax}
                  onChange={(v) => update("yAxisMax", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.labelsLegend")}>
            <Field label={t("fields.legend")} hint={t("tips.legend")}>
              <Segmented
                options={[
                  t("options.legend.none"),
                  t("options.legend.direct"),
                  t("options.legend.top"),
                ]}
                selectedIndex={s.legendIdx}
                onSelect={(i) => update("legendIdx", i)}
              />
            </Field>
            <Toggle
              label={t("toggles.directLabels")}
              hint={t("tips.directLabels")}
              checked={s.directLabels}
              onChange={(v) => update("directLabels", v)}
            />
            <Toggle
              label={t("toggles.directLabelValues")}
              hint={t("tips.directLabelValues")}
              checked={s.directLabelValues}
              onChange={(v) => update("directLabelValues", v)}
            />
          </Accordion>

          <Accordion label={t("sections.emphasis")}>
            <Field label={t("fields.emphasisSeries")} hint={t("tips.emphasisSeries")}>
              <Select
                options={[
                  t("options.emphasis.none"),
                  ...s.series.map((ser) => ser.name),
                ]}
                selectedIndex={s.emphasisIdx + 1}
                onSelect={(i) => update("emphasisIdx", i - 1)}
              />
            </Field>
            <div className="font-mono text-[10px] text-muted-foreground/60">
              {t("hints.emphasisLine")}
            </div>
          </Accordion>

          <Accordion label={t("sections.referenceLine")}>
            <Toggle
              label={t("toggles.showReferenceLine")}
              hint={t("tips.showReferenceLine")}
              checked={s.refShow}
              onChange={(v) => update("refShow", v)}
            />
            {s.refShow && (
              <>
                <Field label={t("fields.mode")} hint={t("tips.referenceMode")}>
                  <Segmented
                    options={[
                      t("options.refMode.value"),
                      t("options.refMode.mean"),
                      t("options.refMode.median"),
                    ]}
                    selectedIndex={s.refStatIdx}
                    onSelect={(i) => update("refStatIdx", i)}
                  />
                </Field>
                {s.refStatIdx === 0 && (
                  <>
                    <Field label={t("fields.value")} hint={t("tips.referenceValue")}>
                      <NumberInput
                        value={s.refValue}
                        onChange={(v) => update("refValue", v)}
                      />
                    </Field>
                    <Field label={t("fields.label")} hint={t("tips.referenceLabel")}>
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

          <Accordion label={t("sections.eventsBands")}>
            <Toggle
              label={t("toggles.showEvent")}
              hint={t("tips.showEvent")}
              checked={s.eventEnabled}
              onChange={(v) => update("eventEnabled", v)}
            />
            {s.eventEnabled && (
              <>
                <Field label={t("fields.eventX")} hint={t("tips.eventX")}>
                  <Select
                    options={s.labels}
                    selectedIndex={Math.max(0, s.labels.indexOf(s.eventX))}
                    onSelect={(i) => update("eventX", s.labels[i])}
                  />
                </Field>
                <Field label={t("fields.eventLabel")} hint={t("tips.eventLabel")}>
                  <TextInput
                    value={s.eventLabel}
                    onChange={(v) => update("eventLabel", v)}
                    placeholder={t("placeholders.eventLabel")}
                  />
                </Field>
              </>
            )}
            <Toggle
              label={t("toggles.showBand")}
              hint={t("tips.showPlotBand")}
              checked={s.bandEnabled}
              onChange={(v) => update("bandEnabled", v)}
            />
            {s.bandEnabled && (
              <>
                <Field label={t("fields.bandFrom")} hint={t("tips.fromIndex")}>
                  <Select
                    options={s.labels}
                    selectedIndex={Math.max(0, s.labels.indexOf(s.bandFrom))}
                    onSelect={(i) => update("bandFrom", s.labels[i])}
                  />
                </Field>
                <Field label={t("fields.bandTo")} hint={t("tips.toIndex")}>
                  <Select
                    options={s.labels}
                    selectedIndex={Math.max(0, s.labels.indexOf(s.bandTo))}
                    onSelect={(i) => update("bandTo", s.labels[i])}
                  />
                </Field>
                <Field label={t("fields.label")} hint={t("tips.bandLabel")}>
                  <TextInput
                    value={s.bandLabel}
                    onChange={(v) => update("bandLabel", v)}
                    placeholder={t("placeholders.bandLabel")}
                  />
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.header")}>
            <Field label={t("fields.title")} hint={t("tips.headerTitle")}>
              <TextInput
                value={s.headerTitle}
                onChange={(v) => update("headerTitle", v)}
                placeholder={t("placeholders.headerTitleLine")}
              />
            </Field>
            <Field label={t("fields.subtitle")} hint={t("tips.subtitle")}>
              <TextInput
                value={s.headerSubtitle}
                onChange={(v) => update("headerSubtitle", v)}
                placeholder={t("placeholders.headerSubtitleLine")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.xAxis")}>
            <Field label={t("fields.title")} hint={t("tips.xAxisTitle")}>
              <TextInput
                value={s.xAxisTitle}
                onChange={(v) => update("xAxisTitle", v)}
                placeholder={t("placeholders.xAxisTitleLine")}
              />
            </Field>
            <Toggle
              label={t("toggles.hideTickLabels")}
              hint={t("tips.hideXTicks")}
              checked={s.xAxisHideTicks}
              onChange={(v) => update("xAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label={t("sections.yAxis")}>
            <Field label={t("fields.title")} hint={t("tips.yAxisTitle")}>
              <TextInput
                value={s.yAxisTitle}
                onChange={(v) => update("yAxisTitle", v)}
                placeholder={t("placeholders.yAxisTitleLine")}
              />
            </Field>
            <Toggle
              label={t("toggles.hideTickLabels")}
              hint={t("tips.hideYTicks")}
              checked={s.yAxisHideTicks}
              onChange={(v) => update("yAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label={t("sections.numberFormat")}>
            <Field label={t("fields.prefix")} hint={t("tips.prefix")}>
              <TextInput
                value={s.numberPrefix}
                onChange={(v) => update("numberPrefix", v)}
                placeholder={t("placeholders.prefix")}
              />
            </Field>
            <Field label={t("fields.suffix")} hint={t("tips.suffix")}>
              <TextInput
                value={s.numberSuffix}
                onChange={(v) => update("numberSuffix", v)}
                placeholder={t("placeholders.suffix")}
              />
            </Field>
            <Field label={t("fields.decimals")} hint={t("tips.decimals")}>
              <NumberInput
                value={s.numberDecimals}
                onChange={(v) => update("numberDecimals", Math.max(0, v))}
              />
            </Field>
            <Field label={t("fields.notation")} hint={t("tips.notation")}>
              <Segmented
                options={[
                  t("options.notation.std"),
                  t("options.notation.compact"),
                  t("options.notation.sci"),
                ]}
                selectedIndex={s.numberNotationIdx}
                onSelect={(i) => update("numberNotationIdx", i)}
              />
            </Field>
            <Field label={t("fields.style")} hint={t("tips.numberStyle")}>
              <Segmented
                options={[
                  t("options.numberStyle.decimal"),
                  t("options.numberStyle.currency"),
                  t("options.numberStyle.percent"),
                ]}
                selectedIndex={s.numberStyleIdx}
                onSelect={(i) => update("numberStyleIdx", i)}
              />
            </Field>
            {NUMBER_STYLES[s.numberStyleIdx].value === "currency" && (
              <Field label={t("fields.currency")} hint={t("tips.currency")}>
                <TextInput
                  value={s.numberCurrency}
                  onChange={(v) => update("numberCurrency", v.toUpperCase())}
                  placeholder={t("placeholders.currency")}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.trend")}>
            <Toggle
              label={t("toggles.showTrend")}
              hint={t("tips.showTrend")}
              checked={s.trendShow}
              onChange={(v) => update("trendShow", v)}
            />
            {s.trendShow && (
              <Field label={t("fields.trendValue")} hint={t("tips.trendValue")}>
                <NumberInput
                  value={s.trendValue}
                  step={0.01}
                  onChange={(v) => update("trendValue", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.states")}>
            <Field label={t("fields.mode")} hint={t("tips.statesMode")}>
              <Segmented
                options={[
                  t("options.state.ready"),
                  t("options.state.loading"),
                  t("options.state.refresh"),
                  t("options.state.error"),
                ]}
                selectedIndex={
                  { ready: 0, loading: 1, "loading-overlay": 2, error: 3 }[
                    s.stateMode
                  ]
                }
                onSelect={(i) =>
                  update(
                    "stateMode",
                    (
                      ["ready", "loading", "loading-overlay", "error"] as const
                    )[i],
                  )
                }
              />
            </Field>
            {(s.stateMode === "loading" ||
              s.stateMode === "loading-overlay") && (
              <Field label={t("fields.loadingLabel")} hint={t("tips.loadingLabel")}>
                <TextInput
                  value={s.loadingLabel}
                  onChange={(v) => update("loadingLabel", v)}
                  placeholder={t("placeholders.loading")}
                />
              </Field>
            )}
            {s.stateMode === "error" && (
              <>
                <Field label={t("fields.errorMessage")} hint={t("tips.errorMessage")}>
                  <TextInput
                    value={s.errorMessage}
                    onChange={(v) => update("errorMessage", v)}
                    placeholder={t("placeholders.errorMessage")}
                  />
                </Field>
                <Field label={t("fields.errorLabel")} hint={t("tips.errorLabel")}>
                  <TextInput
                    value={s.errorLabel}
                    onChange={(v) => update("errorLabel", v)}
                    placeholder={t("placeholders.errorLabel")}
                  />
                </Field>
                <Toggle
                  label={t("toggles.showRetry")}
                  hint={t("tips.showRetry")}
                  checked={s.withRetry}
                  onChange={(v) => update("withRetry", v)}
                />
                {s.withRetry && (
                  <Field label={t("fields.retryLabel")} hint={t("tips.retryLabel")}>
                    <TextInput
                      value={s.retryLabel}
                      onChange={(v) => update("retryLabel", v)}
                      placeholder={t("placeholders.retryLabel")}
                    />
                  </Field>
                )}
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.export")}>
            <Field label={t("fields.formats")} hint={t("tips.formats")}>
              <div className="space-y-1.5">
                <Toggle
                  label={t("toggles.pngButton")}
                  hint={t("tips.pngButton")}
                  checked={s.exportPNG}
                  onChange={(v) => update("exportPNG", v)}
                />
                <Toggle
                  label={t("toggles.svgButton")}
                  hint={t("tips.svgButton")}
                  checked={s.exportSVG}
                  onChange={(v) => update("exportSVG", v)}
                />
                <Toggle
                  label={t("toggles.csvButton")}
                  hint={t("tips.csvButton")}
                  checked={s.exportCSV}
                  onChange={(v) => update("exportCSV", v)}
                />
                <Toggle
                  label={t("toggles.copyImageButton")}
                  hint={t("tips.copyImageButton")}
                  checked={s.exportCopy}
                  onChange={(v) => update("exportCopy", v)}
                />
              </div>
            </Field>
            <Field label={t("fields.fileName")} hint={t("tips.fileName")}>
              <TextInput
                value={s.exportFileName}
                onChange={(v) => update("exportFileName", v)}
                placeholder={t("placeholders.fileNameLine")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.events")}>
            <Toggle
              label={t("toggles.trackEvents")}
              hint={t("tips.trackEvents")}
              checked={s.eventsEnabled}
              onChange={(v) => update("eventsEnabled", v)}
            />
            {s.eventsEnabled && (
              <>
                <Field label={t("fields.lastClick")} hint={t("tips.lastClick")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.lastClickKey !== null
                      ? `${s.lastClickKey} · ${s.lastClickValue ?? "—"}`
                      : t("hints.noClicksYet")}
                  </div>
                </Field>
                <Field label={t("fields.hovering")} hint={t("tips.hovering")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.hoverKey !== null ? s.hoverKey : t("hints.mouseOutside")}
                  </div>
                </Field>
                <Field label={t("fields.focused")} hint={t("tips.focused")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.focusKey !== null ? s.focusKey : t("hints.noFocusYet")}
                  </div>
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.editorial")}>
            <Field label={t("fields.caption")} hint={t("tips.caption")}>
              <TextInput
                value={s.captionText}
                onChange={(v) => update("captionText", v)}
                placeholder={t("placeholders.captionLine")}
              />
            </Field>
            <Field label={t("fields.watermark")} hint={t("tips.watermark")}>
              <TextInput
                value={s.watermarkText}
                onChange={(v) => update("watermarkText", v)}
                placeholder={t("placeholders.watermark")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.source")}>
            <Toggle
              label={t("toggles.showSourceLine")}
              hint={t("tips.showSourceLine")}
              checked={s.sourceShow}
              onChange={(v) => update("sourceShow", v)}
            />
            {s.sourceShow && (
              <Field label={t("fields.text")} hint={t("tips.sourceText")}>
                <TextInput
                  value={s.sourceText}
                  onChange={(v) => update("sourceText", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.animation")}>
            <Toggle
              label={t("toggles.enableAnimation")}
              hint={t("tips.enableAnimation")}
              checked={s.animationEnabled}
              onChange={(v) => update("animationEnabled", v)}
            />
            {s.animationEnabled && (
              <Field label={t("fields.duration")} hint={t("tips.duration")}>
                <NumberInput
                  value={s.animationDuration}
                  step={50}
                  onChange={(v) => update("animationDuration", Math.max(0, v))}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.forwardCompat")}>
            <Field label={t("fields.dataDescription")} hint={t("tips.dataDescription")}>
              <TextInput
                value={s.dataDescription}
                onChange={(v) => update("dataDescription", v)}
                placeholder={t("placeholders.dataDescriptionLine")}
              />
            </Field>
            <Field label={t("fields.testId")} hint={t("tips.testId")}>
              <TextInput
                value={s.testId}
                onChange={(v) => update("testId", v)}
                placeholder={t("placeholders.testIdLine")}
              />
            </Field>
            <Toggle
              label={t("toggles.showJSON")}
              hint={t("tips.showJSON")}
              checked={s.showJSON}
              onChange={(v) => update("showJSON", v)}
            />
            {s.showJSON && (
              <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                {t.rich("hints.showJSON", {
                  code: (chunks) => <code>{chunks}</code>,
                })}
              </div>
            )}
          </Accordion>
        </div>
      </aside>
    </div>
  );
}

/** Build the toJSON() preview string from the current state + derived series. */
function jsonOf(s: StudioState, liveSeries: LineChartSeries[]): string {
  const singleSeries = s.series.length === 1;
  return JSON.stringify(
    toJSON({
      data: singleSeries ? s.series[0].values : liveSeries,
      labels: s.labels,
      height: 260,
      curve: CURVES[s.curveIdx].value,
      lineWidth: s.lineWidth,
      markers: MARKERS[s.markersIdx].value,
      gridlines: s.gridlines,
      lastValueDot: s.lastValueDot,
      yScale: Y_SCALES[s.yScaleIdx].value,
      yBaselineZero: s.yBaselineZero,
      legend: LEGENDS[s.legendIdx].value,
      directLabels: s.directLabels,
      directLabelValues: s.directLabelValues,
      emphasisSeries:
        !singleSeries && emphasisNameOf(s) !== undefined
          ? emphasisNameOf(s)
          : undefined,
      header:
        s.headerTitle || s.headerSubtitle
          ? { title: s.headerTitle, subtitle: s.headerSubtitle }
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
            label: s.refStatIdx === 0 && s.refLabel ? s.refLabel : undefined,
          }
        : undefined,
      source: s.sourceShow ? s.sourceText : undefined,
      caption: s.captionText || undefined,
      watermark: s.watermarkText || undefined,
      dataDescription: s.dataDescription || undefined,
      chartType: "line",
    }),
    null,
    2,
  );
}

