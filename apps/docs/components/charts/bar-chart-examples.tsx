"use client";

import { BarChart } from "@/components/charts/bar-chart";

/**
 * Examples gallery — curated configurations covering the Bar Chart prop
 * surface. Client island (some cards wire event handlers) so the docs page
 * stays an RSC. Card copy is bilingual via props from the page dictionary.
 */

const channels = [
  { label: "DIRECT", value: 4120 },
  { label: "SEARCH", value: 3870 },
  { label: "SOCIAL", value: 1290 },
  { label: "EMAIL", value: 940 },
  { label: "REFERRAL", value: 610 },
  { label: "AFFILIATE", value: 380 },
  { label: "DISPLAY", value: 210 },
] as const;

const regions = [
  { label: "ALMATY", value: 48 },
  { label: "ASTANA", value: 36 },
  { label: "SHYMKENT", value: 21 },
  { label: "KARAGANDA", value: 14 },
  { label: "AKTOBE", value: 9 },
] as const;

const pnl = [
  { label: "PRODUCT A", value: 42 },
  { label: "PRODUCT B", value: 18 },
  { label: "PRODUCT C", value: -12 },
  { label: "PRODUCT D", value: -28 },
  { label: "PRODUCT E", value: 31 },
] as const;

const longLabels = [
  { label: "Enterprise & strategic accounts", value: 184 },
  { label: "Mid-market subscriptions", value: 142 },
  { label: "Self-serve monthly plans", value: 95 },
  { label: "Marketplace revenue share", value: 61 },
  { label: "Professional services", value: 38 },
] as const;

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
          topN={{ n: 4, label: "OTHER" }}
          numberFormat={{ notation: "compact", locale: "en-US" }}
          source="Brock Analytics — traffic by channel"
        />
      </ExampleCard>

      <ExampleCard {...copy.negatives}>
        <BarChart
          data={pnl}
          sort="desc"
          referenceLine={{ value: { stat: "mean" } }}
          numberFormat={{ prefix: "$", suffix: "k", locale: "en-US" }}
          source="Brock Analytics — contribution by product"
        />
      </ExampleCard>

      <ExampleCard {...copy.reference}>
        <BarChart
          data={regions}
          referenceLine={{ value: 30, label: "Plan" }}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>

      <ExampleCard {...copy.longLabels}>
        <BarChart
          data={longLabels}
          labelWidth={170}
          numberFormat={{ prefix: "$", suffix: "k", locale: "en-US" }}
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
