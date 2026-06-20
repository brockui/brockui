/**
 * BarChartStudio — Highcharts × Flourish-inspired interface, ported from
 * ColumnChartStudio for the horizontal Bar Chart.
 *
 *  ┌─ Code ────┬─ Chart ─────────┬─ Settings ──┐
 *  │ live TSX  │  rendered chart │  17 panels  │
 *  └───────────┴─────────────────┴─────────────┘
 *
 * Every setting in the right rail mutates state → chart re-renders → code
 * regenerates. Code panel is read-only with a copy button (paste-into-app).
 *
 * Settings accordions, adapted to the Bar API (canon §13 — what changed vs
 * Column: NO trend / bands / annotations / hatch-index / minBarWidth / height;
 * NEW: barThickness / labelWidth / maxHeight — the horizontal pre-decisions):
 * (Slots are a code feature — shown as a Usage snippet on the page, not a
 * Studio toggle.)
 *  1. Data (ranking presets + sort + topN)    9.  Number format
 *  2. Layout (thickness / gap / labelWidth /  10. Data labels (auto default)
 *     maxHeight + scroll)                     11. Reference line
 *  3. States                                  12. Editorial (caption/watermark)
 *  4. Export                                  13. Color (accent)
 *  5. Events                                  14. Bar style (radius + pattern)
 *  6. Header                                  15. Animation
 *  7. X-axis (VALUE axis)                     16. Forward-compat (JSON)
 *  8. Y-axis (CATEGORY axis)
 */

"use client";

import { useRef, useState } from "react";
import { ChevronFirst, ChevronLast, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart,
  type BarChartHandle,
} from "@/components/charts/bar-chart";
import { toJSON } from "@/components/charts/bar-chart-export";
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

type DatasetKey = "channels" | "regions" | "products" | "longLabels";

/**
 * Four ranking datasets in object form — the bar chart is the ranking shape,
 * so every preset is categorical (not temporal like Column's day buckets).
 * "Long" exists to demo the labelWidth + truncation policy.
 *
 * Demo data is locale-aware: on /ru the category labels render in Russian —
 * Cyrillic in the label column is a feature demo, not an accident. Numeric
 * values and goals are shared; only display strings fork. Component names in
 * the Products preset stay English in both locales (names are never
 * translated).
 */
type StudioLocale = "en" | "ru";

type DatasetPoint = { label: string; value: number };

type Dataset = {
  label: string;
  data: DatasetPoint[];
  suggestedGoal: number;
  suggestedGoalLabel: string;
};

function zip(labels: string[], values: number[]): DatasetPoint[] {
  return labels.map((label, i) => ({ label, value: values[i] }));
}

const CHANNEL_VALUES = [4120, 3870, 1290, 940, 620, 480];
const REGION_VALUES = [1840, 1620, 980, 760, 540, 410, 380, 290];
const LONG_VALUES = [1320, 1180, 940, 720, 510];

const PRODUCTS_DATA = zip(
  [
    "METRIC CARD",
    "DATA TABLE",
    "COLUMN CHART",
    "BAR CHART",
    "STAT DISPLAY",
    "BUTTON",
    "CHART WRAPPER",
  ],
  [2480, 1960, 1540, 1210, 880, 640, 420],
);

const DATASETS: Record<
  DatasetKey,
  {
    label: Record<StudioLocale, string>;
    data: Record<StudioLocale, DatasetPoint[]>;
    suggestedGoal: number;
    suggestedGoalLabel: Record<StudioLocale, string>;
  }
