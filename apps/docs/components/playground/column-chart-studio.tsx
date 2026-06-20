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
import { ChevronFirst, ChevronLast, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  ColumnChart,
  type ColumnChartDataPoint,
  type ColumnChartHandle,
} from "@/components/charts/column-chart";
import { toJSON } from "@/components/charts/column-chart-export";
import { CopyButton } from "@/components/ui/copy-button";
import {
  StudioThemeToggle,
  useStudioPreviewTheme,
} from "./studio-theme";
import {
  Accordion,
  ColorCustomInput,
  ColorPalette,
  DEFAULT_ACCENT,
  Field,
  NumberInput,
  PanelHeader,
  Segmented,
  Select,
  Swatch,
  TextInput,
  Toggle,
  isInPalette,
} from "./studio-ui";

/* ─── Presets ────────────────────────────────────────────────────────── */

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

/**
 * Demo data is locale-aware: on /ru the weekday labels and reference-line
 * names render in Russian — Cyrillic in the bars is a feature demo, not an
 * accident. Numeric series and goals are shared; only display strings fork.
 * The numeric day labels (01, 02, …) are locale-neutral by design.
 */
type StudioLocale = "en" | "ru";

type Dataset = {
  label: string;
  data: number[];
  labels: string[];
  suggestedGoal: number;
  suggestedGoalLabel: string;
};

const DAY_LABELS_14 = dayLabels(14);
const DAY_LABELS_20 = dayLabels(20);
const DAY_LABELS_30 = dayLabels(30);
const DAY_LABELS_40 = dayLabels(40);
const DAY_LABELS_90 = dayLabels(90);

const DATASETS: Record<
  DatasetKey,
  {
    label: Record<StudioLocale, string>;
    data: number[];
    labels: Record<StudioLocale, string[]>;
    suggestedGoal: number;
    suggestedGoalLabel: Record<StudioLocale, string>;
  }
> = {
  weekly: {
    label: { en: "7d", ru: "7д" },
    data: [142, 168, 187, 159, 203, 178, 215],
    labels: {
      en: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      ru: ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"],
    },
    suggestedGoal: 190,
    suggestedGoalLabel: { en: "Weekly target", ru: "Цель недели" },
  },
  daily: {
    label: { en: "14d", ru: "14д" },
    data: [42, 68, 51, 89, 73, 105, 96, 82, 119, 87, 64, 93, 110, 78],
    labels: { en: DAY_LABELS_14, ru: DAY_LABELS_14 },
    suggestedGoal: 100,
    suggestedGoalLabel: { en: "Daily target", ru: "Цель дня" },
  },
  twoWeeks: {
    label: { en: "20d", ru: "20д" },
    data: generateSeries(20, 80, 30),
    labels: { en: DAY_LABELS_20, ru: DAY_LABELS_20 },
    suggestedGoal: 100,
    suggestedGoalLabel: { en: "Target", ru: "Цель" },
  },
  month: {
    label: { en: "30d", ru: "30д" },
    data: generateSeries(30, 90, 40),
    labels: { en: DAY_LABELS_30, ru: DAY_LABELS_30 },
    suggestedGoal: 120,
    suggestedGoalLabel: { en: "Monthly target", ru: "Цель месяца" },
  },
  fortyDays: {
    label: { en: "40d", ru: "40д" },
    data: generateSeries(40, 95, 45),
    labels: { en: DAY_LABELS_40, ru: DAY_LABELS_40 },
    suggestedGoal: 130,
    suggestedGoalLabel: { en: "Target", ru: "Цель" },
  },
  quarter: {
    label: { en: "90d", ru: "90д" },
    data: generateSeries(90, 100, 60),
    labels: { en: DAY_LABELS_90, ru: DAY_LABELS_90 },
    suggestedGoal: 150,
    suggestedGoalLabel: { en: "Quarter target", ru: "Цель квартала" },
  },
};

/** Resolve the per-locale view of every dataset (stable array identities). */
function datasetsFor(locale: StudioLocale): Record<DatasetKey, Dataset> {
  const out = {} as Record<DatasetKey, Dataset>;
  for (const key of Object.keys(DATASETS) as DatasetKey[]) {
    const d = DATASETS[key];
    out[key] = {
      label: d.label[locale],
      data: d.data,
      labels: d.labels[locale],
      suggestedGoal: d.suggestedGoal,
      suggestedGoalLabel: d.suggestedGoalLabel[locale],
    };
  }
  return out;
}

