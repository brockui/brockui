import { setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { Logo } from "@/components/chrome/logo";
import { HomeShowcase } from "@/components/home/home-showcase";
import { components } from "@/lib/components-catalog";

export const metadata = {
  alternates: localeAlternates("/"),
};

const COPY = {
  en: {
    lead: "Editable React components for charts and data: copy the code and paste it straight into your project. Built by Almas Kasymzhanov, a data journalist, analyst, developer, and entrepreneur, for the people who do that work too: journalists, frontend developers, and data-viz designers. The collection grows with the project, and every component is one he relies on in his own daily work.",
    components: "Components",
    componentsLead:
      "Open-source and installable through the shadcn registry. Open any card for its live studio, code, and docs.",
    soon: "Coming soon",
  },
  ru: {
    lead: "Редактируемые React-компоненты для графиков и данных: забирайте код и вставляйте прямо в свой проект. Их делает Алмас Касымжанов, дата-журналист, аналитик, разработчик и предприниматель, для тех, кто работает так же: журналистов, фронтенд-разработчиков и визуализаторов данных. Набор пополняется по мере развития проекта, и каждый компонент он использует в своей повседневной работе.",
    components: "Компоненты",
    componentsLead:
      "Открытый код, установка через shadcn-реестр. Откройте карточку, чтобы увидеть живую студию, код и документацию.",
    soon: "Скоро",
  },
} as const;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = COPY[locale === "ru" ? "ru" : "en"];
  const soon = components.filter(
    (x) => x.category === "Charts" && x.status === "SOON",
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      {/* ── Hero: wordmark + who-and-why ───────────────────────────── */}
      <section className="max-w-2xl">
        <h1 className="sr-only">Brock UI</h1>
        <Logo variant="lockup" className="h-7 w-auto text-foreground" />
        <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
          {c.lead}
        </p>
      </section>

      {/* ── Components ─────────────────────────────────────────────── */}
      <section className="mt-14 lg:mt-20">
        <h2 className="text-sm font-semibold text-foreground">{c.components}</h2>
        <p className="mt-1.5 mb-5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {c.componentsLead}
        </p>

        <HomeShowcase locale={locale} />

        {soon.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-3 text-[11px] font-medium text-muted-foreground">
              {c.soon}
            </h3>
            <div className="flex flex-wrap gap-2">
              {soon.map((x) => (
                <span
                  key={x.id}
                  className="rounded-md border border-dashed border-border px-2.5 py-1 font-sans text-xs text-muted-foreground/70"
                >
                  {x.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
