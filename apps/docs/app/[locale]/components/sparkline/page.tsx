import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { RichText } from "@/lib/rich-text";
import { Sparkline } from "@/components/marks/sparkline";
import { CopyButton } from "@/components/ui/copy-button";
import { sparklineContent } from "./content";

const previewData = [
  4, 6, 5, 8, 11, 9, 13, 18, 22, 19, 17, 14, 16, 21, 25, 24, 21, 19, 22, 28, 32,
  29, 27, 30,
];
const inlineData = [2, 3, 5, 4, 6, 8, 7, 9, 11, 10, 12, 14];

const installCommand = "npx shadcn@latest add https://brockui.com/r/sparkline";

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

const propRows = [
  { name: "data", type: "number[]", default: "—" },
  { name: "width", type: "number", default: "280" },
  { name: "height", type: "number", default: "80" },
  { name: "gap", type: "number", default: "2" },
] as const;

export const metadata = {
  alternates: localeAlternates("/components/sparkline"),
};

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

export default async function SparklinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t =
    sparklineContent[
      hasLocale(routing.locales, locale)
        ? (locale as Locale)
        : routing.defaultLocale
    ];

  return (
    <div className="mx-auto max-w-4xl p-10">
      <div className="mb-12">
        <div className="mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {t.kicker}
        </div>
        <h1 className="mb-3 text-3xl font-normal tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <Section title={t.preview}>
        <div className="border border-border bg-card p-10">
          <Sparkline data={previewData} width={400} height={80} />
        </div>
      </Section>

      <Section title={t.inlineDemo.title}>
        <div className="border border-border bg-card p-10">
          <p className="text-sm text-foreground">
            {t.inlineDemo.before}
            <span className="inline-block align-middle">
              <Sparkline data={inlineData} width={48} height={14} gap={1} />
            </span>
            {t.inlineDemo.after}
          </p>
        </div>
      </Section>

      <Section title={t.installation}>
        <CodeBlock code={installCommand} />
      </Section>

      <Section title={t.usage}>
        <CodeBlock code={usageCode} />
      </Section>

      <Section title={t.inlineUsage}>
        <CodeBlock code={inlineUsageCode} />
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
              {propRows.map((p, i) => (
                <tr
                  key={p.name}
                  className={
                    i < propRows.length - 1 ? "border-b border-border" : ""
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

      <Section title={t.designPrinciple.title}>
        <p className="max-w-2xl text-sm text-muted-foreground">
          <RichText segments={t.designPrinciple.body} />
        </p>
      </Section>

      <Section title={t.inspiredBy.title}>
        <ul className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
          {t.inspiredBy.items.map((item, i) => (
            <li key={i}>· {item}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
