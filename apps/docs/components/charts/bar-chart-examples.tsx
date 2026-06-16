"use client";

import { useLocale } from "next-intl";
import { BarChart } from "@/components/charts/bar-chart";

/**
 * Examples gallery — curated configurations covering the Bar Chart prop
 * surface. Client island (some cards wire event handlers) so the docs page
 * stays an RSC. Card copy is bilingual via props from the page dictionary.
 *
 * Demo data is locale-aware: on /ru the category labels, reference-line names
 * and number formatting render in Russian — Cyrillic in the label column is a
 * feature demo, not an accident. Numeric values are shared; only display
 * strings (and the numberFormat locale pin) fork.
 */
type ExamplesLocale = "en" | "ru";

const channelValues = [4120, 3870, 1290, 940, 610, 380, 210];
const regionValues = [48, 36, 21, 14, 9];
const pnlValues = [42, 18, -12, -28, 31];
const longValues = [184, 142, 95, 61, 38];

const STRINGS: Record<
  ExamplesLocale,
  {
    channelLabels: string[];
    regionLabels: string[];
    pnlLabels: string[];
    longLabels: string[];
    planLabel: string;
    otherLabel: string;
    numberLocale: string;
  }
> = {
  en: {
    channelLabels: [
      "DIRECT",
      "SEARCH",
      "SOCIAL",
      "EMAIL",
      "REFERRAL",
      "AFFILIATE",
      "DISPLAY",
    ],
    regionLabels: ["ALMATY", "ASTANA", "SHYMKENT", "KARAGANDA", "AKTOBE"],
    pnlLabels: [
      "PRODUCT A",
      "PRODUCT B",
      "PRODUCT C",
      "PRODUCT D",
      "PRODUCT E",
    ],
    longLabels: [
      "Enterprise & strategic accounts",
      "Mid-market subscriptions",
      "Self-serve monthly plans",
      "Marketplace revenue share",
      "Professional services",
    ],
    planLabel: "Plan",
    otherLabel: "OTHER",
    numberLocale: "en-US",
  },
  ru: {
    channelLabels: [
      "ПРЯМОЙ",
      "ПОИСК",
      "СОЦСЕТИ",
      "EMAIL",
      "РЕФЕРАЛЫ",
      "ПАРТНЁРЫ",
      "БАННЕРЫ",
    ],
    regionLabels: ["АЛМАТЫ", "АСТАНА", "ШЫМКЕНТ", "КАРАГАНДА", "АКТОБЕ"],
    pnlLabels: [
      "ПРОДУКТ А",
      "ПРОДУКТ Б",
      "ПРОДУКТ В",
      "ПРОДУКТ Г",
      "ПРОДУКТ Д",
    ],
    longLabels: [
      "Корпоративные и стратегические клиенты",
      "Подписки среднего бизнеса",
      "Самообслуживание, месячные планы",
      "Доля выручки маркетплейса",
      "Профессиональные услуги",
    ],
    planLabel: "План",
    otherLabel: "ПРОЧЕЕ",
    numberLocale: "ru-RU",
  },
};

function zip(labels: string[], values: number[]) {
  return labels.map((label, i) => ({ label, value: values[i] }));
}

export type BarExampleCardCopy = { title: string; subtitle: string };

export type BarChartExamplesCopy = {
  ranking: BarExampleCardCopy;
  topN: BarExampleCardCopy;
  negatives: BarExampleCardCopy;
  reference: BarExampleCardCopy;
  longLabels: BarExampleCardCopy;
  states: BarExampleCardCopy;
};

function ExampleCard({
  title,
  subtitle,
  children,
}: BarExampleCardCopy & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col border border-border bg-card p-5">
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
          {subtitle}
        </div>
        <div className="mt-0.5 text-sm font-medium text-foreground">
          {title}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function BarChartExamples({ copy }: { copy: BarChartExamplesCopy }) {
  const locale: ExamplesLocale = useLocale() === "ru" ? "ru" : "en";
  const d = STRINGS[locale];

  const channels = zip(d.channelLabels, channelValues);
  const regions = zip(d.regionLabels, regionValues);
  const pnl = zip(d.pnlLabels, pnlValues);
  const longLabels = zip(d.longLabels, longValues);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ExampleCard {...copy.ranking}>
        <BarChart
          data={regions}
          sort="desc"
          source="Brock Analytics — stores by city, 2026"
        />
      </ExampleCard>

      <ExampleCard {...copy.topN}>
        <BarChart
          data={channels}
          sort="desc"
          topN={{ n: 4, label: d.otherLabel }}
          numberFormat={{ notation: "compact", locale: d.numberLocale }}
          source="Brock Analytics — traffic by channel"
        />
      </ExampleCard>

      <ExampleCard {...copy.negatives}>
        <BarChart
          data={pnl}
          sort="desc"
          referenceLine={{ value: { stat: "mean" } }}
          numberFormat={{ prefix: "$", suffix: "k", locale: d.numberLocale }}
          source="Brock Analytics — contribution by product"
        />
      </ExampleCard>

      <ExampleCard {...copy.reference}>
        <BarChart
          data={regions}
          referenceLine={{ value: 30, label: d.planLabel }}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>

      <ExampleCard {...copy.longLabels}>
        <BarChart
          data={longLabels}
          labelWidth={170}
          numberFormat={{ prefix: "$", suffix: "k", locale: d.numberLocale }}
          source="Brock Analytics — revenue by line"
        />
      </ExampleCard>

      <ExampleCard {...copy.states}>
        <BarChart
          data={[]}
          error="Upstream timeout — try again."
          onRetry={() => {}}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>
    </div>
  );
}
