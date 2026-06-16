"use client";

import { useLocale } from "next-intl";
import { ColumnChart } from "@/components/charts/column-chart";

/**
 * Demo data is locale-aware: on /ru the weekday/month labels, reference-line
 * names and number formatting render in Russian — Cyrillic in the bars is a
 * feature demo, not an accident. Numeric series are shared; only display
 * strings (and the numberFormat locale pin) fork. Card titles/subtitles stay
 * in the page language via the docs content, generated code never changes.
 */
type ExamplesLocale = "en" | "ru";

const weeklyData = [142, 168, 187, 159, 203, 178, 215];

const historicalProjectedData = [142, 168, 187, 159, 203, 215, 232];

const rankingValues = [4120, 3870, 1290, 940, 610, 380, 210];

const pnlValues = [42, 18, -12, -28, 9, 31];

const STRINGS: Record<
  ExamplesLocale,
  {
    weeklyLabels: string[];
    monthLabels: string[];
    pnlMonthLabels: string[];
    rankingLabels: string[];
    weeklyTarget: string;
    bandLabel: string;
    otherLabel: string;
    peakNote: string;
    sundayLabel: string;
    numberLocale: string;
  }
> = {
  en: {
    weeklyLabels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    monthLabels: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL"],
    pnlMonthLabels: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
    rankingLabels: [
      "DIRECT",
      "SEARCH",
      "SOCIAL",
      "EMAIL",
      "REFERRAL",
      "AFFILIATE",
      "DISPLAY",
    ],
    weeklyTarget: "Weekly target",
    bandLabel: "Q3 push",
    otherLabel: "OTHER",
    peakNote: "← peak",
    sundayLabel: "SUN",
    numberLocale: "en-US",
  },
  ru: {
    weeklyLabels: ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"],
    monthLabels: ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ"],
    pnlMonthLabels: ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН"],
    rankingLabels: [
      "ПРЯМОЙ",
      "ПОИСК",
      "СОЦСЕТИ",
      "EMAIL",
      "РЕФЕРАЛЫ",
      "ПАРТНЁРЫ",
      "БАННЕРЫ",
    ],
    weeklyTarget: "Цель недели",
    bandLabel: "Спринт Q3",
    otherLabel: "ПРОЧЕЕ",
    peakNote: "← пик",
    sundayLabel: "ВС",
    numberLocale: "ru-RU",
  },
};

function ExampleCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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

/**
 * Examples gallery — 9 curated configurations covering the prop surface.
 * Lives in its own client component file so the docs page can stay an
 * RSC while these cards (which include event handlers like onRetry)
 * render on the client.
 */
export function ColumnChartExamples() {
  const locale: ExamplesLocale = useLocale() === "ru" ? "ru" : "en";
  const d = STRINGS[locale];

  const rankingData = d.rankingLabels.map((label, i) => ({
    label,
    value: rankingValues[i],
  }));

  const emphasisData = d.weeklyLabels.map((label, i) =>
    i === d.weeklyLabels.length - 1
      ? { label, value: weeklyData[i], highlight: true, note: d.peakNote }
      : { label, value: weeklyData[i] },
  );

  const pnlData = d.pnlMonthLabels.map((label, i) => ({
    label,
    value: pnlValues[i],
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ExampleCard title="Basic" subtitle="number[] + labels + trend + source">
        <ColumnChart
          data={weeklyData}
          labels={d.weeklyLabels}
          height={200}
          trend={0.184}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>

      <ExampleCard
        title="Loading skeleton"
        subtitle="loading=true + no data"
      >
        <ColumnChart data={[]} loading height={200} />
      </ExampleCard>

      <ExampleCard
        title="Refresh overlay"
        subtitle="loading=true + stale data still visible"
      >
        <ColumnChart
          data={weeklyData}
          labels={d.weeklyLabels}
          height={200}
          loading
          source="Polling every 30s"
        />
      </ExampleCard>

      <ExampleCard
        title="Error + retry"
        subtitle="error + onRetry button"
      >
        <ColumnChart
          data={[]}
          error="Upstream timeout — try again."
          onRetry={() => {}}
          height={200}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>

      <ExampleCard
        title="Historical vs projected"
        subtitle="hatchFromIndex marks future months"
      >
        <ColumnChart
          data={historicalProjectedData}
          labels={d.monthLabels}
          height={200}
          hatchFromIndex={5}
          patternStyle="diagonal"
          source="Brock Analytics, monthly"
        />
      </ExampleCard>

      <ExampleCard
        title="Reference line + plot band"
        subtitle="fixed KPI threshold + Q3 highlight zone — or pass a mean/median stat"
      >
        <ColumnChart
          data={weeklyData}
          labels={d.weeklyLabels}
          height={200}
          referenceLine={{ value: 190, label: d.weeklyTarget }}
          bands={[{ from: 4, to: 6, label: d.bandLabel }]}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>

      <ExampleCard
        title="Per-bar emphasis"
        subtitle="highlight + note on the SUN bar"
      >
        <ColumnChart
          data={emphasisData}
          height={200}
          source="Brock Analytics, 2026"
        />
      </ExampleCard>

      <ExampleCard
        title="Profit & loss"
        subtitle="negatives are first-class — bars grow down from the zero baseline"
      >
        <ColumnChart
          data={pnlData}
          height={200}
          referenceLine={{ value: { stat: "mean" } }}
          numberFormat={{ prefix: "$", suffix: "k", locale: d.numberLocale }}
          source="Brock Analytics — monthly P&L"
        />
      </ExampleCard>

      <ExampleCard
        title="Top-N ranking"
        subtitle="sort='desc' + topN — the 'Other' aggregate stays muted and pinned last"
      >
        <ColumnChart
          data={rankingData}
          height={200}
          sort="desc"
          topN={{ n: 4, label: d.otherLabel }}
          numberFormat={{ notation: "compact", locale: d.numberLocale }}
          source="Brock Analytics — traffic by channel"
        />
      </ExampleCard>

      <ExampleCard
        title="Editorial overlay"
        subtitle="caption + watermark + annotation"
      >
        <ColumnChart
          data={weeklyData}
          labels={d.weeklyLabels}
          height={200}
          source="Brock Analytics, 2026"
          caption="Excludes maintenance window 03:00–04:00 UTC."
          watermark="DRAFT"
          annotations={[
            { x: d.sundayLabel, y: 215, text: d.peakNote, arrow: true },
          ]}
        />
      </ExampleCard>
    </div>
  );
}
