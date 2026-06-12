import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { RichText } from "@/lib/rich-text";
import { CopyButton } from "@/components/ui/copy-button";
import { installationContent } from "./content";

const quickStart = "npx shadcn@latest add https://brockui.com/r/column-chart";

const themeVariables = `:root {
  --brock-accent: oklch(0.646 0.222 41.116); /* #F54900 — Orange */
}

.dark {
  --brock-accent: oklch(0.646 0.222 41.116);
}`;

const themeInline = `@theme inline {
  --color-brock-accent: var(--brock-accent);
}`;

export const metadata = {
  alternates: localeAlternates("/installation"),
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

export default async function InstallationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t =
    installationContent[
      hasLocale(routing.locales, locale)
        ? (locale as Locale)
        : routing.defaultLocale
    ];

  return (
    <div className="mx-auto max-w-3xl p-10">
      <div className="mb-12">
        <div className="mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {t.kicker}
        </div>
        <h1 className="mb-3 text-3xl font-normal tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <Section title={t.quickStart.title}>
        <p className="mb-4 text-sm text-muted-foreground">
          {t.quickStart.lead}
        </p>
        <CodeBlock code={quickStart} />
      </Section>

      <Section title={t.prerequisites.title}>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {t.prerequisites.items.map((item, i) => (
            <li key={i}>
              · <RichText segments={item} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.themeSetup.title}>
        <p className="mb-4 text-sm text-muted-foreground">
          <RichText segments={t.themeSetup.lead} />
        </p>
        <CodeBlock code={themeVariables} />
      </Section>

      <Section title={t.tailwindToken.title}>
        <p className="mb-4 text-sm text-muted-foreground">
          <RichText segments={t.tailwindToken.lead} />
        </p>
        <CodeBlock code={themeInline} />
      </Section>

      <Section title={t.customizeAccent.title}>
        <p className="max-w-2xl text-sm text-muted-foreground">
          <RichText segments={t.customizeAccent.body} />
        </p>
      </Section>

      <Section title={t.whatYouGet.title}>
        <ul className="max-w-2xl space-y-2 text-sm text-muted-foreground">
          {t.whatYouGet.items.map((item, i) => (
            <li key={i}>
              · <span className="text-foreground">{item.strong}</span>
              {item.rest}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