/* ─── State shape ────────────────────────────────────────────────────── */

type StudioState = {
  // data
  period: DatasetKey;
  /** Editable bar data — seeded from the preset, then user-editable. */
  rows: { label: string; value: number }[];
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
  rows: DATASETS.weekly.data.map((value, i) => ({
    label: DATASETS.weekly.labels.en[i] ?? "",
    value,
  })),
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
  refShow: false,
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

function generateCode(
  s: StudioState,
  datasets: Record<DatasetKey, Dataset>,
): string {
  const ds: Dataset = {
    ...datasets[s.period],
    data: s.rows.map((r) => r.value),
    labels: s.rows.map((r) => r.label),
  };
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
  const t = useTranslations("studio");
  const locale: StudioLocale = useLocale() === "ru" ? "ru" : "en";
  const datasets = datasetsFor(locale);
  // The reference-line label and the annotation's x-match must agree with the
  // active locale's data labels, so the initial state derives from them.
  // Seeded demo TEXT (header, error, annotation, band, labels) is locale-aware
  // too — on /ru the whole preview, including the editable seed values and the
  // generated code, reads Russian. Only filenames/slugs stay latin.
  const seed =
    locale === "ru"
      ? {
          headerTitle: "Активные пользователи",
          headerSubtitle: "Последние 7 дней",
          errorMessage: "Не удалось загрузить метрики — таймаут API.",
          loadingLabel: "Загрузка…",
          errorLabel: "Ошибка",
          retryLabel: "Повторить",
          annotationText: "← пик",
          bandLabel: "Спринт Q3",
        }
      : {};
  const [s, setS] = useState<StudioState>(() => {
    const w = datasetsFor(locale).weekly;
    return {
      ...INITIAL_STATE,
      ...seed,
      rows: w.data.map((value, i) => ({ label: w.labels[i] ?? "", value })),
      refLabel: w.suggestedGoalLabel,
      annotationLabel: locale === "ru" ? "ПТ" : "FRI",
    };
  });
  const chartRef = useRef<ColumnChartHandle>(null);

  // Chart-preview theme — auto (follow the site), or pinned light/dark.
  const {
    previewTheme,
    mode: previewMode,
    setMode: setPreviewMode,
  } = useStudioPreviewTheme();

  function update<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function setPeriod(period: DatasetKey) {
    const ds = datasets[period];
    // Keep the demo subtitle in step with the preset — otherwise a 90-day
    // chart still reads "Last 7 days". (7/14/20/30/40/90 all take "дней".)
    const days = ds.data.length;
    const subtitle =
      locale === "ru" ? `Последние ${days} дней` : `Last ${days} days`;
    setS((prev) => ({
      ...prev,
      period,
      headerSubtitle: subtitle,
      rows: ds.data.map((value, i) => ({ label: ds.labels[i] ?? "", value })),
    }));
  }

  function updateRow(
    i: number,
    patch: Partial<{ label: string; value: number }>,
  ) {
    setS((prev) => ({
      ...prev,
      rows: prev.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  }
  function addRow() {
    setS((prev) =>
      prev.rows.length >= 16
        ? prev
        : { ...prev, rows: [...prev.rows, { label: "", value: 0 }] },
    );
  }
  function removeRow(i: number) {
    setS((prev) =>
      prev.rows.length <= 1
        ? prev
        : { ...prev, rows: prev.rows.filter((_, j) => j !== i) },
    );
  }

  // Effective dataset: bar data comes from the editable rows; preset meta
  // (display name, suggested goal) still comes from the selected preset.
  const ds: Dataset = {
    ...datasets[s.period],
    data: s.rows.map((r) => r.value),
    labels: s.rows.map((r) => r.label),
  };
  const accent = s.accentValue;
  const radius = RADII[s.radiusIdx];
  const density = DENSITIES[s.densityIdx];
  const code = generateCode(s, datasets);

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
        <PanelHeader label={t("panels.code")}>
          <CopyButton text={code} />
        </PanelHeader>
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
          <code>{code}</code>
        </pre>
      </div>

      {/* ── Chart panel (center) ──────────────────────────────────── */}
      <div className="border border-border bg-card">
        <PanelHeader label={t("panels.chart")}>
          <StudioThemeToggle mode={previewMode} onChange={setPreviewMode} />
        </PanelHeader>
        {/* Scoped theme: the resolved class re-binds every semantic CSS token
            inside this subtree, so the preview (and exports — they resolve
            vars off the live figure) render in the chosen theme regardless of
            the site theme. */}
        <div className={`${previewTheme} bg-background p-6`}>
          <ColumnChart
            ref={chartRef}
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
            <PanelHeader label={t("panels.json")}>
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
        <PanelHeader label={t("panels.settings")} />
        <div className="divide-y divide-border">
          <Accordion label={t("sections.data")} defaultOpen>
            <Field label={t("fields.preset")} hint={t("tips.preset")}>
              <Segmented
                options={(Object.keys(DATASETS) as DatasetKey[]).map(
                  (k) => datasets[k].label,
                )}
                selectedIndex={(Object.keys(DATASETS) as DatasetKey[]).indexOf(
                  s.period,
                )}
                onSelect={(i) =>
                  setPeriod((Object.keys(DATASETS) as DatasetKey[])[i])
                }
              />
            </Field>
            <Field label={t("fields.bars")} hint={t("tips.bars")}>
              <div className="space-y-1.5">
                {s.rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <TextInput
                        value={row.label}
                        onChange={(v) => updateRow(i, { label: v })}
                        placeholder={t("placeholders.barLabel")}
                      />
                    </div>
                    <div className="w-20 shrink-0">
                      <NumberInput
                        value={row.value}
                        onChange={(v) => updateRow(i, { value: v })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={s.rows.length <= 1}
                      aria-label={t("aria.removeBar")}
                      title={t("aria.removeBar")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>
                  </div>
                ))}
                {s.rows.length < 16 && (
                  <button
                    type="button"
                    onClick={addRow}
                    className="w-full rounded-md border border-dashed border-border py-1.5 font-sans text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t("buttons.addBar")}
                  </button>
                )}
              </div>
            </Field>
            <Field label={t("fields.sortByValue")} hint={t("tips.sortByValue")}>
              <Segmented
                options={[
                  t("options.sort.none"),
                  t("options.sort.asc"),
                  t("options.sort.desc"),
                ]}
                selectedIndex={s.sortIdx}
                onSelect={(i) => update("sortIdx", i)}
              />
            </Field>
            <Field label={t("fields.topNOther")} hint={t("tips.topNOther")}>
              <div className="space-y-1.5">
                <Toggle
                  label={t("toggles.rollLongTail")}
                  hint={t("tips.rollLongTail")}
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

          <Accordion label={t("sections.states")}>
            <Field label={t("fields.mode")}>
              <Segmented
                options={[
                  t("options.state.ready"),
                  t("options.state.loading"),
                  t("options.state.refresh"),
                  t("options.state.error"),
                ]}
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
              <Field label={t("fields.loadingLabel")}>
                <TextInput
                  value={s.loadingLabel}
                  onChange={(v) => update("loadingLabel", v)}
                  placeholder={t("placeholders.loading")}
                />
              </Field>
            )}
            {s.stateMode === "error" && (
              <>
                <Field label={t("fields.errorMessage")}>
                  <TextInput
                    value={s.errorMessage}
                    onChange={(v) => update("errorMessage", v)}
                    placeholder={t("placeholders.errorMessage")}
                  />
                </Field>
                <Field label={t("fields.errorLabel")}>
                  <TextInput
                    value={s.errorLabel}
                    onChange={(v) => update("errorLabel", v)}
                    placeholder={t("placeholders.errorLabel")}
                  />
                </Field>
                <Toggle
                  label={t("toggles.showRetry")}
                  checked={s.withRetry}
                  onChange={(v) => update("withRetry", v)}
                />
                {s.withRetry && (
                  <Field label={t("fields.retryLabel")}>
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
            <Field label={t("fields.formats")}>
              <div className="space-y-1.5">
                <Toggle
                  label={t("toggles.pngButton")}
                  checked={s.exportPNG}
                  onChange={(v) => update("exportPNG", v)}
                />
                <Toggle
                  label={t("toggles.svgButton")}
                  checked={s.exportSVG}
                  onChange={(v) => update("exportSVG", v)}
                />
                <Toggle
                  label={t("toggles.csvButton")}
                  checked={s.exportCSV}
                  onChange={(v) => update("exportCSV", v)}
                />
                <Toggle
                  label={t("toggles.copyImageButton")}
                  checked={s.exportCopy}
                  onChange={(v) => update("exportCopy", v)}
                />
              </div>
            </Field>
            <Field label={t("fields.fileName")}>
              <TextInput
                value={s.exportFileName}
                onChange={(v) => update("exportFileName", v)}
                placeholder={t("placeholders.fileNameColumn")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.events")}>
            <Toggle
              label={t("toggles.trackEvents")}
              checked={s.eventsEnabled}
              onChange={(v) => update("eventsEnabled", v)}
            />
            {s.eventsEnabled && (
              <>
                <Field label={t("fields.lastClick")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.lastClickIndex !== null
                      ? `#${s.lastClickIndex} · ${s.lastClickLabel ?? "—"} · ${s.lastClickValue}`
                      : t("hints.noClicksYet")}
                  </div>
                </Field>
                <Field label={t("fields.hovering")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.hoverIndex !== null
                      ? `#${s.hoverIndex} · ${s.hoverLabel ?? "—"}`
                      : t("hints.mouseOutside")}
                  </div>
                </Field>
                <Field label={t("fields.focused")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.focusIndex !== null
                      ? `#${s.focusIndex} · ${s.focusLabel ?? "—"}`
                      : t("hints.noFocusYet")}
                  </div>
                </Field>
                <Field label={t("fields.programmaticFocus")}>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-sans text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => chartRef.current?.focusBar(0)}
                    >
                      <ChevronFirst className="h-3 w-3 shrink-0" />
                      {t("buttons.first")}
                    </button>
                    <button
                      type="button"
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-sans text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => {
                        const next = (s.focusIndex ?? -1) + 1;
                        chartRef.current?.focusBar(next);
                      }}
                    >
                      {t("buttons.next")}
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </button>
                    <button
                      type="button"
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-sans text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => chartRef.current?.focusBar(999)}
                    >
                      {t("buttons.last")}
                      <ChevronLast className="h-3 w-3 shrink-0" />
                    </button>
                  </div>
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.header")}>
            <Field label={t("fields.title")}>
              <TextInput
                value={s.headerTitle}
                onChange={(v) => update("headerTitle", v)}
                placeholder={t("placeholders.headerTitleColumn")}
              />
            </Field>
            <Field label={t("fields.subtitle")}>
              <TextInput
                value={s.headerSubtitle}
                onChange={(v) => update("headerSubtitle", v)}
                placeholder={t("placeholders.headerSubtitleColumn")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.xAxis")}>
            <Field label={t("fields.title")}>
              <TextInput
                value={s.xAxisTitle}
                onChange={(v) => update("xAxisTitle", v)}
                placeholder={t("placeholders.xAxisTitleColumn")}
              />
            </Field>
            <Toggle
              label={t("toggles.hideTickLabels")}
              checked={s.xAxisHideTicks}
              onChange={(v) => update("xAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label={t("sections.yAxis")}>
            <Field label={t("fields.title")}>
              <TextInput
                value={s.yAxisTitle}
                onChange={(v) => update("yAxisTitle", v)}
                placeholder={t("placeholders.yAxisTitleColumn")}
              />
            </Field>
            <Toggle
              label={t("toggles.customMax")}
              checked={s.yAxisMaxEnabled}
              onChange={(v) => update("yAxisMaxEnabled", v)}
            />
            {s.yAxisMaxEnabled && (
              <Field label={t("fields.maxValue")}>
                <NumberInput
                  value={s.yAxisMax}
                  onChange={(v) => update("yAxisMax", v)}
                />
              </Field>
            )}
            <Toggle
              label={t("toggles.hideTickLabels")}
              checked={s.yAxisHideTicks}
              onChange={(v) => update("yAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label={t("sections.numberFormat")}>
            <Field label={t("fields.prefix")}>
              <TextInput
                value={s.numberPrefix}
                onChange={(v) => update("numberPrefix", v)}
                placeholder={t("placeholders.prefix")}
              />
            </Field>
            <Field label={t("fields.suffix")}>
              <TextInput
                value={s.numberSuffix}
                onChange={(v) => update("numberSuffix", v)}
                placeholder={t("placeholders.suffix")}
              />
            </Field>
            <Field label={t("fields.decimals")}>
              <NumberInput
                value={s.numberDecimals}
                onChange={(v) => update("numberDecimals", Math.max(0, v))}
              />
            </Field>
            <Field label={t("fields.notation")}>
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
            <Field label={t("fields.style")}>
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
              <Field label={t("fields.currency")}>
                <TextInput
                  value={s.numberCurrency}
                  onChange={(v) => update("numberCurrency", v.toUpperCase())}
                  placeholder={t("placeholders.currency")}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.dataLabels")}>
            <Toggle
              label={t("toggles.showValueAboveBar")}
              checked={s.dataLabelsShow}
              onChange={(v) => update("dataLabelsShow", v)}
            />
          </Accordion>

          <Accordion label={t("sections.color")}>
            <Field label={t("fields.palette")}>
              <ColorPalette
                value={s.accentValue}
                onSelect={pickColor}
              />
            </Field>
            <Field label={t("fields.custom")}>
              <ColorCustomInput
                value={s.accentValue}
                onChange={pickColor}
              />
            </Field>
            {s.recentColors.length > 0 && (
              <Field label={t("fields.recent")}>
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

          <Accordion label={t("sections.barStyle")}>
            <Field label={t("fields.cornerRadius")}>
              <Segmented
                options={[
                  t("options.radius.sharp"),
                  t("options.radius.subtle"),
                  t("options.radius.rounded"),
                ]}
                selectedIndex={s.radiusIdx}
                onSelect={(i) => update("radiusIdx", i)}
              />
            </Field>
            <Field label={t("fields.density")}>
              <Segmented
                options={[
                  t("options.density.compact"),
                  t("options.density.normal"),
                  t("options.density.spacious"),
                ]}
                selectedIndex={s.densityIdx}
                onSelect={(i) => update("densityIdx", i)}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.scalability")}>
            <Toggle
              label={t("toggles.horizontalScroll")}
              checked={s.scrollEnabled}
              onChange={(v) => update("scrollEnabled", v)}
            />
            <Field label={t("fields.minBarWidth")}>
              <NumberInput
                value={s.minBarWidth}
                onChange={(v) =>
                  update("minBarWidth", Math.max(1, Math.floor(v)))
                }
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.pattern")}>
            <Field label={t("fields.mode")}>
              <Segmented
                options={[
                  t("options.patternMode.none"),
                  t("options.patternMode.first"),
                  t("options.patternMode.last"),
                  t("options.patternMode.all"),
                ]}
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
                label={
                  s.hatchMode === "first"
                    ? t("fields.untilIndex")
                    : t("fields.fromIndex")
                }
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
              <Field label={t("fields.style")}>
                <Select
                  options={[
                    t("options.patternStyle.diagonal"),
                    t("options.patternStyle.reverse"),
                    t("options.patternStyle.vertical"),
                    t("options.patternStyle.horizontal"),
                    t("options.patternStyle.dots"),
                  ]}
                  selectedIndex={s.patternStyleIdx}
                  onSelect={(i) => update("patternStyleIdx", i)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.emphasis")}>
            <Field label={t("fields.mode")}>
              <Segmented
                options={[
                  t("options.emphasis.none"),
                  t("options.emphasis.peak"),
                  t("options.emphasis.current"),
                  t("options.emphasis.index"),
                ]}
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
              <Field label={t("fields.barIndex")}>
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
                <Field label={t("fields.note")}>
                  <TextInput
                    value={s.emphasisNote}
                    onChange={(v) => update("emphasisNote", v)}
                    placeholder={t("placeholders.emphasisNote")}
                  />
                </Field>
                <Field label={t("fields.customColorOptional")}>
                  <ColorCustomInput
                    value={s.emphasisColor || s.accentValue}
                    onChange={(v) => update("emphasisColor", v)}
                  />
                </Field>
                {s.emphasisColor && (
                  <button
                    onClick={() => update("emphasisColor", "")}
                    className="cursor-pointer font-sans text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    {t("buttons.clearColor")}
                  </button>
                )}
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.referenceLine")}>
            <Toggle
              label={t("toggles.showReferenceLine")}
              checked={s.refShow}
              onChange={(v) => update("refShow", v)}
            />
            {s.refShow && (
              <>
                <Field label={t("fields.mode")}>
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
                    <Field label={t("fields.value")}>
                      <NumberInput
                        value={s.refValue}
                        onChange={(v) => update("refValue", v)}
                      />
                    </Field>
                    <Field label={t("fields.label")}>
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

          <Accordion label={t("sections.bands")}>
            <Toggle
              label={t("toggles.showPlotBand")}
              checked={s.bandsEnabled}
              onChange={(v) => update("bandsEnabled", v)}
            />
            {s.bandsEnabled && (
              <>
                <Field label={t("fields.fromIndex")}>
                  <NumberInput
                    value={s.bandFrom}
                    onChange={(v) =>
                      update("bandFrom", Math.max(0, Math.floor(v)))
                    }
                  />
                </Field>
                <Field label={t("fields.toIndex")}>
                  <NumberInput
                    value={s.bandTo}
                    onChange={(v) =>
                      update("bandTo", Math.max(0, Math.floor(v)))
                    }
                  />
                </Field>
                <Field label={t("fields.label")}>
                  <TextInput
                    value={s.bandLabel}
                    onChange={(v) => update("bandLabel", v)}
                    placeholder={t("placeholders.bandLabel")}
                  />
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.trend")}>
            <Toggle
              label={t("toggles.showTrend")}
              checked={s.trendShow}
              onChange={(v) => update("trendShow", v)}
            />
            {s.trendShow && (
              <Field label={t("fields.trendValue")}>
                <NumberInput
                  value={s.trendValue}
                  step={0.01}
                  onChange={(v) => update("trendValue", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.editorial")}>
            <Field label={t("fields.caption")}>
              <TextInput
                value={s.captionText}
                onChange={(v) => update("captionText", v)}
                placeholder={t("placeholders.captionColumn")}
              />
            </Field>
            <Field label={t("fields.watermark")}>
              <TextInput
                value={s.watermarkText}
                onChange={(v) => update("watermarkText", v)}
                placeholder={t("placeholders.watermark")}
              />
            </Field>
            <Toggle
              label={t("toggles.showAnnotation")}
              checked={s.annotationsEnabled}
              onChange={(v) => update("annotationsEnabled", v)}
            />
            {s.annotationsEnabled && (
              <>
                <Field label={t("fields.text")}>
                  <TextInput
                    value={s.annotationText}
                    onChange={(v) => update("annotationText", v)}
                    placeholder={t("placeholders.annotationText")}
                  />
                </Field>
                <Field label={t("fields.annotationX")}>
                  <TextInput
                    value={s.annotationLabel}
                    onChange={(v) => update("annotationLabel", v)}
                    placeholder={t("placeholders.annotationX")}
                  />
                </Field>
                <Field label={t("fields.annotationY")}>
                  <NumberInput
                    value={s.annotationY}
                    onChange={(v) => update("annotationY", v)}
                  />
                </Field>
                <Field label={t("fields.anchor")}>
                  <Segmented
                    options={[
                      t("options.anchor.top"),
                      t("options.anchor.right"),
                      t("options.anchor.bottom"),
                      t("options.anchor.left"),
                    ]}
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
                  label={t("toggles.dashedConnector")}
                  checked={s.annotationArrow}
                  onChange={(v) => update("annotationArrow", v)}
                />
              </>
            )}
          </Accordion>

          <Accordion label={t("sections.source")}>
            <Toggle
              label={t("toggles.showSourceLine")}
              checked={s.sourceShow}
              onChange={(v) => update("sourceShow", v)}
            />
            {s.sourceShow && (
              <Field label={t("fields.text")}>
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
              checked={s.animationEnabled}
              onChange={(v) => update("animationEnabled", v)}
            />
            {s.animationEnabled && (
              <Field label={t("fields.duration")}>
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

          <Accordion label={t("sections.forwardCompat")}>
            <Field label={t("fields.dataDescription")}>
              <TextInput
                value={s.dataDescription}
                onChange={(v) => update("dataDescription", v)}
                placeholder={t("placeholders.dataDescriptionColumn")}
              />
            </Field>
            <Field label={t("fields.testId")}>
              <TextInput
                value={s.testId}
                onChange={(v) => update("testId", v)}
                placeholder={t("placeholders.testIdColumn")}
              />
            </Field>
            <Toggle
              label={t("toggles.showJSON")}
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
