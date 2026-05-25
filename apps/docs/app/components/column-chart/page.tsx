import { ColumnChart } from "@/components/charts/column-chart";
import { CopyButton } from "@/components/ui/copy-button";

const heroData = [
  3, 5, 12, 18, 9, 4, 2, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 5, 11, 14, 6, 3, 2, 1,
];
const heroLabels = ["14:00", "19:00", "00:00", "05:00", "13:00"];

const installCommand = "npx shadcn@latest add brockui.com/r/column-chart";

const usageCode = `import { ColumnChart } from "@/components/charts/column-chart";

const data = [3, 5, 12, 18, 9, 4, 2, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 5, 11, 14, 6, 3, 2, 1];
const labels = ["14:00", "19:00", "00:00", "05:00", "13:00"];

export function Example() {
  return <ColumnChart data={data} labels={labels} height={200} />;
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
    description: "X-axis labels distributed across the chart width",
  },
  {
    name: "height",
    type: "number",
    default: "200",
    description: "Chart height in pixels",
  },
  {
    name: "gap",
    type: "number",
    default: "4",
    description: "Gap between bars in pixels",
  },
  {
    name: "className",
    type: "string",
    default: "undefined",
    description: "Additional Tailwind classes for the wrapper",
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
      <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
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
    <div className="p-10 max-w-4xl">
      <div className="mb-12">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Charts · Column Chart
        </div>
        <h1 className="text-3xl font-normal text-foreground tracking-tight mb-3">
          Column Chart
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Time-series bars for activity, volume, and counts. Minimal,
          monochrome, single accent color via{" "}
          <code className="font-mono text-foreground">--brock-accent</code>.
        </p>
      </div>

      <Section title="Preview">
        <div className="border border-border bg-card p-10">
          <ColumnChart data={heroData} labels={heroLabels} height={200} />
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
                <th className="text-left p-3 font-normal text-muted-foreground uppercase tracking-wider text-[10px]">
                  Name
                </th>
                <th className="text-left p-3 font-normal text-muted-foreground uppercase tracking-wider text-[10px]">
                  Type
                </th>
                <th className="text-left p-3 font-normal text-muted-foreground uppercase tracking-wider text-[10px]">
                  Default
                </th>
                <th className="text-left p-3 font-normal text-muted-foreground uppercase tracking-wider text-[10px]">
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
                  <td className="p-3 text-foreground font-sans text-sm">
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="When to use">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Use Column Chart for time-series activity where each bar represents a
          discrete bucket (hour, day, agent call). Best for showing volume,
          count, or activity rhythm at a glance.
        </p>
      </Section>

      <Section title="When not to use">
        <p className="text-sm text-muted-foreground max-w-2xl">
          For continuous trends use Line Chart. For tiny embedded charts inside
          metric cards use Sparkline. For categorical comparison without time
          order use a horizontal bar variant (coming soon).
        </p>
      </Section>

      <Section title="Design principle">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Data-ink discipline: one fill color, no axis lines, no gridlines, no
          legend by default. The bars are the data. Optional axis labels sit
          below in monospace muted text to anchor time without competing for
          attention.
        </p>
      </Section>

      <Section title="Inspired by">
        <ul className="text-sm text-muted-foreground space-y-1.5 max-w-2xl">
          <li>· Stripe annual letters — embedded volume bars</li>
          <li>· Linear insights — hourly activity rhythm</li>
          <li>· GitHub contribution graph — discrete temporal blocks</li>
        </ul>
      </Section>
    </div>
  );
}
