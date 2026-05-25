import { ColumnChart } from "@/components/charts/column-chart";
import { CopyButton } from "@/components/ui/copy-button";

const heroData = [
  3, 5, 12, 18, 9, 4, 2, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 5, 11, 14, 6, 3, 2, 1,
];
const heroLabels = [
  "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23",
];

const weeklyData = [142, 168, 187, 159, 203, 178, 215];
const weeklyLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

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
    type: "number[]",
    default: "—",
    description: "Array of values to render as bars",
  },
  {
    name: "labels",
    type: "string[]",
    default: "undefined",
    description:
      "X-axis labels (rendered in pixel font under bars + in hover tooltip)",
  },
  {
    name: "trend",
    type: "number",
    default: "undefined",
    description:
      "Decimal trend indicator e.g. 0.184 → +18.4%. Orange if positive.",
  },
  {
    name: "source",
    type: "string",
    default: "undefined",
    description: "Attribution line rendered below the chart (FT pattern)",
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
    description: "Gap between bars in pixels",
  },
  {
    name: "formatValue",
    type: "(v: number) => string",
    default: "toLocaleString",
    description: "Format function for hover tooltip value",
  },
  {
    name: "yAxisFormat",
    type: "(v: number) => string",
    default: "toLocaleString",
    description: "Format function for Y-axis tick labels",
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
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
    <div className="mx-auto max-w-4xl p-10">
      <div className="mb-12">
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

      <Section title="Preview · Weekly active users">
        <div className="border border-border bg-card p-8">
          <ColumnChart
            data={weeklyData}
            labels={weeklyLabels}
            height={220}
            trend={0.184}
            source="Brock Analytics, 2026"
          />
        </div>
      </Section>

      <Section title="Dense · Hourly activity (24h)">
        <div className="border border-border bg-card p-8">
          <ColumnChart
            data={heroData}
            labels={heroLabels}
            height={200}
            gap={2}
            source="Brock Analytics, hourly aggregation"
          />
        </div>
      </Section>

      <Section title="Empty state (ASCII)">
        <div className="border border-border bg-card p-8">
          <ColumnChart
            data={[]}
            height={200}
            source="Brock Analytics, 2026"
          />
        </div>
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
