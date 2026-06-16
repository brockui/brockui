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
 *  1. Data (ranking presets + sort + topN)    10. Number format
 *  2. Layout (thickness / gap / labelWidth /  11. Data labels (auto default)
 *     maxHeight + scroll)                     12. Reference line
 *  3. States                                  13. Editorial (caption/watermark)
 *  4. Export                                  14. Color (accent)
 *  5. Slots                                   15. Bar style (radius + pattern)
 *  6. Events                                  16. Animation
 *  7. Header                                  17. Forward-compat (JSON)
 *  8. X-axis (VALUE axis)
 *  9. Y-axis (CATEGORY axis)
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart,
  type BarChartHandle,
  type BarChartSlots,
  type BarChartTooltipSlotProps,
} from "@/components/charts/bar-chart";
import { toJSON } from "@/components/charts/bar-chart-export";
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
  // slots (Studio demo)
  slotTooltip: boolean;
  slotEmpty: boolean;
  slotCaption: boolean;
  slotWatermark: boolean;
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
  slotTooltip: false,
  slotEmpty: false,
  slotCaption: false,
  slotWatermark: false,
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
  refShow: true,
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
  const ds = datasets[s.dataset];
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
  const [s, setS] = useState<StudioState>(() => ({
    ...INITIAL_STATE,
    ...seed,
    refLabel: datasetsFor(locale).channels.suggestedGoalLabel,
  }));
  const chartRef = useRef<BarChartHandle>(null);

  // Chart-preview theme. Follows the site theme until the user explicitly
  // overrides it via the toggle in the Chart panel header — then it sticks,
  // so flipping the global switch doesn't yank the preview around.
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const previewOverridden = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (!previewOverridden.current) {
        setPreviewTheme(root.classList.contains("dark") ? "dark" : "light");
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Inline demo slot components — show what slot overrides look like
  // without requiring users to wire their own. Each is a tiny illustrative
  // implementation that drops Brock UI defaults.
  const slots = (() => {
    if (!s.slotTooltip && !s.slotEmpty && !s.slotCaption && !s.slotWatermark) {
      return undefined;
    }
    const out: BarChartSlots = {};
    if (s.slotTooltip) {
      const DemoTooltip: React.FC<BarChartTooltipSlotProps> = ({
        point,
        index,
        value,
        label,
      }) => {
        return (
          <div className="flex flex-col gap-1 rounded-[2px] border-2 border-brock-accent bg-background p-2 shadow-lg">
            <span className="font-pixel text-[10px] tracking-wider text-brock-accent uppercase">
              Bar #{index + 1}
              {label ? ` · ${label}` : ""}
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

  function setDataset(dataset: DatasetKey) {
    const ds = datasets[dataset];
    setS((prev) => ({
      ...prev,
      dataset,
      refValue: ds.suggestedGoal,
      refLabel: ds.suggestedGoalLabel,
    }));
  }

  const ds = datasets[s.dataset];
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
          <PreviewThemeToggle
            value={previewTheme}
            onChange={(t) => {
              previewOverridden.current = true;
              setPreviewTheme(t);
            }}
          />
        </PanelHeader>
        {/* Scoped theme: the resolved class re-binds every semantic CSS token
            inside this subtree, so the preview (and exports — they resolve
            vars off the live figure) render in the chosen theme regardless of
            the site theme. */}
        <div className={`${previewTheme} bg-background p-6`}>
          <BarChart
            ref={chartRef}
            slots={slots}
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
            <Field label={t("fields.dataset")}>
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
            <Field label={t("fields.sortByValue")}>
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
            <Field label={t("fields.topNOther")}>
              <div className="space-y-1.5">
                <Toggle
                  label={t("toggles.rollLongTail")}
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
            <Field label={t("fields.barThickness")}>
              <NumberInput
                value={s.barThickness}
                onChange={(v) =>
                  update("barThickness", Math.max(1, Math.floor(v)))
                }
              />
            </Field>
            <Field label={t("fields.gap")}>
              <NumberInput
                value={s.gapValue}
                onChange={(v) => update("gapValue", Math.max(0, Math.floor(v)))}
              />
            </Field>
            <Field label={t("fields.labelWidth")}>
              <NumberInput
                value={s.labelWidthValue}
                onChange={(v) =>
                  update("labelWidthValue", Math.max(0, Math.floor(v)))
                }
              />
            </Field>
            <Toggle
              label={t("toggles.capHeight")}
              checked={s.maxHeightEnabled}
              onChange={(v) => update("maxHeightEnabled", v)}
            />
            {s.maxHeightEnabled && (
              <>
                <Field label={t("fields.maxHeight")}>
                  <NumberInput
                    value={s.maxHeightValue}
                    onChange={(v) =>
                      update("maxHeightValue", Math.max(40, Math.floor(v)))
                    }
                  />
                </Field>
                <Toggle
                  label={t("toggles.scrollOverflow")}
                  checked={s.scrollAuto}
                  onChange={(v) => update("scrollAuto", v)}
                />
                {!s.scrollAuto && (
                  <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {t.rich("hints.maxHeightNoop", {
                      code: (chunks) => <code>{chunks}</code>,
                    })}
                  </div>
                )}
              </>
            )}
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
                      ["ready", "loading", "loading-overlay", "error"] as const
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
                placeholder={t("placeholders.fileNameBar")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.slots")}>
            <Field label={t("fields.demoSlots")}>
              <div className="space-y-1.5">
                <Toggle
                  label={t("toggles.customTooltip")}
                  checked={s.slotTooltip}
                  onChange={(v) => update("slotTooltip", v)}
                />
                <Toggle
                  label={t("toggles.customEmpty")}
                  checked={s.slotEmpty}
                  onChange={(v) => update("slotEmpty", v)}
                />
                <Toggle
                  label={t("toggles.readingNoteCaption")}
                  checked={s.slotCaption}
                  onChange={(v) => update("slotCaption", v)}
                />
                <Toggle
                  label={t("toggles.diagonalWatermark")}
                  checked={s.slotWatermark}
                  onChange={(v) => update("slotWatermark", v)}
                />
              </div>
            </Field>
            {s.slotEmpty && (
              <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                {t.rich("hints.emptySlot", {
                  code: (chunks) => <code>{chunks}</code>,
                })}
              </div>
            )}
            {s.slotTooltip && (
              <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                {t("hints.tooltipSlot")}
              </div>
            )}
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
                    className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.lastClickIndex !== null
                      ? `#${s.lastClickIndex} · ${s.lastClickLabel ?? "—"} · ${s.lastClickValue}`
                      : t("hints.noClicksYet")}
                  </div>
                </Field>
                <Field label={t("fields.hovering")}>
                  <div
                    className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {s.hoverIndex !== null
                      ? `#${s.hoverIndex} · ${s.hoverLabel ?? "—"}`
                      : t("hints.mouseOutside")}
                  </div>
                </Field>
                <Field label={t("fields.focused")}>
                  <div
                    className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] tabular-nums text-foreground"
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
                      className="flex-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground"
                      onClick={() => chartRef.current?.focusBar(0)}
                    >
                      ◀ {t("buttons.first")}
                    </button>
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground"
                      onClick={() => {
                        const next = (s.focusIndex ?? -1) + 1;
                        chartRef.current?.focusBar(next);
                      }}
                    >
                      {t("buttons.next")} ▶
                    </button>
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-[2px] border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-brock-accent/60 hover:text-foreground"
                      onClick={() => chartRef.current?.focusBar(999)}
                    >
                      {t("buttons.last")} ▶▶
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
                placeholder={t("placeholders.headerTitleBar")}
              />
            </Field>
            <Field label={t("fields.subtitle")}>
              <TextInput
                value={s.headerSubtitle}
                onChange={(v) => update("headerSubtitle", v)}
                placeholder={t("placeholders.headerSubtitleBar")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.xAxisValue")}>
            <Field label={t("fields.title")}>
              <TextInput
                value={s.xAxisTitle}
                onChange={(v) => update("xAxisTitle", v)}
                placeholder={t("placeholders.xAxisTitleBar")}
              />
            </Field>
            <Toggle
              label={t("toggles.customMaxExtendOnly")}
              checked={s.xAxisMaxEnabled}
              onChange={(v) => update("xAxisMaxEnabled", v)}
            />
            {s.xAxisMaxEnabled && (
              <Field label={t("fields.maxValue")}>
                <NumberInput
                  value={s.xAxisMax}
                  onChange={(v) => update("xAxisMax", v)}
                />
              </Field>
            )}
            <Toggle
              label={t("toggles.hideTickLabels")}
              checked={s.xAxisHideTicks}
              onChange={(v) => update("xAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label={t("sections.yAxisCategory")}>
            <Field label={t("fields.title")}>
              <TextInput
                value={s.yAxisTitle}
                onChange={(v) => update("yAxisTitle", v)}
                placeholder={t("placeholders.yAxisTitleBar")}
              />
            </Field>
            <Toggle
              label={t("toggles.hideCategoryLabels")}
              checked={s.yAxisHideLabels}
              onChange={(v) => update("yAxisHideLabels", v)}
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
            <Field label={t("fields.showValueAtBarEnd")}>
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
              <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                {t("hints.dataLabelsAuto")}
              </div>
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

          <Accordion label={t("sections.editorial")}>
            <Field label={t("fields.caption")}>
              <TextInput
                value={s.captionText}
                onChange={(v) => update("captionText", v)}
                placeholder={t("placeholders.captionBar")}
              />
            </Field>
            <Field label={t("fields.watermark")}>
              <TextInput
                value={s.watermarkText}
                onChange={(v) => update("watermarkText", v)}
                placeholder={t("placeholders.watermark")}
              />
            </Field>
            <Field label={t("fields.sourceLine")}>
              <TextInput
                value={s.sourceText}
                onChange={(v) => update("sourceText", v)}
                placeholder={t("placeholders.source")}
              />
            </Field>
          </Accordion>

          <Accordion label={t("sections.color")}>
            <Field label={t("fields.palette")}>
              <ColorPalette value={s.accentValue} onSelect={pickColor} />
            </Field>
            <Field label={t("fields.custom")}>
              <ColorCustomInput value={s.accentValue} onChange={pickColor} />
            </Field>
            {s.recentColors.length > 0 && (
              <Field label={t("fields.recent")}>
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
            <Field label={t("fields.pattern")}>
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
              <Field label={t("fields.patternStyle")}>
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
              checked={s.animationEnabled}
              onChange={(v) => update("animationEnabled", v)}
            />
            {s.animationEnabled && (
              <Field label={t("fields.duration")}>
                <NumberInput
                  value={s.animationDuration}
                  step={50}
                  onChange={(v) => update("animationDuration", Math.max(0, v))}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label={t("sections.forwardCompat")}>
            <Field label={t("fields.dataDescription")}>
              <TextInput
                value={s.dataDescription}
                onChange={(v) => update("dataDescription", v)}
                placeholder={t("placeholders.dataDescriptionBar")}
              />
            </Field>
            <Field label={t("fields.testId")}>
              <TextInput
                value={s.testId}
                onChange={(v) => update("testId", v)}
                placeholder={t("placeholders.testIdBar")}
              />
            </Field>
            <Toggle
              label={t("toggles.showJSON")}
              checked={s.showJSON}
              onChange={(v) => update("showJSON", v)}
            />
            {s.showJSON && (
              <div className="rounded-[2px] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
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

/* ─── Panel/section primitives ───────────────────────────────────────────
 *
 * Copied from column-chart-studio; extraction into shared studio primitives
 * is planned when a third studio arrives (Rule of Three).
 * ──────────────────────────────────────────────────────────────────────── */

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

/**
 * Light/dark toggle for the chart PREVIEW only — independent of the site
 * theme. Two explicit, always-visible states (aria-pressed) rather than a
 * blind cycler: the user can see which theme they're looking at.
 */
function PreviewThemeToggle({
  value,
  onChange,
}: {
  value: "light" | "dark";
  onChange: (t: "light" | "dark") => void;
}) {
  const t = useTranslations("studio");
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={t("aria.previewTheme")}
    >
      {(["light", "dark"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          aria-label={
            mode === "light" ? t("aria.previewLight") : t("aria.previewDark")
          }
          title={
            mode === "light" ? t("aria.previewLight") : t("aria.previewDark")
          }
          className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[2px] border transition-colors ${
            value === mode
              ? "border-brock-accent/70 bg-brock-accent/10 text-foreground"
              : "border-border bg-muted/40 text-muted-foreground hover:border-brock-accent/60 hover:text-foreground"
          }`}
        >
          {mode === "light" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              className="h-3 w-3"
              aria-hidden
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              className="h-3 w-3"
              aria-hidden
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      ))}
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
  const t = useTranslations("studio");
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
      aria-label={t("aria.color", { name: title })}
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
  const t = useTranslations("studio");
  const [text, setText] = useState(value);

  // Keep the text field in sync when accent changes from outside (palette click).
  if (
    text.toLowerCase() !== value.toLowerCase() &&
    document.activeElement?.tagName !== "INPUT"
  ) {
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
        aria-label={t("aria.pickCustomColor")}
        title={t("aria.colorPicker")}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        placeholder={t("placeholders.hex")}
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
