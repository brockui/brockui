"use client";

import { ColumnChart } from "@/components/charts/column-chart";

const weeklyData = [142, 168, 187, 159, 203, 178, 215];
const weeklyLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const historicalProjectedData = [142, 168, 187, 159, 203, 215, 232];
const historicalProjectedLabels = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
];

const rankingData = [
  { label: "DIRECT", value: 4120 },
  { label: "SEARCH", value: 3870 },
  { label: "SOCIAL", value: 1290 },
  { label: "EMAIL", value: 940 },
  { label: "REFERRAL", value: 610 },
  { label: "AFFILIATE", value: 380 },
  { label: "DISPLAY", value: 210 },
] as const;

const emphasisData = [
  { label: "MON", value: 142 },
  { label: "TUE", value: 168 },
  { label: "WED", value: 187 },
  { label: "THU", value: 159 },
  { label: "FRI", value: 203 },
  { label: "SAT", value: 178 },
  { label: "SUN", value: 215, highlight: true, note: "← peak" },
] as const;

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
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ExampleCard title="Basic" subtitle="number[] + labels + trend + source">
        <ColumnChart
          data={weeklyData}
          labels={weeklyLabels}
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
          labels={weeklyLabels}
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
          labels={historicalProjectedLabels}
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
          labels={weeklyLabels}
          height={200}
          referenceLine={{ value: 190, label: "Weekly target" }}
          bands={[{ from: 4, to: 6, label: "Q3 push" }]}
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
          data={[
            { label: "JAN", value: 42 },
            { label: "FEB", value: 18 },
            { label: "MAR", value: -12 },
            { label: "APR", value: -28 },
            { label: "MAY", value: 9 },
            { label: "JUN", value: 31 },
          ]}
          height={200}
          referenceLine={{ value: { stat: "mean" } }}
          numberFormat={{ prefix: "$", suffix: "k" }}
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
          topN={{ n: 4, label: "OTHER" }}
          numberFormat={{ notation: "compact" }}
          source="Brock Analytics — traffic by channel"
        />
      </ExampleCard>

      <ExampleCard
        title="Editorial overlay"
        subtitle="caption + watermark + annotation"
      >
        <ColumnChart
          data={weeklyData}
          labels={weeklyLabels}
          height={200}
          source="Brock Analytics, 2026"
          caption="Excludes maintenance window 03:00–04:00 UTC."
          watermark="DRAFT"
          annotations={[{ x: "SUN", y: 215, text: "← peak", arrow: true }]}
        />
      </ExampleCard>
    </div>
  );
}
