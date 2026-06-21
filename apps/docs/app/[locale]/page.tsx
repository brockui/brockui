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
    lead: "Brock UI is an open registry of opinionated React components for charts and data — built by Almas Kasymzhanov: a graphics-studio designer, data journalist, and analyst-entrepreneur. New tools land here as they ship, and every chart is one he reaches for in his own work.",
    components: "Components",
    componentsLead:
      "Open-source and installable through the shadcn registry. Open any card for its live studio, code, and docs.",
    soon: "Coming soon",
  },
  ru: {
    lead: "Brock UI — открытый реестр выразительных React-компонентов для графиков и данных. Его собирает Алмас Касымжанов: дизайнер графической студии, дата-журналист и аналитик-предприниматель. Сюда добавляются новые инструменты по мере выхода, и каждый график он использует в собственной работе.",
    components: "Компоненты",
    componentsLead:
      "Открытый код, установка через shadcn-реестр. Откройте карточку — живая студия, код и документация.",
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
      {/* ── Hero: logo + who-and-why ───────────────────────────────── */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Logo
          variant="mark"
          className="h-14 w-auto shrink-0 text-foreground"
        />
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Brock UI
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {c.lead}
          </p>
        </div>
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
