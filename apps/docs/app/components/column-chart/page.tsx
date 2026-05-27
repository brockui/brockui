import { ColumnChartStudio } from "@/components/playground/column-chart-studio";
import { CopyButton } from "@/components/ui/copy-button";

const installCommand = "npx shadcn@latest add brockui.com/r/column-chart";

const usageCode = `import { ColumnChart } from "@/components/charts/column-chart";

const data = [142, 168, 187, 159, 203, 178, 215];
const labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function Example() {
  return (
    <ColumnChart
      data={data}
      labels={labels}
      height={220}
      trend={0.184}
      source="Brock Analytics, 2026"
    />
  );
}`;

type PropRow = {
  name: string;
  type: string;
  default: string;
  description: string;
};

const props: PropRow[] = [
  {
    name: "data",
    type: "number[] | DataPoint[]",
    default: "—",
    description:
      "Bar values. Two forms: number[] (with labels prop) or { label?, value }[] (object form for DataFrame mapping)",
  },
  {
    name: "labels",
    type: "string[]",
    default: "undefined",
    description:
      "X-axis labels (rendered in pixel font under bars + in hover tooltip). Only used when data is number[]",
  },
  {
    name: "height",
    type: "number",
    default: "200",
    description: "Chart height in pixels (Y-axis + bars area)",
  },
  {
    name: "gap",
    type: "number",
    default: "4",
    description:
      "Gap between bars in pixels. Auto-shrinks for dense datasets (60+ bars)",
  },
  {
    name: "accent",
    type: "string",
    default: "var(--brock-accent)",
    description:
      "Override the bar fill color (any CSS color or var). Defaults to Brock orange",
  },
  {
    name: "barRadius",
    type: "number",
    default: "0",
    description:
      "Top-corner radius in px. Common values: 0 (sharp), 2 (subtle), 6 (rounded)",
  },
  {
    name: "header",
    type: "{ title?, subtitle? }",
    default: "undefined",
    description: "Title + subtitle block above the chart",
  },
  {
    name: "xAxis",
    type: "{ title?, hideTicks? }",
    default: "undefined",
    description: "X-axis configuration (title below ticks, hide tick labels)",
  },
  {
    name: "yAxis",
    type: "{ title?, min?, max?, hideTicks? }",
    default: "undefined",
    description:
      "Y-axis configuration (vertical title, custom min/max, hide tick labels)",
  },
  {
    name: "numberFormat",
    type: "{ prefix?, suffix?, decimals? }",
    default: "undefined",
    description:
      "Number formatter applied to Y-axis, tooltip, and data labels (e.g. $1,250k). Explicit formatValue/yAxisFormat win over this",
  },
  {
    name: "dataLabels",
    type: "{ show?, format? }",
    default: "undefined",
    description:
      "Show value above each bar (Hack mono). Optional per-label formatter overrides numberFormat",
  },
  {
    name: "pattern",
    type: "'solid' | 'hatched'",
    default: "'solid'",
    description:
      "Default fill pattern for all bars. Per-point pattern on a data point wins over this. Hatched encodes historical/estimated/in-progress without spending a second color (Tufte)",
  },
  {
    name: "hatchUntilIndex",
    type: "number",
    default: "undefined",
    description:
      "Convenience: bars with index < N render hatched, the rest render solid. Classic historical-vs-projected encoding",
  },
  {
    name: "hatchFromIndex",
    type: "number",
    default: "undefined",
    description:
      "Mirror of hatchUntilIndex: bars with index >= N render hatched. Useful for forecast bands and 'last N hatched' patterns. Combinable with hatchUntilIndex (union)",
  },
  {
    name: "patternStyle",
    type: "'diagonal' | 'diagonal-reverse' | 'dots' | 'vertical' | 'horizontal'",
    default: "'diagonal'",
    description:
      "Visual style of hatched bars (chart-level). Per-bar pattern still controls whether a bar is hatched; this controls how each hatched bar looks. Use 'dots' for grayscale/print",
  },
  {
    name: "scroll",
    type: "'none' | 'auto'",
    default: "'none'",
    description:
      "Overflow behavior when bars don't fit. 'auto' enables horizontal scroll; Y-axis pins to the left while bars + X-axis scroll together",
  },
  {
    name: "minBarWidth",
    type: "number",
    default: "4",
    description:
      "Minimum px per bar. Used with scroll='auto' to decide chart min-width: N*minBarWidth + (N-1)*gap. Ignored when scroll='none'",
  },
  {
    name: "trend",
    type: "number",
    default: "undefined",
    description:
      "Decimal trend indicator e.g. 0.184 → ↗ +18.4%. Orange if positive, muted if negative",
  },
  {
    name: "goal",
    type: "{ value, label? }",
    default: "undefined",
    description:
      "Dashed reference line at value. Goal is included in max scale so it stays visible above bars. KPI dashboard pattern",
  },
  {
    name: "source",
    type: "string",
    default: "undefined",
    description: "Attribution line rendered below the chart (FT pattern)",
  },
  {
    name: "animation",
    type: "{ enabled?, duration? }",
    default: "{ enabled: true, duration: 400 }",
    description:
      "Staggered bar-rise on mount. Disabled automatically when prefers-reduced-motion is set",
  },
  {
    name: "description",
    type: "string",
    default: "auto-generated",
    description:
      "Accessible description for screen readers (figcaption + table caption). Defaults to 'Column chart with N data points. Source: ...'",
  },
  {
    name: "formatValue",
    type: "(v: number) => string",
    default: "toLocaleString",
    description:
      "Format function for hover tooltip value. Wins over numberFormat",
  },
  {
    name: "yAxisFormat",
    type: "(v: number) => string",
    default: "toLocaleString",
    description:
      "Format function for Y-axis tick labels. Wins over numberFormat",
  },
];

