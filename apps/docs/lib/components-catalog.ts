export type ComponentStatus = "NEW" | "SOON";
export type ComponentCategory = "Get Started" | "Charts" | "Workflows";

export type ComponentItem = {
  id: string;
  name: string;
  category: ComponentCategory;
  status: ComponentStatus;
  href: string;
  /** Per-locale description — names stay English (technical identifiers). */
  description: { en: string; ru: string };
};

export const components: ComponentItem[] = [
  {
    id: "installation",
    name: "Installation",
    category: "Get Started",
    status: "NEW",
    href: "/installation",
    description: {
      en: "Set up the registry, theme tokens, and accent color.",
      ru: "Подключение registry, токены темы и акцентный цвет.",
    },
  },

  {
    id: "column-chart",
    name: "Column Chart",
    category: "Charts",
    status: "NEW",
    href: "/components/column-chart",
    description: {
      en: "Time-series vertical bars for activity, volume, and counts.",
      ru: "Вертикальные столбцы для упорядоченных категорий — время и рейтинги.",
    },
  },
  {
    id: "bar-chart",
    name: "Bar Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/bar-chart",
    description: {
      en: "Horizontal bars for ranked categorical comparisons.",
      ru: "Горизонтальные полосы для ранжированных категорий.",
    },
  },
  {
    id: "line-chart",
    name: "Line Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/line-chart",
    description: {
      en: "Continuous trends and time-series flow.",
      ru: "Непрерывные тренды и временные ряды.",
    },
  },
  {
    id: "area-chart",
    name: "Area Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/area-chart",
    description: {
      en: "Filled area for cumulative or volume metrics.",
      ru: "Заливка площади для накопительных и объёмных метрик.",
    },
  },
  {
    id: "stacked-bar-chart",
    name: "Stacked Bar Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/stacked-bar-chart",
    description: {
      en: "Composition over categories — segments stacked per bar.",
      ru: "Состав по категориям — сегменты в одном столбце.",
    },
  },
  {
    id: "pie-chart",
    name: "Pie Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/pie-chart",
    description: {
      en: "Proportional slices for share-of-whole comparisons.",
      ru: "Доли целого — пропорциональные сектора.",
    },
  },
  {
    id: "donut-chart",
    name: "Donut Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/donut-chart",
    description: {
      en: "Pie variant with a hollow center for a hero metric.",
      ru: "Кольцевая диаграмма с местом под главную метрику.",
    },
  },
  {
    id: "histogram",
    name: "Histogram",
    category: "Charts",
    status: "SOON",
    href: "/components/histogram",
    description: {
      en: "Frequency distribution across binned ranges.",
      ru: "Распределение частот по интервалам.",
    },
  },
  {
    id: "scatter-plot",
    name: "Scatter Plot",
    category: "Charts",
    status: "SOON",
    href: "/components/scatter-plot",
    description: {
      en: "Point-cloud for correlation between two variables.",
      ru: "Облако точек — корреляция двух переменных.",
    },
  },
  {
    id: "heatmap",
    name: "Heatmap",
    category: "Charts",
    status: "SOON",
    href: "/components/heatmap",
    description: {
      en: "Matrix of cells encoding intensity by color.",
      ru: "Матрица ячеек — интенсивность цветом.",
    },
  },
  {
    id: "funnel-chart",
    name: "Funnel Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/funnel-chart",
    description: {
      en: "Conversion funnel for pipeline and activation stages.",
      ru: "Воронка конверсии для пайплайна и активации.",
    },
  },
  {
    id: "metric-card",
    name: "Metric Card",
    category: "Charts",
    status: "SOON",
    href: "/components/metric-card",
    description: {
      en: "KPI display with embedded sparkline.",
      ru: "KPI-карточка со встроенным спарклайном.",
    },
  },
  {
    id: "sparkline",
    name: "Sparkline",
    category: "Charts",
    status: "NEW",
    href: "/components/sparkline",
    description: {
      en: "Word-sized chart for inline data context.",
      ru: "График размером со слово — данные прямо в тексте.",
    },
  },

  {
    id: "agent-flow-visualizer",
    name: "Agent Flow Visualizer",
    category: "Workflows",
    status: "SOON",
    href: "/components/agent-flow-visualizer",
    description: {
      en: "Node-based AI agent execution view.",
      ru: "Граф исполнения AI-агента на нодах.",
    },
  },
  {
    id: "tool-call-inspector",
    name: "Tool Call Inspector",
    category: "Workflows",
    status: "SOON",
    href: "/components/tool-call-inspector",
    description: {
      en: "Detailed tool calls with retries.",
      ru: "Детальный просмотр tool-вызовов с ретраями.",
    },
  },
  {
    id: "streaming-tokens",
    name: "Streaming Tokens",
    category: "Workflows",
    status: "SOON",
    href: "/components/streaming-tokens",
    description: {
      en: "Real-time token visualization.",
      ru: "Визуализация токенов в реальном времени.",
    },
  },
];
