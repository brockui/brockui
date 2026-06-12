import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { RichText } from "@/lib/rich-text";
import { columnChartContent } from "./content";
import { ColumnChartExamples } from "@/components/charts/column-chart-examples";
import { ColumnChartStudio } from "@/components/playground/column-chart-studio";
import { CopyButton } from "@/components/ui/copy-button";

const installCommand =
  "npx shadcn@latest add https://brockui.com/r/column-chart";

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
};

const props: PropRow[] = [
  {
    name: "data",
    type: "number[] | DataPoint[]",
    default: "—"
  },
  {
    name: "sort",
    type: "'none' | 'asc' | 'desc'",
    default: "'none'"
  },
  {
    name: "topN",
    type: "number | { n, label?, pinned?, distinct? }",
    default: "undefined"
  },
  {
    name: "labels",
    type: "string[]",
    default: "undefined"
  },
  {
    name: "height",
    type: "number",
    default: "200"
  },
  {
    name: "gap",
    type: "number",
    default: "4"
  },
  {
    name: "accent",
    type: "string",
    default: "var(--brock-accent)"
  },
  {
    name: "barRadius",
    type: "number",
    default: "0"
  },
  {
    name: "header",
    type: "{ title?, subtitle? }",
    default: "undefined"
  },
  {
    name: "xAxis",
    type: "{ title?, hideTicks? }",
    default: "undefined"
  },
  {
    name: "yAxis",
    type: "{ title?, max?, hideTicks? }",
    default: "undefined"

  },
  {
    name: "numberFormat",
    type: "{ prefix?, suffix?, decimals?, locale?, notation?, style?, currency? }",
    default: "undefined"
  },
  {
    name: "dataLabels",
    type: "{ show?: boolean | 'auto', format? }",
    default: "{ show: 'auto' }"

  },
  {
    name: "pattern",
    type: "'solid' | 'hatched'",
    default: "'solid'"
  },
  {
    name: "hatchUntilIndex",
    type: "number",
    default: "undefined"
  },
  {
    name: "hatchFromIndex",
    type: "number",
    default: "undefined"
  },
  {
    name: "patternStyle",
    type: "'diagonal' | 'diagonal-reverse' | 'dots' | 'vertical' | 'horizontal'",
    default: "'diagonal'"
  },
  {
    name: "scroll",
    type: "'none' | 'auto'",
    default: "'none'"
  },
  {
    name: "minBarWidth",
    type: "number",
    default: "4"
  },
  {
    name: "bands",
    type: "{ from, to, label?, color? }[]",
    default: "undefined"
  },
  {
    name: "trend",
    type: "number",
    default: "undefined"
  },
  {
    name: "referenceLine",
    type: "{ value: number | { stat: 'mean' | 'median' }, label? }",
    default: "undefined"

  },
  {
    name: "source",
    type: "string",
    default: "undefined"
  },
  {
    name: "animation",
    type: "{ enabled?, duration? }",
    default: "{ enabled: true, duration: 400 }"
  },
  {
    name: "loading",
    type: "boolean",
    default: "false"
  },
  {
    name: "error",
    type: "Error | string | null",
    default: "null"
  },
  {
    name: "onRetry",
    type: "() => void",
    default: "undefined"
  },
  {
    name: "loadingLabel",
    type: "string",
    default: "'Loading…'"
  },
  {
    name: "errorLabel",
    type: "string",
    default: "'Error'"
  },
  {
    name: "retryLabel",
    type: "string",
    default: "'Retry'"
  },
  {
    name: "loadingFallback",
    type: "ReactNode",
    default: "undefined"
  },
  {
    name: "errorFallback",
    type: "ReactNode | (error: Error) => ReactNode",
    default: "undefined"
  },
  {
    name: "exportable",
    type: "boolean | { png?, svg?, csv?, copy? }",
    default: "false"
  },
  {
    name: "exportFileName",
    type: "string | (format) => string",
    default: "'chart'"
  },
  {
    name: "onExport",
    type: "(format, artifact) => void",
    default: "undefined"
  },
  {
    name: "ref",
    type: "Ref<ColumnChartHandle>",
    default: "—"
  },
  {
    name: "onBarClick",
    type: "(point, index, event) => void",
    default: "undefined"
  },
  {
    name: "onBarHover",
    type: "(point | null, index | null) => void",
    default: "undefined"
  },
  {
    name: "onBarFocus",
    type: "(point, index) => void",
    default: "undefined"
  },
  {
    name: "slots",
    type: "ColumnChartSlots",
    default: "{}"
  },
  {
    name: "caption",
    type: "string",
    default: "undefined"
  },
  {
    name: "watermark",
    type: "string",
    default: "undefined"
  },
  {
    name: "annotations",
    type: "ColumnChartAnnotation[]",
    default: "undefined"
  },
  {
    name: "chartType",
    type: "string",
    default: "'column'"
  },
  {
    name: "dataDescription",
    type: "string",
    default: "undefined"
  },
  {
    name: "data-testid",
    type: "string",
    default: "undefined"
  },
  {
    name: "description",
    type: "string",
    default: "auto-generated"
  },
  {
    name: "formatValue",
    type: "(value, datum?) => string",
    default: "toLocaleString()"
  },
  {
    name: "yAxisFormat",
    type: "(v: number) => string",
    default: "toLocaleString"
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

import { setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export const metadata = {
  alternates: localeAlternates("/components/column-chart"),
};

export default async function ColumnChartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t =
    columnChartContent[
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
        <ColumnChartStudio />
      </Section>

      <Section title={t.examples.title} wide>
        <p className="mb-6 max-w-2xl text-xs text-muted-foreground">
          {t.examples.lead}
        </p>
        <ColumnChartExamples />
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

          <div className="max-w-2xl">
            <div className="mb-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
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