> = {
  channels: {
    label: { en: "Channels", ru: "Каналы" },
    data: {
      en: zip(
        ["DIRECT", "SEARCH", "SOCIAL", "EMAIL", "REFERRAL", "PARTNER"],
        CHANNEL_VALUES,
      ),
      ru: zip(
        ["ПРЯМОЙ", "ПОИСК", "СОЦСЕТИ", "EMAIL", "РЕФЕРАЛЫ", "ПАРТНЁРЫ"],
        CHANNEL_VALUES,
      ),
    },
    suggestedGoal: 2000,
    suggestedGoalLabel: { en: "Channel target", ru: "Цель по каналам" },
  },
  regions: {
    label: { en: "Regions", ru: "Регионы" },
    data: {
      en: zip(
        [
          "ALMATY",
          "ASTANA",
          "SHYMKENT",
          "KARAGANDA",
          "AKTOBE",
          "TARAZ",
          "PAVLODAR",
          "ATYRAU",
        ],
        REGION_VALUES,
      ),
      ru: zip(
        [
          "АЛМАТЫ",
          "АСТАНА",
          "ШЫМКЕНТ",
          "КАРАГАНДА",
          "АКТОБЕ",
          "ТАРАЗ",
          "ПАВЛОДАР",
          "АТЫРАУ",
        ],
        REGION_VALUES,
      ),
    },
    suggestedGoal: 850,
    suggestedGoalLabel: { en: "Regional plan", ru: "План по регионам" },
  },
  products: {
    label: { en: "Products", ru: "Продукты" },
    data: { en: PRODUCTS_DATA, ru: PRODUCTS_DATA },
    suggestedGoal: 1500,
    suggestedGoalLabel: { en: "Quota", ru: "Квота" },
  },
  longLabels: {
    label: { en: "Long", ru: "Длинные" },
    data: {
      en: zip(
        [
          "Customer Success Operations",
          "Enterprise Infrastructure",
          "Developer Experience Tooling",
          "Marketing & Communications",
          "Research & Special Projects",
        ],
        LONG_VALUES,
      ),
      ru: zip(
        [
          "Клиентский успех и поддержка",
          "Корпоративная инфраструктура",
          "Инструменты для разработчиков",
          "Маркетинг и коммуникации",
          "Исследования и спецпроекты",
        ],
        LONG_VALUES,
      ),
    },
    suggestedGoal: 1000,
    suggestedGoalLabel: { en: "Headcount budget", ru: "Бюджет штата" },
  },
};

/** Resolve the per-locale view of every dataset (stable array identities). */
function datasetsFor(locale: StudioLocale): Record<DatasetKey, Dataset> {
  const out = {} as Record<DatasetKey, Dataset>;
  for (const key of Object.keys(DATASETS) as DatasetKey[]) {
    const d = DATASETS[key];
    out[key] = {
      label: d.label[locale],
      data: d.data[locale],
      suggestedGoal: d.suggestedGoal,
      suggestedGoalLabel: d.suggestedGoalLabel[locale],
    };
  }
  return out;
}

/* ─── State shape ────────────────────────────────────────────────────── */

type StudioState = {
  // data
  dataset: DatasetKey;
  /** Editable bar data — seeded from the dataset, then user-editable. */
  rows: DatasetPoint[];
  sortIdx: number; // 0 = none, 1 = asc, 2 = desc
  topNEnabled: boolean;
  topNValue: number;
  // layout (bar-specific — the horizontal pre-decisions)
  barThickness: number;
  gapValue: number;
  labelWidthValue: number;
  maxHeightEnabled: boolean;
  maxHeightValue: number;
  scrollAuto: boolean;
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
  // header
  headerTitle: string;
  headerSubtitle: string;
  // x-axis (VALUE axis)
  xAxisTitle: string;
  xAxisMaxEnabled: boolean;
  xAxisMax: number;
  xAxisHideTicks: boolean;
  // y-axis (CATEGORY axis)
  yAxisTitle: string;
  yAxisHideLabels: boolean;
  // number format
  numberPrefix: string;
  numberSuffix: string;
  numberDecimals: number;
  numberNotationIdx: number;
  numberStyleIdx: number;
  numberCurrency: string;
  // data labels — 0 = auto (component default), 1 = always, 2 = never
  dataLabelsIdx: number;
  // reference line
  refShow: boolean;
  refStatIdx: number; // 0 = fixed value, 1 = mean, 2 = median
  refValue: number;
  refLabel: string;
  // editorial
  captionText: string;
  watermarkText: string;
  sourceText: string;
  // color
  accentValue: string;
  recentColors: string[];
  // bar style
  radiusIdx: number;
  patternAll: boolean;
  patternStyleIdx: number;
  // animation
  animationEnabled: boolean;
  animationDuration: number;
  // forward-compat
  dataDescription: string;
  testId: string;
  showJSON: boolean;
};

