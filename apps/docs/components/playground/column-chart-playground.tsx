/**
 * ColumnChartPlayground — interactive preview with a right-rail control panel.
 *
 * Demonstrates the chart's flexibility:
 *  - Color (5 swatches)
 *  - Corner radius (sharp / subtle / rounded)
 *  - Density (compact / normal / spacious — controls gap)
 *  - Period (daily / weekly / monthly — switches dataset)
 *  - Features (goal line / trend / source — toggles)
 *
 * Used on /components/column-chart docs page as the hero "live demo" section.
 */

"use client";

import { useState } from "react";
import { ColumnChart } from "@/components/charts/column-chart";

/* ─── Presets ────────────────────────────────────────────────────────── */

const COLORS = [
  { name: "Orange", value: "#F54900" },
  { name: "Blue", value: "#0EA5E9" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Zinc", value: "#A1A1AA" },
] as const;

const RADII = [
  { name: "Sharp", value: 0 },
  { name: "Subtle", value: 2 },
  { name: "Rounded", value: 6 },
] as const;

const DENSITIES = [
  { name: "Compact", value: 1 },
  { name: "Normal", value: 4 },
  { name: "Spacious", value: 10 },
] as const;

type DatasetKey = "daily" | "weekly" | "monthly";

const DATASETS: Record<
  DatasetKey,
  {
    label: string;
    data: number[];
    labels: string[];
    goalValue: number;
    goalLabel: string;
  }
> = {
  daily: {
    label: "Daily",
    data: [42, 68, 51, 89, 73, 105, 96, 82, 119, 87, 64, 93, 110, 78],
    labels: [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
      "14",
    ],
    goalValue: 100,
    goalLabel: "Daily target",
  },
  weekly: {
    label: "Weekly",
    data: [142, 168, 187, 159, 203, 178, 215],
    labels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    goalValue: 190,
    goalLabel: "Weekly target",
  },
  monthly: {
    label: "Monthly",
    data: [1248, 1587, 1923, 2104, 1876, 2231],
    labels: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
    goalValue: 2000,
    goalLabel: "Monthly target",
  },
};

/* ─── Component ──────────────────────────────────────────────────────── */

export function ColumnChartPlayground() {
  const [colorIdx, setColorIdx] = useState(0);
  const [radiusIdx, setRadiusIdx] = useState(0);
  const [densityIdx, setDensityIdx] = useState(1);
  const [period, setPeriod] = useState<DatasetKey>("weekly");
  const [showGoal, setShowGoal] = useState(true);
  const [showTrend, setShowTrend] = useState(true);
  const [showSource, setShowSource] = useState(true);

  const color = COLORS[colorIdx];
  const radius = RADII[radiusIdx];
  const density = DENSITIES[densityIdx];
  const dataset = DATASETS[period];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
      <div className="border border-border bg-card p-6">
        <ColumnChart
          data={dataset.data}
          labels={dataset.labels}
          height={240}
          gap={density.value}
          accent={color.value}
          barRadius={radius.value}
          trend={showTrend ? 0.184 : undefined}
          goal={
            showGoal
              ? { value: dataset.goalValue, label: dataset.goalLabel }
              : undefined
          }
          source={showSource ? "Brock Analytics, 2026" : undefined}
        />
      </div>

      <aside className="space-y-6">
        <Section label="Color">
          <div className="flex gap-2">
            {COLORS.map((c, i) => {
              const selected = i === colorIdx;
              return (
                <button
                  key={c.name}
                  onClick={() => setColorIdx(i)}
                  className={`h-7 w-7 cursor-pointer rounded-[2px] transition-all ${
                    selected
                      ? "ring-2 ring-offset-2 ring-offset-card"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={
                    {
                      backgroundColor: c.value,
                      ...(selected
                        ? ({ "--tw-ring-color": c.value } as React.CSSProperties)
                        : {}),
                    } as React.CSSProperties
                  }
                  aria-label={`Color ${c.name}`}
                  aria-pressed={selected}
                  title={c.name}
                />
              );
            })}
          </div>
        </Section>

        <Section label="Corner radius">
          <SegmentedControl
            options={RADII.map((r) => r.name)}
            selectedIndex={radiusIdx}
            onSelect={setRadiusIdx}
          />
        </Section>

        <Section label="Density">
          <SegmentedControl
            options={DENSITIES.map((d) => d.name)}
            selectedIndex={densityIdx}
            onSelect={setDensityIdx}
          />
        </Section>

        <Section label="Period">
          <SegmentedControl
            options={(Object.keys(DATASETS) as DatasetKey[]).map(
              (k) => DATASETS[k].label,
            )}
            selectedIndex={(Object.keys(DATASETS) as DatasetKey[]).indexOf(period)}
            onSelect={(i) => {
              const keys = Object.keys(DATASETS) as DatasetKey[];
              setPeriod(keys[i]);
            }}
          />
        </Section>

        <Section label="Features">
          <div className="space-y-2">
            <Toggle
              label="Goal line"
              checked={showGoal}
              onChange={setShowGoal}
            />
            <Toggle label="Trend" checked={showTrend} onChange={setShowTrend} />
            <Toggle
              label="Source"
              checked={showSource}
              onChange={setShowSource}
            />
          </div>
        </Section>
      </aside>
    </div>
  );
}

/* ─── Sub-controls ───────────────────────────────────────────────────── */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl({
  options,
  selectedIndex,
  onSelect,
}: {
  options: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex rounded-[2px] border border-white/10 bg-white/4 p-0.5">
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={opt}
            onClick={() => onSelect(i)}
            className={`flex-1 cursor-pointer rounded-[2px] px-2 py-1.5 text-xs transition-colors ${
              selected
                ? "bg-brock-accent text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={selected}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border transition-colors ${
          checked
            ? "border-brock-accent bg-brock-accent"
            : "border-white/30 bg-transparent"
        }`}
      >
        {checked && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-2.5 w-2.5 text-primary-foreground"
            aria-hidden
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span>{label}</span>
    </label>
  );
}
