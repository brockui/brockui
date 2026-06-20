import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { RichText } from "@/lib/rich-text";
import { lineChartContent } from "./content";
import { LineChartStudio } from "@/components/playground/line-chart-studio";
import { CopyButton } from "@/components/ui/copy-button";

const installCommand = "npx shadcn@latest add https://brockui.com/r/line-chart";

const usageCode = `import { LineChart } from "@/components/charts/line-chart";

const data = [
  { name: "Revenue", data: [120, 138, 131, 159, 172, 188] },
  { name: "Costs", data: [98, 104, 109, 112, 118, 121] },
];
const labels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"];

export function Example() {
  return (
    <LineChart
      data={data}
      labels={labels}
      height={240}
      emphasisSeries="Revenue"
      source="Brock Analytics, 2026"
    />
  );
}

// Opinionated defaults — but every sub-component is yours to replace via the
// \`slots\` prop. The crosshair tooltip lists every series at the hovered x.
export function WithCustomTooltip() {
  return (
    <LineChart
      data={data}
      labels={labels}
      slots={{
        tooltip: ({ xLabel, points }) => (
          <div className="border-2 border-brock-accent p-2">
            <div className="font-mono text-[10px] uppercase">{xLabel}</div>
            {points.map((p) => (
              <div key={p.series} className="flex gap-2">
                <span style={{ color: p.color }}>{p.series}</span>
                <span className="font-mono tabular-nums">{p.formatted}</span>
              </div>
            ))}
          </div>
        ),
      }}
    />
  );
}`;

type PropRow = {
  name: string;
  type: string;
  default: string;
};

const props: PropRow[] = [
  {
    name: "data",
    type: "number[] | LineChartDataPoint[] | LineChartSeries[]",
    default: "—",
  },
  { name: "labels", type: "(string | number)[]", default: "undefined" },
  { name: "x", type: "(string | number)[]", default: "undefined" },
  { name: "height", type: "number", default: "200" },
  { name: "trend", type: "number", default: "undefined" },
  {
    name: "referenceLine",
    type: "{ value: number | { stat: 'mean' | 'median' }, label? }",
    default: "undefined",
  },
  { name: "source", type: "string", default: "undefined" },
  { name: "accent", type: "string", default: "var(--brock-accent)" },
  { name: "lineWidth", type: "number", default: "1.75" },
  { name: "curve", type: "'linear' | 'monotone'", default: "'linear'" },
  { name: "markers", type: "'auto' | 'always' | 'none'", default: "'auto'" },
  {
    name: "xScale",
    type: "'linear' | 'time' | 'point'",
    default: "inferred",
  },
  { name: "yScale", type: "'linear' | 'log'", default: "'linear'" },
  { name: "gridlines", type: "boolean", default: "true" },
  {
    name: "legend",
    type: "'none' | 'direct' | 'top'",
    default: "'direct' (multi)",
  },
  { name: "directLabels", type: "boolean", default: "legend === 'direct'" },
  { name: "directLabelValues", type: "boolean", default: "false" },
  { name: "emphasisSeries", type: "string", default: "undefined" },
  { name: "lastValueDot", type: "boolean", default: "false" },
  { name: "yBaselineZero", type: "boolean", default: "false" },
  { name: "description", type: "string", default: "auto-generated" },
  { name: "yAxisFormat", type: "(v: number) => string", default: "toLocaleString" },
  { name: "formatValue", type: "(v: number) => string", default: "toLocaleString" },
  { name: "className", type: "string", default: "undefined" },
  { name: "header", type: "{ title?, subtitle? }", default: "undefined" },
  {
    name: "xAxis",
    type: "{ title?, hideTicks?, ticks?, format? }",
    default: "undefined",
  },
  {
    name: "yAxis",
    type: "{ title?, min?, max?, hideTicks?, ticks? }",
    default: "undefined",
  },
  {
    name: "numberFormat",
    type: "{ prefix?, suffix?, decimals?, locale?, notation?, style?, currency? }",
    default: "undefined",
  },
  { name: "animation", type: "{ enabled?, duration? }", default: "{ enabled: true, duration: 600 }" },
  { name: "events", type: "LineChartEvent[]", default: "undefined" },
  { name: "bands", type: "LineChartBand[]", default: "undefined" },
  { name: "loading", type: "boolean", default: "false" },
  { name: "error", type: "Error | string | null", default: "null" },
  { name: "onRetry", type: "() => void", default: "undefined" },
  { name: "loadingLabel", type: "string", default: "'Loading…'" },
  { name: "errorLabel", type: "string", default: "'Error'" },
  { name: "retryLabel", type: "string", default: "'Retry'" },
  { name: "loadingFallback", type: "ReactNode", default: "undefined" },
  {
    name: "errorFallback",
    type: "ReactNode | (error: Error) => ReactNode",
    default: "undefined",
  },
  {
    name: "exportable",
    type: "boolean | { png?, svg?, csv?, copy? }",
    default: "false",
  },
  {
    name: "exportFileName",
    type: "string | (format) => string",
    default: "'chart'",
  },
  { name: "onExport", type: "(format, artifact) => void", default: "undefined" },
  { name: "ref", type: "Ref<LineChartHandle>", default: "—" },
  {
    name: "onPointClick",
    type: "(selection, event) => void",
    default: "undefined",
  },
  {
    name: "onPointHover",
    type: "(selection | null) => void",
    default: "undefined",
  },
  { name: "onPointFocus", type: "(selection) => void", default: "undefined" },
  { name: "slots", type: "LineChartSlots", default: "{}" },
  { name: "caption", type: "string", default: "undefined" },
  { name: "watermark", type: "string", default: "undefined" },
  { name: "chartType", type: "string", default: "'line'" },
  { name: "dataDescription", type: "string", default: "undefined" },
  { name: "data-testid", type: "string", default: "undefined" },
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
      <h2 className="mb-4 text-sm font-semibold text-foreground">
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
  alternates: localeAlternates("/components/line-chart"),
};

