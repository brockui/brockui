export type ComponentStatus = "NEW" | "SOON";
export type ComponentCategory = "Get Started" | "Charts" | "Workflows";

export type ComponentItem = {
  id: string;
  name: string;
  category: ComponentCategory;
  status: ComponentStatus;
  href: string;
  description: string;
};

export const components: ComponentItem[] = [
  {
    id: "installation",
    name: "Installation",
    category: "Get Started",
    status: "NEW",
    href: "/installation",
    description: "Set up the registry, theme tokens, and accent color.",
  },

  {
    id: "column-chart",
    name: "Column Chart",
    category: "Charts",
    status: "NEW",
    href: "/components/column-chart",
    description: "Time-series vertical bars for activity, volume, and counts.",
  },
  {
    id: "bar-chart",
    name: "Bar Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/bar-chart",
    description: "Horizontal bars for ranked categorical comparisons.",
  },
  {
    id: "line-chart",
    name: "Line Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/line-chart",
    description: "Continuous trends and time-series flow.",
  },
  {
    id: "area-chart",
    name: "Area Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/area-chart",
    description: "Filled area for cumulative or volume metrics.",
  },
  {
    id: "stacked-bar-chart",
    name: "Stacked Bar Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/stacked-bar-chart",
    description: "Composition over categories — segments stacked per bar.",
  },
  {
    id: "pie-chart",
    name: "Pie Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/pie-chart",
    description: "Proportional slices for share-of-whole comparisons.",
  },
  {
    id: "donut-chart",
    name: "Donut Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/donut-chart",
    description: "Pie variant with a hollow center for a hero metric.",
  },
  {
    id: "histogram",
    name: "Histogram",
    category: "Charts",
    status: "SOON",
    href: "/components/histogram",
    description: "Frequency distribution across binned ranges.",
  },
  {
    id: "scatter-plot",
    name: "Scatter Plot",
    category: "Charts",
    status: "SOON",
    href: "/components/scatter-plot",
    description: "Point-cloud for correlation between two variables.",
  },
  {
    id: "heatmap",
    name: "Heatmap",
    category: "Charts",
    status: "SOON",
    href: "/components/heatmap",
    description: "Matrix of cells encoding intensity by color.",
  },
  {
    id: "funnel-chart",
    name: "Funnel Chart",
    category: "Charts",
    status: "SOON",
    href: "/components/funnel-chart",
    description: "Conversion funnel for pipeline and activation stages.",
  },
  {
    id: "metric-card",
    name: "Metric Card",
    category: "Charts",
    status: "SOON",
    href: "/components/metric-card",
    description: "KPI display with embedded sparkline.",
  },
  {
    id: "sparkline",
    name: "Sparkline",
    category: "Charts",
    status: "NEW",
    href: "/components/sparkline",
    description: "Word-sized chart for inline data context.",
  },

  {
    id: "agent-flow-visualizer",
    name: "Agent Flow Visualizer",
    category: "Workflows",
    status: "SOON",
    href: "/components/agent-flow-visualizer",
    description: "Node-based AI agent execution view.",
  },
  {
    id: "tool-call-inspector",
    name: "Tool Call Inspector",
    category: "Workflows",
    status: "SOON",
    href: "/components/tool-call-inspector",
    description: "Detailed tool calls with retries.",
  },
  {
    id: "streaming-tokens",
    name: "Streaming Tokens",
    category: "Workflows",
    status: "SOON",
    href: "/components/streaming-tokens",
    description: "Real-time token visualization.",
  },
];