const INITIAL_STATE: StudioState = {
  dataset: "channels",
  rows: DATASETS.channels.data.en,
  sortIdx: 0,
  topNEnabled: false,
  topNValue: 5,
  barThickness: 24,
  gapValue: 8,
  labelWidthValue: 96,
  maxHeightEnabled: false,
  maxHeightValue: 160,
  scrollAuto: true,
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
  exportFileName: "traffic-by-channel",
  eventsEnabled: true,
  lastClickIndex: null,
  lastClickLabel: null,
  lastClickValue: null,
  hoverIndex: null,
  hoverLabel: null,
  focusIndex: null,
  focusLabel: null,
  headerTitle: "Traffic by channel",
  headerSubtitle: "Last 30 days",
  xAxisTitle: "",
  xAxisMaxEnabled: false,
  xAxisMax: 5000,
  xAxisHideTicks: false,
  yAxisTitle: "",
  yAxisHideLabels: false,
  numberPrefix: "",
  numberSuffix: "",
  numberDecimals: 0,
  numberNotationIdx: 0,
  numberStyleIdx: 0,
  numberCurrency: "USD",
  dataLabelsIdx: 0,
  refShow: false,
  refStatIdx: 0,
  refValue: 2000,
  refLabel: "Channel target",
  captionText: "",
  watermarkText: "",
  sourceText: "Brock Analytics, 2026",
  accentValue: DEFAULT_ACCENT,
  recentColors: [],
  radiusIdx: 0,
  patternAll: false,
  patternStyleIdx: 0,
  animationEnabled: true,
  animationDuration: 400,
  dataDescription: "",
  testId: "",
  showJSON: false,
};

/* ─── Code generator ─────────────────────────────────────────────────── */

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * Resolve the numberFormat locale for demo determinism: whenever notation or
 * style deviates from the defaults, the live chart and the generated code pin
 * locale: "en-US" so the rendered separators never depend on the host locale.
 */
function numberFormatLocale(s: StudioState): string | undefined {
  const notation = NOTATIONS[s.numberNotationIdx].value;
  const style = NUMBER_STYLES[s.numberStyleIdx].value;
  return notation !== "standard" || style !== "decimal" ? "en-US" : undefined;
}

