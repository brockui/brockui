"use client";

import { useEffect, useRef } from "react";
import {
  BarChart,
  type BarChartHandle,
  type BarChartTooltipSlotProps,
  type BarChartEmptySlotProps,
} from "@/components/charts/bar-chart";
import { CopyButton } from "@/components/ui/copy-button";

/**
 * Slots docs section — Bar Chart.
 *
 * Slots are a CODE feature, not a Studio toggle: each slot replaces a default
 * sub-component with your own React component. This section shows one live
 * demo per slot plus the exact copy-paste snippet. Demo data labels stay
 * English here — this is sample-code context, not a localized product surface.
 * Only the prose (lead + card titles/descriptions) is bilingual via `copy`.
 */
export type SlotsSectionCopy = {
  lead: string;
  items: {
    tooltip: { title: string; desc: string };
    empty: { title: string; desc: string };
    caption: { title: string; desc: string };
    watermark: { title: string; desc: string };
  };
};

/* ─── Demo slot components (moved out of the Studio) ───────────────────── */

function DemoTooltip({ index, value, label, point }: BarChartTooltipSlotProps) {
  return (
    <div className="flex flex-col gap-1 rounded-[2px] border-2 border-brock-accent bg-background p-2 shadow-lg">
      <span className="font-pixel text-[10px] tracking-wider text-brock-accent uppercase">
        Bar #{index + 1}
        {label ? ` · ${label}` : ""}
      </span>
      <span className="font-mono text-sm tabular-nums text-foreground">
        {value}
      </span>
      {point.note && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {point.note}
        </span>
      )}
    </div>
  );
}

function DemoEmpty({ height, source }: BarChartEmptySlotProps) {
  return (
    <div>
      <div
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-brock-accent/40 bg-brock-accent/5"
        style={{ height }}
      >
        <span className="font-pixel text-xl tracking-wider text-brock-accent">
          ✺ ✺ ✺
        </span>
        <span className="font-sans text-sm text-foreground">
          Custom empty slot — your data is on holiday.
        </span>
      </div>
      {source && (
        <div className="mt-4 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
          Source: {source}
        </div>
      )}
    </div>
  );
}

function DemoCaption() {
  return (
    <div className="mt-2 border-l-2 border-brock-accent bg-muted/30 px-3 py-2 font-sans text-xs text-muted-foreground italic">
      Reading note: bars marked with{" "}
      <span className="font-pixel text-foreground">▒</span> are projected.
      Updated every 5 minutes.
    </div>
  );
}

function DemoWatermark() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="rotate-[-20deg] font-pixel text-5xl tracking-wider text-brock-accent/10 select-none">
        BROCK · UI
      </span>
    </div>
  );
}

/* ─── Code snippets (English code — never translated) ──────────────────── */

const TOOLTIP_CODE = `<BarChart
  data={data}
  slots={{
    tooltip: ({ point, index, value, label }) => (
      <div className="rounded border-2 border-brock-accent p-2">
        <span className="font-pixel text-[10px] uppercase">
          Bar #{index + 1}{label ? \` · \${label}\` : ""}
        </span>
        <span className="font-mono tabular-nums">{value}</span>
      </div>
    ),
  }}
/>`;

const EMPTY_CODE = `<BarChart
  data={[]}
  slots={{
    empty: ({ height, source }) => (
      <div style={{ height }} className="border-2 border-dashed">
        ✺ ✺ ✺ — your data is on holiday.
      </div>
    ),
  }}
/>`;

const CAPTION_CODE = `<BarChart
  data={data}
  source="Brock Analytics, 2026"
  slots={{
    caption: () => (
      <p className="border-l-2 border-brock-accent px-3 py-2 text-xs italic">
        Reading note: bars marked ▒ are projected.
      </p>
    ),
  }}
/>`;

const WATERMARK_CODE = `<BarChart
  data={data}
  slots={{
    watermark: () => (
      <div className="flex h-full items-center justify-center">
        <span className="rotate-[-20deg] font-pixel text-5xl opacity-10">
          BROCK · UI
        </span>
      </div>
    ),
  }}
/>`;

/* ─── Local helpers ────────────────────────────────────────────────────── */

/** Compact CodeBlock with a copy button (mirrors the docs page helper). */
function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative border border-border bg-card">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-[11px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

/** One slot card — bordered, mono-uppercase code subtitle, live demo, code. */
function SlotCard({
  slotKey,
  title,
  desc,
  children,
  code,
}: {
  slotKey: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  code: string;
}) {
  return (
    <div className="flex flex-col border border-border bg-card p-5">
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-wider text-muted-foreground/60 lowercase">
          {slotKey}
        </div>
        <div className="mt-0.5 text-sm font-medium text-foreground">{title}</div>
      </div>
      <div className="mb-3">{children}</div>
      <p className="mb-3 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-auto">
        <CodeBlock code={code} />
      </div>
    </div>
  );
}

/* ─── Demo data — small ranking, English (sample-code context) ─────────── */

const demoData = [
  { label: "DIRECT", value: 4120 },
  { label: "SEARCH", value: 3870 },
  { label: "SOCIAL", value: 1290 },
  { label: "EMAIL", value: 940 },
  { label: "REFERRAL", value: 620 },
];

export function BarChartSlotsSection({ copy }: { copy: SlotsSectionCopy }) {
  // The tooltip is hover-only — pin it on mount so the card shows the slot
  // without the reader having to hover.
  const tooltipRef = useRef<BarChartHandle>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => tooltipRef.current?.focusBar(0));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div>
      <p className="mb-6 max-w-2xl text-xs text-muted-foreground">{copy.lead}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SlotCard
          slotKey="slots.tooltip"
          title={copy.items.tooltip.title}
          desc={copy.items.tooltip.desc}
          code={TOOLTIP_CODE}
        >
          <BarChart
            ref={tooltipRef}
            data={demoData}
            sort="desc"
            slots={{ tooltip: DemoTooltip }}
          />
        </SlotCard>

        <SlotCard
          slotKey="slots.empty"
          title={copy.items.empty.title}
          desc={copy.items.empty.desc}
          code={EMPTY_CODE}
        >
          <BarChart
            data={[]}
            source="Brock Analytics, 2026"
            slots={{ empty: DemoEmpty }}
          />
        </SlotCard>

        <SlotCard
          slotKey="slots.caption"
          title={copy.items.caption.title}
          desc={copy.items.caption.desc}
          code={CAPTION_CODE}
        >
          <BarChart
            data={demoData}
            sort="desc"
            source="Brock Analytics, 2026"
            slots={{ caption: DemoCaption }}
          />
        </SlotCard>

        <SlotCard
          slotKey="slots.watermark"
          title={copy.items.watermark.title}
          desc={copy.items.watermark.desc}
          code={WATERMARK_CODE}
        >
          <BarChart
            data={demoData}
            sort="desc"
            slots={{ watermark: DemoWatermark }}
          />
        </SlotCard>
      </div>
    </div>
  );
}
