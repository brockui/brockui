import { Sparkline } from "@/components/marks/sparkline";
import { CopyButton } from "@/components/ui/copy-button";

const previewData = [
  4, 6, 5, 8, 11, 9, 13, 18, 22, 19, 17, 14, 16, 21, 25, 24, 21, 19, 22, 28, 32,
  29, 27, 30,
];
const inlineData = [2, 3, 5, 4, 6, 8, 7, 9, 11, 10, 12, 14];

const installCommand = "npx shadcn@latest add brockui.com/r/sparkline";

const usageCode = `import { Sparkline } from "@/components/marks/sparkline";

const data = [4, 6, 5, 8, 11, 9, 13, 18, 22, 19, 17, 14];

export function Example() {
  return <Sparkline data={data} width={280} height={80} />;
}`;

const inlineUsageCode = `<p className="text-sm">
  Daily signups trended up{" "}
  <Sparkline data={data} width={48} height={14} gap={1} />
  {" "}over the last 12 days.
</p>`;

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
    name: "width",
    type: "number",
    default: "280",
    description: "Chart width in pixels",
  },
  {
    name: "height",
    type: "number",
    default: "80",
    description: "Chart height in pixels",
  },
  {
    name: "gap",
    type: "number",
    default: "2",
    description: "Gap between bars in pixels",
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

import { setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export const metadata = {
  alternates: localeAlternates("/components/sparkline"),
};

export default async function SparklinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl p-10">
      <div className="mb-12">
        <div className="mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          Charts · Sparkline
        </div>
        <h1 className="mb-3 text-3xl font-normal tracking-tight text-foreground">
          Sparkline
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Word-sized chart for inline data context. Tufte canon — &ldquo;data at
          the point where it is read.&rdquo; Designed to live inside paragraphs,
          metric cards, and table cells.
        </p>
      </div>

      <Section title="Preview">
        <div className="border border-border bg-card p-10">
          <Sparkline data={previewData} width={400} height={80} />
        </div>
      </Section>

      <Section title="Inline (Tufte pattern)">
        <div className="border border-border bg-card p-10">
          <p className="text-sm text-foreground">
            Daily signups have trended up{" "}
            <span className="inline-block align-middle">
              <Sparkline data={inlineData} width={48} height={14} gap={1} />
            </span>{" "}
            over the last 12 days. The chart sits at word-scale, not as a
            separate figure.
          </p>
        </div>
      </Section>

      <Section title="Installation">
        <CodeBlock code={installCommand} />
      </Section>

      <Section title="Usage">
        <CodeBlock code={usageCode} />
      </Section>

      <Section title="Inline usage">
        <CodeBlock code={inlineUsageCode} />
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

      <Section title="When to use">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Inside metric cards, table cells, paragraphs of prose, or anywhere a
          trend is secondary context — not the main figure. Word-sized so it
          doesn&rsquo;t demand attention; embedded so it provides instant
          context without forcing a glance away.
        </p>
      </Section>

      <Section title="When not to use">
        <p className="max-w-2xl text-sm text-muted-foreground">
          For standalone charts with axes and tooltips use Bar Chart or Line
          Chart. Sparklines have no axis, no labels, no legend — only the shape
          of the trend. If readers need exact values, pair the sparkline with a
          number next to it.
        </p>
      </Section>

      <Section title="Design principle">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Word-sized graphics (Tufte). Same accent color as everywhere else via{" "}
          <code className="font-mono text-foreground">--brock-accent</code>. No
          axes, no annotations — the bars are the data. The component renders
          as inline SVG so it sits inside flowing text without breaking line
          height.
        </p>
      </Section>

      <Section title="Inspired by">
        <ul className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
          <li>· Edward Tufte — &ldquo;word-sized graphics&rdquo;</li>
          <li>· Stripe annual letters — embedded trend bars in prose</li>
          <li>
            · Financial Times graphics — inline charts alongside narrative
          </li>
        </ul>
      </Section>
    </div>
  );
}