function generateCode(
  s: StudioState,
  datasets: Record<DatasetKey, Dataset>,
): string {
  const ds: Dataset = { ...datasets[s.dataset], data: s.rows };
  const accent = s.accentValue;
  const radius = RADII[s.radiusIdx];

  const lines: string[] = [];
  lines.push(`import { BarChart } from "@/components/charts/bar-chart";`);
  lines.push("");
  // Object-form data — labels travel with their values (DataFrame-friendly).
  const parts = ds.data.map(
    (d) => `  { label: ${quote(d.label)}, value: ${d.value} }`,
  );
  lines.push(`const data = [\n${parts.join(",\n")}\n];`);
  lines.push("");
  lines.push(`export function Example() {`);
  lines.push(`  return (`);
  lines.push(`    <BarChart`);
  lines.push(`      data={data}`);

  // Layout — the chart's height DERIVES from the data (no height prop), so
  // only deviations from the defaults are worth a line.
  if (s.barThickness !== 24) {
    lines.push(`      barThickness={${s.barThickness}}`);
  }
  if (s.gapValue !== 8) {
    lines.push(`      gap={${s.gapValue}}`);
  }
  if (s.labelWidthValue !== 96) {
    lines.push(`      labelWidth={${s.labelWidthValue}}`);
  }
  // maxHeight only does anything together with scroll="auto" — emit as a pair.
  if (s.maxHeightEnabled) {
    lines.push(`      maxHeight={${s.maxHeightValue}}`);
    if (s.scrollAuto) {
      lines.push(`      scroll="auto"`);
    }
  }

  if (accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase()) {
    lines.push(`      accent=${quote(accent)}`);
  }
  if (radius.value !== 0) {
    lines.push(`      barRadius={${radius.value}}`);
  }
  if (s.headerTitle || s.headerSubtitle) {
    const fields: string[] = [];
    if (s.headerTitle) fields.push(`title: ${quote(s.headerTitle)}`);
    if (s.headerSubtitle) fields.push(`subtitle: ${quote(s.headerSubtitle)}`);
    lines.push(`      header={{ ${fields.join(", ")} }}`);
  }
  if (s.xAxisTitle || s.xAxisMaxEnabled || s.xAxisHideTicks) {
    const fields: string[] = [];
    if (s.xAxisTitle) fields.push(`title: ${quote(s.xAxisTitle)}`);
    if (s.xAxisMaxEnabled) fields.push(`max: ${s.xAxisMax}`);
    if (s.xAxisHideTicks) fields.push(`hideTicks: true`);
    lines.push(`      xAxis={{ ${fields.join(", ")} }}`);
  }
  if (s.yAxisTitle || s.yAxisHideLabels) {
    const fields: string[] = [];
    if (s.yAxisTitle) fields.push(`title: ${quote(s.yAxisTitle)}`);
    if (s.yAxisHideLabels) fields.push(`hideTicks: true`);
    lines.push(`      yAxis={{ ${fields.join(", ")} }}`);
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
    const fields: string[] = [];
    if (s.numberPrefix) fields.push(`prefix: ${quote(s.numberPrefix)}`);
    if (s.numberSuffix) fields.push(`suffix: ${quote(s.numberSuffix)}`);
    if (s.numberDecimals > 0) fields.push(`decimals: ${s.numberDecimals}`);
    const locale = numberFormatLocale(s);
    if (locale) fields.push(`locale: ${quote(locale)}`);
    if (notationVal !== "standard")
      fields.push(`notation: ${quote(notationVal)}`);
    if (styleVal !== "decimal") fields.push(`style: ${quote(styleVal)}`);
    if (styleVal === "currency")
      fields.push(`currency: ${quote(s.numberCurrency || "USD")}`);
    lines.push(`      numberFormat={{ ${fields.join(", ")} }}`);
  }
  // "auto" is the component default — only Always / Never earn a line.
  if (s.dataLabelsIdx === 1) {
    lines.push(`      dataLabels={{ show: true }}`);
  } else if (s.dataLabelsIdx === 2) {
    lines.push(`      dataLabels={{ show: false }}`);
  }
  if (s.refShow) {
    const refValueCode =
      s.refStatIdx === 1
        ? `{ stat: "mean" }`
        : s.refStatIdx === 2
          ? `{ stat: "median" }`
          : `${s.refValue}`;
    const refLabelCode =
      s.refStatIdx === 0 && s.refLabel ? `, label: ${quote(s.refLabel)}` : "";
    lines.push(
      `      referenceLine={{ value: ${refValueCode}${refLabelCode} }}`,
    );
  }
  if (s.sourceText) {
    lines.push(`      source=${quote(s.sourceText)}`);
  }
  if (s.patternAll) {
    lines.push(`      pattern="hatched"`);
    const styleValue = PATTERN_STYLES[s.patternStyleIdx].value;
    if (styleValue !== "diagonal") {
      lines.push(`      patternStyle=${quote(styleValue)}`);
    }
  }
  const sortValue = (["none", "asc", "desc"] as const)[s.sortIdx];
  if (sortValue !== "none") {
    lines.push(`      sort=${quote(sortValue)}`);
  }
  if (s.topNEnabled && s.topNValue > 0) {
    lines.push(`      topN={${s.topNValue}}`);
  }
  if (!s.animationEnabled || s.animationDuration !== 400) {
    const fields: string[] = [];
    if (!s.animationEnabled) fields.push(`enabled: false`);
    if (s.animationDuration !== 400) {
      fields.push(`duration: ${s.animationDuration}`);
    }
    lines.push(`      animation={{ ${fields.join(", ")} }}`);
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
  // Editorial — caption / watermark.
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

export function BarChartStudio() {
  const t = useTranslations("studio");
  const locale: StudioLocale = useLocale() === "ru" ? "ru" : "en";
  const datasets = datasetsFor(locale);
  // The reference-line label must agree with the active locale's dataset, so
  // the initial state derives from it.
  // Seeded demo TEXT is locale-aware too — the /ru preview and generated code
  // read Russian end to end. Only filenames/slugs stay latin.
  const seed =
    locale === "ru"
      ? {
          headerTitle: "Трафик по каналам",
          headerSubtitle: "Последние 30 дней",
          errorMessage: "Не удалось загрузить метрики — таймаут API.",
          loadingLabel: "Загрузка…",
          errorLabel: "Ошибка",
          retryLabel: "Повторить",
        }
      : {};
  const [s, setS] = useState<StudioState>(() => {
    const c = datasetsFor(locale).channels;
    return {
      ...INITIAL_STATE,
      ...seed,
      rows: c.data.map((d) => ({ ...d })),
      refLabel: c.suggestedGoalLabel,
    };
  });
  const chartRef = useRef<BarChartHandle>(null);

  // Chart-preview theme — auto (follow the site), or pinned light/dark.
  const {
    previewTheme,
    mode: previewMode,
    setMode: setPreviewMode,
  } = useStudioPreviewTheme();

  function update<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function setDataset(dataset: DatasetKey) {
    const ds = datasets[dataset];
    setS((prev) => ({
      ...prev,
      dataset,
      rows: ds.data.map((d) => ({ ...d })),
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

  // Effective dataset: bar data comes from the editable rows; dataset meta
  // (display name, suggested goal) still comes from the selected dataset.
  const ds: Dataset = { ...datasets[s.dataset], data: s.rows };
  const accent = s.accentValue;
  const radius = RADII[s.radiusIdx];
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

  // For the "loading" preview we need the chart to render the FULL skeleton
  // (no-data + loading). Passing an empty data array triggers that path.
  // "loading-overlay" keeps the data so the overlay variant renders on top.
  // "error" passes the message; the chart will replace itself with ErrorState.
  const effectiveChartData = s.stateMode === "loading" ? [] : ds.data;
  const effectiveLoading =
    s.stateMode === "loading" || s.stateMode === "loading-overlay";
  const effectiveError =
    s.stateMode === "error" ? s.errorMessage || "Unknown error" : undefined;

  const referenceLineValue = s.refShow
    ? {
        value:
          s.refStatIdx === 1
            ? { stat: "mean" as const }
            : s.refStatIdx === 2
              ? { stat: "median" as const }
              : s.refValue,
        label: s.refStatIdx === 0 && s.refLabel ? s.refLabel : undefined,
      }
    : undefined;

  // JSON pane content — built once, shared by the copy button and the <pre>.
  const jsonText = s.showJSON
    ? JSON.stringify(
        toJSON({
          data: ds.data,
          barThickness: s.barThickness,
          gap: s.gapValue,
          labelWidth: s.labelWidthValue,
          maxHeight: s.maxHeightEnabled ? s.maxHeightValue : undefined,
          scroll:
            s.maxHeightEnabled && s.scrollAuto ? ("auto" as const) : undefined,
          accent,
          barRadius: radius.value,
          header:
            s.headerTitle || s.headerSubtitle
              ? { title: s.headerTitle, subtitle: s.headerSubtitle }
              : undefined,
          referenceLine: referenceLineValue,
          sort:
            s.sortIdx !== 0
              ? (["none", "asc", "desc"] as const)[s.sortIdx]
              : undefined,
          topN: s.topNEnabled && s.topNValue > 0 ? s.topNValue : undefined,
          source: s.sourceText || undefined,
          caption: s.captionText || undefined,
          watermark: s.watermarkText || undefined,
          dataDescription: s.dataDescription || undefined,
          chartType: "bar",
        }),
        null,
        2,
      )
    : "";

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
          <BarChart
            ref={chartRef}
            caption={s.captionText || undefined}
            watermark={s.watermarkText || undefined}
            dataDescription={s.dataDescription || undefined}
            data-testid={s.testId || undefined}
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
            barThickness={s.barThickness}
            gap={s.gapValue}
            labelWidth={s.labelWidthValue}
            maxHeight={s.maxHeightEnabled ? s.maxHeightValue : undefined}
            scroll={s.maxHeightEnabled && s.scrollAuto ? "auto" : "none"}
            accent={accent}
            barRadius={radius.value}
            header={
              s.headerTitle || s.headerSubtitle
                ? { title: s.headerTitle, subtitle: s.headerSubtitle }
                : undefined
            }
            xAxis={
              s.xAxisTitle || s.xAxisMaxEnabled || s.xAxisHideTicks
                ? {
                    title: s.xAxisTitle || undefined,
                    max: s.xAxisMaxEnabled ? s.xAxisMax : undefined,
                    hideTicks: s.xAxisHideTicks,
                  }
                : undefined
            }
            yAxis={
              s.yAxisTitle || s.yAxisHideLabels
                ? {
                    title: s.yAxisTitle || undefined,
                    hideTicks: s.yAxisHideLabels,
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
                locale: numberFormatLocale(s),
                notation,
                style,
                currency:
                  style === "currency" ? s.numberCurrency || "USD" : undefined,
              };
            })()}
            dataLabels={
              s.dataLabelsIdx === 0
                ? undefined
                : { show: s.dataLabelsIdx === 1 }
            }
            referenceLine={referenceLineValue}
            source={s.sourceText || undefined}
            pattern={s.patternAll ? "hatched" : "solid"}
            patternStyle={
              s.patternAll ? PATTERN_STYLES[s.patternStyleIdx].value : undefined
            }
            sort={(["none", "asc", "desc"] as const)[s.sortIdx]}
            topN={s.topNEnabled ? s.topNValue : undefined}
            animation={{
              enabled: s.animationEnabled,
              duration: s.animationDuration,
            }}
          />
        </div>
        {s.showJSON && (
          <div className="border-t border-border">
            <PanelHeader label={t("panels.json")}>
              <CopyButton text={jsonText} />
            </PanelHeader>
            <pre className="max-h-72 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
              <code>{jsonText}</code>
            </pre>
          </div>
        )}
      </div>

      {/* ── Settings panel (right) ────────────────────────────────── */}
      <aside className="border border-border bg-card lg:border-l-0">
        <PanelHeader label={t("panels.settings")} />
        <div className="divide-y divide-border">
          <Accordion label={t("sections.data")} defaultOpen>
            <Field label={t("fields.dataset")} hint={t("tips.preset")}>
              <Segmented
                options={(Object.keys(DATASETS) as DatasetKey[]).map(
                  (k) => datasets[k].label,
                )}
                selectedIndex={(Object.keys(DATASETS) as DatasetKey[]).indexOf(
                  s.dataset,
                )}
                onSelect={(i) =>
                  setDataset((Object.keys(DATASETS) as DatasetKey[])[i])
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

          <Accordion label={t("sections.layout")}>
            <Field label={t("fields.barThickness")} hint={t("tips.barThickness")}>
              <NumberInput
                value={s.barThickness}
                onChange={(v) =>
                  update("barThickness", Math.max(1, Math.floor(v)))
                }
              />
            </Field>
            <Field label={t("fields.gap")} hint={t("tips.gap")}>
              <NumberInput
                value={s.gapValue}
                onChange={(v) => update("gapValue", Math.max(0, Math.floor(v)))}
              />
            </Field>
            <Field label={t("fields.labelWidth")} hint={t("tips.labelWidth")}>
              <NumberInput
                value={s.labelWidthValue}
                onChange={(v) =>
                  update("labelWidthValue", Math.max(0, Math.floor(v)))
                }
              />
            </Field>
            <Toggle
              label={t("toggles.capHeight")}
              hint={t("tips.capHeight")}
              checked={s.maxHeightEnabled}
              onChange={(v) => update("maxHeightEnabled", v)}
            />
            {s.maxHeightEnabled && (
              <>
                <Field label={t("fields.maxHeight")} hint={t("tips.maxHeight")}>
                  <NumberInput
                    value={s.maxHeightValue}
                    onChange={(v) =>
                      update("maxHeightValue", Math.max(40, Math.floor(v)))
                    }
                  />
                </Field>
                <Toggle
                  label={t("toggles.scrollOverflow")}
                  hint={t("tips.scrollOverflow")}
                  checked={s.scrollAuto}
                  onChange={(v) => update("scrollAuto", v)}
                />
                {!s.scrollAuto && (
                  <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {t.rich("hints.maxHeightNoop", {
                      code: (chunks) => <code>{chunks}</code>,
                    })}
                  </div>
                )}
              </>
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
                placeholder={t("placeholders.fileNameBar")}
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
                    {s.lastClickIndex !== null
                      ? `#${s.lastClickIndex} · ${s.lastClickLabel ?? "—"} · ${s.lastClickValue}`
                      : t("hints.noClicksYet")}
                  </div>
                </Field>
                <Field label={t("fields.hovering")} hint={t("tips.hovering")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.hoverIndex !== null
                      ? `#${s.hoverIndex} · ${s.hoverLabel ?? "—"}`
                      : t("hints.mouseOutside")}
                  </div>
                </Field>
                <Field label={t("fields.focused")} hint={t("tips.focused")}>
                  <div
                    className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.focusIndex !== null
                      ? `#${s.focusIndex} · ${s.focusLabel ?? "—"}`
                      : t("hints.noFocusYet")}
                  </div>
                </Field>
                <Field label={t("fields.programmaticFocus")} hint={t("tips.programmaticFocus")}>
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
            <Field label={t("fields.title")} hint={t("tips.headerTitle")}>
              <TextInput
                value={s.headerTitle}
                onChange={(v) => update("headerTitle", v)}
                placeholder={t("placeholders.headerTitleBar")}
              />
            </Field>
            <Field label={t("fields.subtitle")} hint={t("tips.subtitle")}>
              <TextInput
                value={s.headerSubtitle}
                onChange={(v) => update("headerSubtitle", v)}
                placeholder={t("placeholders.headerSubtitleBar")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.xAxisValue")}>
            <Field label={t("fields.title")} hint={t("tips.xAxisTitle")}>
              <TextInput
                value={s.xAxisTitle}
                onChange={(v) => update("xAxisTitle", v)}
                placeholder={t("placeholders.xAxisTitleBar")}
              />
            </Field>
            <Toggle
              label={t("toggles.customMaxExtendOnly")}
              hint={t("tips.customMaxExtendOnly")}
              checked={s.xAxisMaxEnabled}
              onChange={(v) => update("xAxisMaxEnabled", v)}
            />
            {s.xAxisMaxEnabled && (
              <Field label={t("fields.maxValue")} hint={t("tips.maxValue")}>
                <NumberInput
                  value={s.xAxisMax}
                  onChange={(v) => update("xAxisMax", v)}
                />
              </Field>
            )}
            <Toggle
              label={t("toggles.hideTickLabels")}
              hint={t("tips.hideXTicks")}
              checked={s.xAxisHideTicks}
              onChange={(v) => update("xAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label={t("sections.yAxisCategory")}>
            <Field label={t("fields.title")} hint={t("tips.yAxisTitle")}>
              <TextInput
                value={s.yAxisTitle}
                onChange={(v) => update("yAxisTitle", v)}
                placeholder={t("placeholders.yAxisTitleBar")}
              />
            </Field>
            <Toggle
              label={t("toggles.hideCategoryLabels")}
              hint={t("tips.hideCategoryLabels")}
              checked={s.yAxisHideLabels}
              onChange={(v) => update("yAxisHideLabels", v)}
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

          <Accordion label={t("sections.dataLabels")}>
            <Field label={t("fields.showValueAtBarEnd")} hint={t("tips.showValueAtBarEnd")}>
              <Segmented
                options={[
                  t("options.dataLabels.auto"),
                  t("options.dataLabels.always"),
                  t("options.dataLabels.never"),
                ]}
                selectedIndex={s.dataLabelsIdx}
                onSelect={(i) => update("dataLabelsIdx", i)}
              />
            </Field>
            {s.dataLabelsIdx === 0 && (
              <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                {t("hints.dataLabelsAuto")}
              </div>
            )}
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

          <Accordion label={t("sections.editorial")}>
            <Field label={t("fields.caption")} hint={t("tips.caption")}>
              <TextInput
                value={s.captionText}
                onChange={(v) => update("captionText", v)}
                placeholder={t("placeholders.captionBar")}
              />
            </Field>
            <Field label={t("fields.watermark")} hint={t("tips.watermark")}>
              <TextInput
                value={s.watermarkText}
                onChange={(v) => update("watermarkText", v)}
                placeholder={t("placeholders.watermark")}
              />
            </Field>
            <Field label={t("fields.sourceLine")} hint={t("tips.sourceText")}>
              <TextInput
                value={s.sourceText}
                onChange={(v) => update("sourceText", v)}
                placeholder={t("placeholders.source")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.color")}>
            <Field label={t("fields.palette")} hint={t("tips.palette")}>
              <ColorPalette value={s.accentValue} onSelect={pickColor} />
            </Field>
            <Field label={t("fields.custom")} hint={t("tips.custom")}>
              <ColorCustomInput value={s.accentValue} onChange={pickColor} />
            </Field>
            {s.recentColors.length > 0 && (
              <Field label={t("fields.recent")} hint={t("tips.recent")}>
                <div className="flex gap-1.5">
                  {s.recentColors.map((c) => (
                    <Swatch
                      key={c}
                      color={c}
                      selected={c.toLowerCase() === s.accentValue.toLowerCase()}
                      onClick={() => pickColor(c)}
                      title={c}
                    />
                  ))}
                </div>
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.barStyleHorizontal")}>
            <Field label={t("fields.cornerRadius")} hint={t("tips.cornerRadius")}>
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
            <Field label={t("fields.pattern")} hint={t("tips.patternMode")}>
              <Segmented
                options={[
                  t("options.patternAll.none"),
                  t("options.patternAll.allHatched"),
                ]}
                selectedIndex={s.patternAll ? 1 : 0}
                onSelect={(i) => update("patternAll", i === 1)}
              />
            </Field>
            {s.patternAll && (
              <Field label={t("fields.patternStyle")} hint={t("tips.patternStyle")}>
                <Segmented
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
                placeholder={t("placeholders.dataDescriptionBar")}
              />
            </Field>
            <Field label={t("fields.testId")} hint={t("tips.testId")}>
              <TextInput
                value={s.testId}
                onChange={(v) => update("testId", v)}
                placeholder={t("placeholders.testIdBar")}
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
