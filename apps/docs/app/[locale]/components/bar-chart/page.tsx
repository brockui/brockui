import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { RichText } from "@/lib/rich-text";
import { BarChartStudio } from "@/components/playground/bar-chart-studio";
import { CopyButton } from "@/components/ui/copy-button";
import { barChartContent } from "./content";

const installCommand = "npx shadcn@latest add https://brockui.com/r/bar-chart";

const usageCode = `import { BarChart } from "@/components/charts/bar-chart";

const data = [
  { label: "DIRECT", value: 4120 },
  { label: "SEARCH", value: 3870 },
  { label: "SOCIAL", value: 1290 },
  { label: "EMAIL", value: 940 },
];

export function Example() {
  return (
    <BarChart
      data={data}
      sort="desc"
      source="Brock Analytics, 2026"
    />
  );
}

// Opinionated defaults — but every sub-component is yours to replace via the
// \`slots\` prop. The data is passed in; you control the rendering.
export function WithCustomTooltip() {
  return (
    <BarChart
      data={data}
      slots={{
        tooltip: ({ label, value }) => (
          <div className="border-2 border-brock-accent p-2">
            <span className="font-mono tabular-nums">{value}</span> · {label}
          </div>
        ),
      }}
    />
  );
}`;

/** Technical columns — never translated; descriptions live in content.ts. */
type PropRow = { name: string; type: string; default: string };

const props: PropRow[] = [
  { name: "data", type: "number[] | DataPoint[]", default: "—" },
  { name: "labels", type: "string[]", default: "undefined" },
  { name: "barThickness", type: "number", default: "24" },
  { name: "gap", type: "number", default: "8" },
  { name: "maxHeight", type: "number", default: "undefined" },
  { name: "labelWidth", type: "number", default: "96" },
  { name: "sort", type: "'none' | 'asc' | 'desc'", default: "'none'" },
  {
    name: "topN",
    type: "number | { n, label?, pinned?, distinct? }",
    default: "undefined",
  },
  {
    name: "referenceLine",
    type: "{ value: number | { stat: 'mean' | 'median' }, label? }",
    default: "undefined",
  },
  { name: "source", type: "string", default: "undefined" },
  { name: "accent", type: "string", default: "var(--brock-accent)" },
  { name: "barRadius", type: "number", default: "0" },
  { name: "header", type: "{ title?, subtitle? }", default: "undefined" },
  { name: "xAxis", type: "{ title?, max?, hideTicks? }", default: "undefined" },
  { name: "yAxis", type: "{ title?, hideLabels? }", default: "undefined" },
  {
    name: "numberFormat",
    type: "{ prefix?, suffix?, decimals?, locale?, notation?, style?, currency? }",
    default: "undefined",
  },
  {
    name: "dataLabels",
    type: "{ show?: boolean | 'auto', format? }",
    default: "{ show: 'auto' }",
  },
  { name: "pattern", type: "'solid' | 'hatched'", default: "'solid'" },
  {
    name: "patternStyle",
    type: "'diagonal' | 'diagonal-reverse' | 'dots' | 'vertical' | 'horizontal'",
    default: "'diagonal'",
  },
  { name: "scroll", type: "'none' | 'auto'", default: "'none'" },
  {
    name: "animation",
    type: "{ enabled?, duration? }",
    default: "{ enabled: true, duration: 400 }",
  },
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
  { name: "ref", type: "Ref<BarChartHandle>", default: "—" },
  { name: "onBarClick", type: "(point, index, event) => void", default: "undefined" },
  { name: "onBarHover", type: "(point | null, index | null) => void", default: "undefined" },
  { name: "onBarFocus", type: "(point, index) => void", default: "undefined" },
  { name: "slots", type: "BarChartSlots", default: "{}" },
  { name: "caption", type: "string", default: "undefined" },
  { name: "watermark", type: "string", default: "undefined" },
  { name: "chartType", type: "string", default: "'bar'" },
  { name: "dataDescription", type: "string", default: "undefined" },
  { name: "data-testid", type: "string", default: "undefined" },
  { name: "description", type: "string", default: "auto-generated" },
  { name: "formatValue", type: "(value, datum?) => string", default: "toLocaleString()" },
  { name: "xAxisFormat", type: "(v: number) => string", default: "toLocaleString" },
  { name: "className", type: "string", default: "undefined" },
];

export const metadata = {
  alternates: localeAlternates("/components/bar-chart"),
};

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

export default async function BarChartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t =
    barChartContent[
      hasLocale(routing.locales, locale)
        ? (locale as Locale)
        : routing.defaultLocale
    ];

  return (
    <div className="mx-auto max-w-6xl p-10">
      <div className="mb-12 max-w-4xl">
        <div className="mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
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
        <BarChartStudio />
      </Section>

      <Section title={t.installation}>
        <CodeBlock code={installCommand} />
      </Section>

      <Section title={t.usage}>
        <CodeBlock code={usageCode} />
      </Section>

      <Section title={t.props.title}>
        <div className="border border-border">
          <table className="w-full font-mono text-xs">
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
                    className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase"
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
                  <td className="p-3 text-foreground">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.type}</td>
                  <td className="p-3 text-muted-foreground">{p.default}</td>
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
            <div className="mb-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
              {t.a11y.keyboardTitle}
            </div>
            <table className="w-full font-mono text-xs">
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
                    <td className="py-2 pr-6 text-foreground">{row.key}</td>
                    <td className="py-2 font-sans text-sm">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