export default async function LineChartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t =
    lineChartContent[
      hasLocale(routing.locales, locale)
        ? (locale as Locale)
        : routing.defaultLocale
    ];

  return (
    <div className="mx-auto max-w-6xl p-10">
      <div className="mb-12 max-w-4xl">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {t.kicker}
        </div>
        <h1 className="mb-3 text-3xl font-normal tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <Section title={t.studio.title} wide>
        <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
          {t.studio.lead}
        </p>
        <LineChartStudio />
      </Section>

      <Section title={t.installation}>
        <CodeBlock code={installCommand} />
      </Section>

      <Section title={t.usage}>
        <CodeBlock code={usageCode} />
      </Section>

      <Section title={t.props.title}>
        <div className="border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-card/40">
                {[
                  t.table.name,
                  t.table.type,
                  t.table.default,
                  t.table.description,
                ].map((h) => (
                  <th
                    key={h}
                    className="p-3 text-left text-[11px] font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
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
                  <td className="p-3 font-mono text-foreground">{p.name}</td>
                  <td className="p-3 font-mono text-muted-foreground">{p.type}</td>
                  <td className="p-3 font-mono text-muted-foreground">{p.default}</td>
                  <td className="p-3 font-sans text-sm text-foreground">
                    {t.props.descriptions[p.name]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t.a11y.title}>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p className="max-w-2xl">
            <RichText segments={t.a11y.intro} />
          </p>

          {t.a11y.localeNote && (
            <p className="max-w-2xl border-s-2 border-brock-accent/40 bg-muted/30 px-3 py-2 text-sm">
              {t.a11y.localeNote}
            </p>
          )}

          <div className="max-w-2xl">
            <div className="mb-2 text-[13px] font-medium text-foreground">
              {t.a11y.keyboardTitle}
            </div>
            <table className="w-full text-xs">
              <tbody>
                {t.a11y.keyboard.map((row, i) => (
                  <tr
                    key={row.key}
                    className={
                      i < t.a11y.keyboard.length - 1
                        ? "border-b border-border"
                        : ""
                    }
                  >
                    <td className="py-2 pr-6 font-mono text-foreground">{row.key}</td>
                    <td className="py-2 font-sans text-sm">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="max-w-2xl">
            <div className="mb-2 text-[13px] font-medium text-foreground">
              {t.a11y.srTitle}
            </div>
            <ul className="space-y-1.5 text-sm">
              {t.a11y.srItems.map((item, i) => (
                <li key={i}>
                  · <RichText segments={item} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title={t.designMoves.title}>
        <ol className="max-w-2xl space-y-2 text-sm text-muted-foreground">
          {t.designMoves.items.map((item, i) => (
            <li key={i}>
              <span className="font-mono text-xs text-foreground">
                {i + 1}.
              </span>{" "}
              <RichText segments={item} />
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t.whenTo.title}>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t.whenTo.body}
        </p>
      </Section>

      <Section title={t.whenNot.title}>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t.whenNot.body}
        </p>
      </Section>

      <Section title={t.inspiredBy.title}>
        <ul className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
          {t.inspiredBy.items.map((item, i) => (
            <li key={i}>
              · <RichText segments={item} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