function Section({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`mb-12 ${wide ? "" : "max-w-4xl"}`}>
      <h2 className="mb-4 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative border border-border bg-card">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export default function ColumnChartPage() {
  return (
    <div className="mx-auto max-w-6xl p-10">
      <div className="mb-12 max-w-4xl">
        <div className="mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          Charts · Column Chart
        </div>
        <h1 className="mb-3 text-3xl font-normal tracking-tight text-foreground">
          Column Chart
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Time-series vertical bars for activity, volume, and counts. Data-ink
          discipline (Tufte) — one accent, no gridlines, monospace numerics.
          Built-in source attribution and ASCII empty state.
        </p>
      </div>

      <Section title="Studio · Code, chart, settings" wide>
        <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
          Three-panel workbench. Tweak any setting on the right — chart in the
          middle updates live and the code on the left regenerates ready to
          paste into your app.
        </p>
        <ColumnChartStudio />
      </Section>

      <Section title="Installation">
        <CodeBlock code={installCommand} />
      </Section>

      <Section title="Usage">
        <CodeBlock code={usageCode} />
      </Section>

      <Section title="Props">
        <div className="border border-border">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-border bg-card/40">
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Name
                </th>
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Type
                </th>
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Default
                </th>
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {props.map((p, i) => (
                <tr
                  key={p.name}
                  className={
                    i < props.length - 1 ? "border-b border-border" : ""
                  }
                >
                  <td className="p-3 text-foreground">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.type}</td>
                  <td className="p-3 text-muted-foreground">{p.default}</td>
                  <td className="p-3 font-sans text-sm text-foreground">
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Accessibility">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p className="max-w-2xl">
            WCAG AA compliant. Keyboard navigable, screen-reader friendly,
            honors{" "}
            <code className="font-mono text-xs text-foreground">
              prefers-reduced-motion
            </code>
            .
          </p>

          <div className="max-w-2xl">
            <div className="mb-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
              Keyboard
            </div>
            <table className="w-full font-mono text-xs">
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 pr-6 text-foreground">Tab</td>
                  <td className="py-2 font-sans text-sm">
                    Move focus into the chart (single tab stop)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-6 text-foreground">
                    ← → ↑ ↓
                  </td>
                  <td className="py-2 font-sans text-sm">
                    Navigate between bars (roving tabindex)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-6 text-foreground">Home</td>
                  <td className="py-2 font-sans text-sm">
                    Jump to first bar
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-6 text-foreground">End</td>
                  <td className="py-2 font-sans text-sm">Jump to last bar</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="max-w-2xl">
            <div className="mb-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
              Screen reader markup
            </div>
            <ul className="space-y-1.5 text-sm">
              <li>
                ·{" "}
                <code className="font-mono text-xs text-foreground">
                  &lt;figure role=&quot;figure&quot;&gt;
                </code>{" "}
                wraps the chart with an
                <code className="ml-1 font-mono text-xs text-foreground">
                  aria-labelledby
                </code>{" "}
                pointing to the figcaption
              </li>
              <li>
                · Each bar uses{" "}
                <code className="font-mono text-xs text-foreground">
                  role=&quot;graphics-symbol&quot;
                </code>{" "}
                with
                <code className="ml-1 font-mono text-xs text-foreground">
                  aria-label=&quot;LABEL: value&quot;
                </code>
              </li>
              <li>
                · A visually-hidden{" "}
                <code className="font-mono text-xs text-foreground">
                  &lt;table class=&quot;sr-only&quot;&gt;
                </code>{" "}
                provides a tabular data summary (caption + rows for each
                data point)
              </li>
              <li>
                · Trend indicator gets human-readable label (
                <em>&ldquo;Trend up 18.4 percent&rdquo;</em>) — arrows are
                aria-hidden
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Design moves">
        <ol className="max-w-2xl space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-mono text-xs text-foreground">1.</span>{" "}
            Monospace Y-axis numbers + tabular-nums (Hack font) — values align
            by digit width.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">2.</span> Single
            <code className="mx-1 font-mono text-xs text-foreground">
              --brock-accent
            </code>
            (orange) for all bars. No gradient, no glow, no per-bar color
            coding.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">3.</span> No
            gridlines. Single 1px baseline at zero (Tufte data-ink).
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">4.</span>{" "}
            Hover-tooltip with value in Hack mono + period in Departure Mono
            pixel-font badge.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">5.</span>{" "}
            Staggered entry animation (30ms cascade, scale-Y from baseline).
            Disabled on
            <code className="mx-1 font-mono text-xs text-foreground">
              prefers-reduced-motion
            </code>
            .
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">6.</span>{" "}
            Built-in
            <code className="mx-1 font-mono text-xs text-foreground">
              source
            </code>
            prop renders FT/Bloomberg-style attribution line below the chart.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">7.</span> ASCII
            empty state (
            <code className="mx-1 font-pixel text-xs tracking-wider">
              ▒▒▒ no data
            </code>
            ) when the dataset is empty — no separate
            <code className="mx-1 font-mono text-xs text-foreground">
              isLoading
            </code>
            prop needed.
          </li>
        </ol>
      </Section>

      <Section title="When to use">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Column Chart fits time-series data where each bar is a discrete
          temporal bucket — hours, days, weeks, monthly buckets, agent calls
          per minute. Best for showing volume, count, or activity rhythm at a
          glance with sparse axes that don&rsquo;t compete with the data.
        </p>
      </Section>

      <Section title="When not to use">
        <p className="max-w-2xl text-sm text-muted-foreground">
          For continuous trends use Line Chart. For tiny embedded charts inside
          metric cards or prose use Sparkline. For categorical ranking with
          long labels (horizontal bars) use Bar Chart (coming soon). For
          composition over time use Stacked Column Chart (coming soon).
        </p>
      </Section>

      <Section title="Inspired by">
        <ul className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
          <li>
            · Financial Times Visual Journalism — sparse axes, source-line
            attribution, single-color bars
          </li>
          <li>· Stripe Annual Letters — inline numerics in editorial flow</li>
          <li>· The Pudding — interactive storytelling with restraint</li>
          <li>
            · Edward Tufte, <em>The Visual Display of Quantitative Information</em>{" "}
            — data-ink discipline
          </li>
        </ul>
      </Section>
    </div>
  );
}
