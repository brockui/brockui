"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { components } from "@/lib/components-catalog";
import { ColumnChart } from "@/components/charts/column-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";

/** Live mini-previews — the actual shipped charts, rendered small and inert.
 *  This is the registry showing its own work (the 21st.dev / curations pattern,
 *  but with real components instead of screenshots). */
const PREVIEWS: Record<string, ReactNode> = {
  "column-chart": (
    <ColumnChart
      data={[142, 168, 187, 159, 203, 178, 215]}
      height={132}
      barRadius={2}
      xAxis={{ hideTicks: true }}
      yAxis={{ hideTicks: true }}
    />
  ),
  "bar-chart": (
    <BarChart
      data={[
        { label: "Direct", value: 4120 },
        { label: "Search", value: 3870 },
        { label: "Social", value: 1290 },
        { label: "Email", value: 940 },
      ]}
      barThickness={22}
      gap={8}
      barRadius={2}
      xAxis={{ hideTicks: true }}
      yAxis={{ hideTicks: true }}
    />
  ),
  "line-chart": (
    <LineChart
      data={[120, 138, 131, 159, 172, 188, 205]}
      height={132}
      xAxis={{ hideTicks: true }}
      yAxis={{ hideTicks: true }}
    />
  ),
};

export function HomeShowcase({ locale }: { locale: string }) {
  const cards = components.filter((c) => PREVIEWS[c.id]);
  const lang = locale === "ru" ? "ru" : "en";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-brock-accent/50"
        >
          <div className="pointer-events-none w-full border-b border-border bg-muted/30 px-4 py-5">
            {PREVIEWS[item.id]}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-sm font-semibold text-foreground">
                {item.name}
              </span>
              <span className="rounded-full border border-brock-accent/30 bg-brock-accent/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-brock-accent uppercase">
                {item.status}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {item.description[lang]}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
