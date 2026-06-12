import { ColumnChartExamples } from "@/components/charts/column-chart-examples";
import { ColumnChartStudio } from "@/components/playground/column-chart-studio";
import { CopyButton } from "@/components/ui/copy-button";

const installCommand =
  "npx shadcn@latest add https://brockui.com/r/column-chart";

const usageCode = `import { ColumnChart } from "@/components/charts/column-chart";

const data = [142, 168, 187, 159, 203, 178, 215];
const labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function Example() {
  return (
    <ColumnChart
      data={data}
      labels={labels}
      height={220}
      trend={0.184}
      source="Brock Analytics, 2026"
    />
  );
}`;

type PropRow = {
  name: string;
  type: string;
  default: string;
  description: string;
};

const props: PropRow[] = [
  {
    name: "data",
    type: "number[] | DataPoint[]",
    default: "—",
    description:
      "Bar values. Two forms: number[] (with labels prop) or { key?, label?, value, meta?, pattern?, color?, highlight?, note? }[] (object form). key = stable address for annotations/focusBar (defaults to label); meta = your payload, returned untouched in every callback; negatives render below the zero baseline. The synthetic 'Other' bar carries isOther + items[] (output-only)",
  },
  {
    name: "sort",
    type: "'none' | 'asc' | 'desc'",
    default: "'none'",
    description:
      "Reorder bars by value (stable). 'none' preserves input order — the honest default for time buckets; asc/desc turns the chart into a ranking",
  },
  {
    name: "topN",
    type: "number | { n, label?, pinned?, distinct? }",
    default: "undefined",
    description:
      "Keep the N largest bars, roll the tail into one 'Other' aggregate (summed). Defaults: pinned last regardless of sort, muted --brock-other fill. Callbacks receive isOther + the collapsed items[]. Number shorthand = all defaults",
  },
  {
    name: "labels",
    type: "string[]",
    default: "undefined",
    description:
      "X-axis labels (rendered in pixel font under bars + in hover tooltip). Only used when data is number[]",
  },
  {
    name: "height",
    type: "number",
    default: "200",
    description: "Chart height in pixels (Y-axis + bars area)",
  },
  {
    name: "gap",
    type: "number",
    default: "4",
    description:
      "Gap between bars in pixels. Auto-shrinks for dense datasets (60+ bars)",
  },
  {
    name: "accent",
    type: "string",
    default: "var(--brock-accent)",
    description:
      "Override the bar fill color (any CSS color or var). Defaults to Brock orange",
  },
  {
    name: "barRadius",
    type: "number",
    default: "0",
    description:
      "Top-corner radius in px. Common values: 0 (sharp), 2 (subtle), 6 (rounded)",
  },
  {
    name: "header",
    type: "{ title?, subtitle? }",
    default: "undefined",
    description: "Title + subtitle block above the chart",
  },
  {
    name: "xAxis",
    type: "{ title?, hideTicks? }",
    default: "undefined",
    description: "X-axis configuration (title below ticks, hide tick labels)",
  },
  {
    name: "yAxis",
    type: "{ title?, max?, hideTicks? }",
    default: "undefined",
    description:
      "Y-axis configuration. There is deliberately no min — a column chart's baseline is always zero (truncated bars lie). max is extend-only headroom: values below the data max are ignored with a dev warning",

  },
  {
    name: "numberFormat",
    type: "{ prefix?, suffix?, decimals?, locale?, notation?, style?, currency? }",
    default: "undefined",
    description:
      "Number formatter applied to Y-axis, tooltip, and data labels. Supports BCP-47 locale, Intl.NumberFormat notation ('compact' → 1.2K), style ('currency' / 'percent'), and ISO 4217 currency. Explicit formatValue/yAxisFormat win",
  },
  {
    name: "dataLabels",
    type: "{ show?: boolean | 'auto', format? }",
    default: "{ show: 'auto' }",
    description:
      "Direct value labels at each bar's outer end (Hack mono; mirrored below negative bars). 'auto' (the default) shows labels AND hides the Y axis when the chart has <= 8 bars — redundant ink once every value is printed. Explicit yAxis.hideTicks wins. format(value, datum) overrides numberFormat",

  },
  {
    name: "pattern",
    type: "'solid' | 'hatched'",
    default: "'solid'",
    description:
      "Default fill pattern for all bars. Per-point pattern on a data point wins over this. Hatched encodes historical/estimated/in-progress without spending a second color (Tufte)",
  },
  {
    name: "hatchUntilIndex",
    type: "number",
    default: "undefined",
    description:
      "Convenience: bars with INPUT index < N render hatched (applied before sort/topN — the pattern travels with its datum). Classic historical-vs-projected encoding",
  },
  {
    name: "hatchFromIndex",
    type: "number",
    default: "undefined",
    description:
      "Mirror of hatchUntilIndex: bars with index >= N render hatched. Useful for forecast bands and 'last N hatched' patterns. Combinable with hatchUntilIndex (union)",
  },
  {
    name: "patternStyle",
    type: "'diagonal' | 'diagonal-reverse' | 'dots' | 'vertical' | 'horizontal'",
    default: "'diagonal'",
    description:
      "Visual style of hatched bars (chart-level). Per-bar pattern still controls whether a bar is hatched; this controls how each hatched bar looks. Use 'dots' for grayscale/print",
  },
  {
    name: "scroll",
    type: "'none' | 'auto'",
    default: "'none'",
    description:
      "Overflow behavior when bars don't fit. 'auto' enables horizontal scroll; Y-axis pins to the left while bars + X-axis scroll together",
  },
  {
    name: "minBarWidth",
    type: "number",
    default: "4",
    description:
      "Minimum px per bar. Used with scroll='auto' to decide chart min-width: N*minBarWidth + (N-1)*gap. Ignored when scroll='none'",
  },
  {
    name: "bands",
    type: "{ from, to, label?, color? }[]",
    default: "undefined",
    description:
      "Plot bands — highlighted vertical zones over a range of DISPLAY positions. Editorial pattern ('Q3', 'deployment window'). Render behind bars at low opacity; indices clamp to the data range. Bands assume input order — combining bands with sort dev-warns (a 'Q3' zone is meaningless after re-ranking)",
  },
  {
    name: "trend",
    type: "number",
    default: "undefined",
    description:
      "Decimal trend indicator e.g. 0.184 → ↗ +18.4%. Orange if positive, muted if negative",
  },
  {
    name: "referenceLine",
    type: "{ value: number | { stat: 'mean' | 'median' }, label? }",
    default: "undefined",
    description:
      "Dashed reference line — a fixed threshold ('Q3 target') or a computed statistic over the ORIGINAL input data (sort/topN must not move a statistic). Stats auto-label Mean/Median. Participates in the scale on both sides, so negative and break-even (0) references stay visible",

  },
  {
    name: "source",
    type: "string",
    default: "undefined",
    description: "Attribution line rendered below the chart (FT pattern)",
  },
  {
    name: "animation",
    type: "{ enabled?, duration? }",
    default: "{ enabled: true, duration: 400 }",
    description:
      "Staggered bar-rise on mount. Disabled automatically when prefers-reduced-motion is set",
  },
  {
    name: "loading",
    type: "boolean",
    default: "false",
    description:
      "Loading state. With no data → full skeleton (dashed ghost bars + LOADING badge, ARIA role=status). With data → dim overlay on top of the chart for background refresh. Honors prefers-reduced-motion",
  },
  {
    name: "error",
    type: "Error | string | null",
    default: "null",
    description:
      "Terminal error state. Replaces the chart even when data is present (stale data next to an error is misleading). Accepts an Error, a string message, or null. ARIA role=alert",
  },
  {
    name: "onRetry",
    type: "() => void",
    default: "undefined",
    description:
      "Callback for the retry button in the default error state. The button is rendered only when this prop is provided",
  },
  {
    name: "loadingLabel",
    type: "string",
    default: "'Loading…'",
    description:
      "Label rendered next to the LOADING badge and used as the ARIA label for the skeleton state. Override for localization",
  },
  {
    name: "errorLabel",
    type: "string",
    default: "'Error'",
    description:
      "Label rendered above the error message and used as the ARIA label. Override for localization",
  },
  {
    name: "retryLabel",
    type: "string",
    default: "'Retry'",
    description:
      "Label of the retry button in the default error state. Override for localization",
  },
  {
    name: "loadingFallback",
    type: "ReactNode",
    default: "undefined",
    description:
      "Full override of the default skeleton + overlay UI. Use for a custom-branded loading experience",
  },
  {
    name: "errorFallback",
    type: "ReactNode | (error: Error) => ReactNode",
    default: "undefined",
    description:
      "Full override of the default error UI. May be a React node or a function that receives the normalized Error",
  },
  {
    name: "exportable",
    type: "boolean | { png?, svg?, csv?, copy? }",
    default: "false",
    description:
      "Show the export toolbar (top-right). true = all 4 actions; object form = enable specific ones. Imperative ref methods always work regardless",
  },
  {
    name: "exportFileName",
    type: "string | (format) => string",
    default: "'chart'",
    description:
      "Base file name for downloads. String for fixed, function for per-format. Right extension (.png/.svg/.csv) auto-appended",
  },
  {
    name: "onExport",
    type: "(format, artifact) => void",
    default: "undefined",
    description:
      "Fires after an export completes. Receives format ('png'|'svg'|'csv'|'copy') and the artifact (Blob for png/copy, string for svg/csv). Useful for analytics or custom share flows",
  },
  {
    name: "ref",
    type: "Ref<ColumnChartHandle>",
    default: "—",
    description:
      "Imperative API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }. Export methods work even in loading/error/empty. focusBar(target) takes a display index (clamped) OR a stable key string (unknown key → -1). getSelection() returns { index (display), key (stable), point } or null",
  },
  {
    name: "onBarClick",
    type: "(point, index, event) => void",
    default: "undefined",
    description:
      "Fires on click, tap, or Enter/Space on a focused bar. Event is a MouseEvent or KeyboardEvent. Adds cursor-pointer to bars when provided",
  },
  {
    name: "onBarHover",
    type: "(point | null, index | null) => void",
    default: "undefined",
    description:
      "Fires on mouse enter (point + index) and on leave of the bars area (null, null). Sync custom legends / detail panels with the hovered datum",
  },
  {
    name: "onBarFocus",
    type: "(point, index) => void",
    default: "undefined",
    description:
      "Fires on keyboard focus changes between bars (arrow keys, Home/End, Tab in, and programmatic focusBar()). Tracks the roving-tabindex position",
  },
  {
    name: "slots",
    type: "ColumnChartSlots",
    default: "{}",
    description:
      "Headless slot dictionary. Each slot replaces a default sub-component: tooltip (per-bar), empty (no data), loading (skeleton), error (terminal), toolbar (export chips), caption (below source), watermark (figure overlay). Each slot receives typed props. Slots win over loadingFallback / errorFallback shortcuts",
  },
  {
    name: "caption",
    type: "string",
    default: "undefined",
    description:
      "Short editorial caption — italic muted text with left border, rendered below the source line. FT/Stripe-Letters print-margin pattern. slots.caption wins over this",
  },
  {
    name: "watermark",
    type: "string",
    default: "undefined",
    description:
      "Diagonal watermark text — faint pixel-font overlay (≈6% opacity) over the chart. A document-lifecycle marker (DRAFT, CONFIDENTIAL) — not branding (use source for attribution). Deliberately KEPT in print: a confidential paper report must carry its marking. slots.watermark wins over this",
  },
  {
    name: "annotations",
    type: "ColumnChartAnnotation[]",
    default: "undefined",
    description:
      "Free-floating editorial annotations at (x, y) in data space. x: number = INPUT index (travels with its datum through sort/topN; dropped with a dev warning if that datum collapses into 'Other') or string = key/label match. y may be negative. { x, y, text, anchor?, arrow?, color? }; dashed connector optional. Reproduced in the SVG / PNG export",
  },
  {
    name: "chartType",
    type: "string",
    default: "'column'",
    description:
      "Machine-readable identifier stamped on the figure as data-chart-type. Included in toJSON() output. AI/LLM tooling + analytics use it to reason about the chart shape",
  },
  {
    name: "dataDescription",
    type: "string",
    default: "undefined",
    description:
      "Natural-language description of the data ('Daily active users, last 7 days'). Stamped as data-description. For AI prompts and editorial provenance. Distinct from `description` (which is the screen-reader auto-label)",
  },
  {
    name: "data-testid",
    type: "string",
    default: "undefined",
    description:
      "QA selector hook forwarded to the figure. Stable across className refactors — Testing Library / Playwright convention",
  },
  {
    name: "description",
    type: "string",
    default: "auto-generated",
    description:
      "Accessible description for screen readers (figcaption + table caption). Defaults to 'Column chart with N data points. Source: ...'",
  },
  {
    name: "formatValue",
    type: "(value, datum?) => string",
    default: "toLocaleString()",
    description:
      "Custom value formatter for tooltips, data labels, and the sr-only table. Receives the datum as a second argument (key, meta, isOther…) for context-aware formatting. Wins over numberFormat",
  },
  {
    name: "yAxisFormat",
    type: "(v: number) => string",
    default: "toLocaleString",
    description:
      "Format function for Y-axis tick labels. Wins over numberFormat",
  },
];

function Section({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`mb-12 ${wide ? "" : "max-w-4xl"}`}>
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

import { setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export const metadata = {
  alternates: localeAlternates("/components/column-chart"),
};

export default async function ColumnChartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-6xl p-10">
      <div className="mb-12 max-w-4xl">
        <div className="mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          Charts · Column Chart
        </div>
        <h1 className="mb-3 text-3xl font-normal tracking-tight text-foreground">
          Column Chart
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Vertical bars for ordered categories — time buckets or ranked
          categories. Data-ink discipline (Tufte) — one accent, no gridlines,
          monospace numerics, direct value labels by default. Built-in source
          attribution and ASCII empty state.
        </p>
      </div>

      <Section title="Studio · Code, chart, settings" wide>
        <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
          Three-panel workbench. Tweak any setting on the right — chart in the
          middle updates live and the code on the left regenerates ready to
          paste into your app.
        </p>
        <ColumnChartStudio />
      </Section>

      <Section title="Examples · Drop-in patterns" wide>
        <p className="mb-6 max-w-2xl text-xs text-muted-foreground">
          Eight curated configurations covering the prop surface. Each one is a
          live chart — view source to see the exact prop set, copy into your
          app, adjust.
        </p>
        <ColumnChartExamples />
      </Section>

      <Section title="Installation">
        <CodeBlock code={installCommand} />
      </Section>

      <Section title="Usage">
        <CodeBlock code={usageCode} />
      </Section>

      <Section title="Props">
        <div className="border border-border">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-border bg-card/40">
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Name
                </th>
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Type
                </th>
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Default
                </th>
                <th className="p-3 text-left text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {props.map((p, i) => (
                <tr
                  key={p.name}
                  className={
                    i < props.length - 1 ? "border-b border-border" : ""
                  }
                >
                  <td className="p-3 text-foreground">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.type}</td>
                  <td className="p-3 text-muted-foreground">{p.default}</td>
                  <td className="p-3 font-sans text-sm text-foreground">
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Accessibility">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p className="max-w-2xl">
            Built to WCAG 2.2 AA. Keyboard navigable, screen-reader friendly,
            honors{" "}
            <code className="font-mono text-xs text-foreground">
              prefers-reduced-motion
            </code>
            .
          </p>

          <div className="max-w-2xl">
            <div className="mb-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
              Keyboard
            </div>
            <table className="w-full font-mono text-xs">
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 pr-6 text-foreground">Tab</td>
                  <td className="py-2 font-sans text-sm">
                    Move focus into the chart (single tab stop)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-6 text-foreground">
                    ← → ↑ ↓
                  </td>
                  <td className="py-2 font-sans text-sm">
                    Navigate between bars (roving tabindex)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-6 text-foreground">Home</td>
                  <td className="py-2 font-sans text-sm">
                    Jump to first bar
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-6 text-foreground">End</td>
                  <td className="py-2 font-sans text-sm">Jump to last bar</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="max-w-2xl">
            <div className="mb-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
              Screen reader markup
            </div>
            <ul className="space-y-1.5 text-sm">
              <li>
                ·{" "}
                <code className="font-mono text-xs text-foreground">
                  &lt;figure role=&quot;figure&quot;&gt;
                </code>{" "}
                wraps the chart with an
                <code className="ml-1 font-mono text-xs text-foreground">
                  aria-labelledby
                </code>{" "}
                pointing to the figcaption
              </li>
              <li>
                · Each bar uses{" "}
                <code className="font-mono text-xs text-foreground">
                  role=&quot;graphics-symbol&quot;
                </code>{" "}
                with
                <code className="ml-1 font-mono text-xs text-foreground">
                  aria-label=&quot;LABEL: value&quot;
                </code>
              </li>
              <li>
                · A visually-hidden{" "}
                <code className="font-mono text-xs text-foreground">
                  &lt;table class=&quot;sr-only&quot;&gt;
                </code>{" "}
                provides a tabular data summary (caption + rows for each
                data point)
              </li>
              <li>
                · Trend indicator gets human-readable label (
                <em>&ldquo;Trend up 18.4 percent&rdquo;</em>) — arrows are
                aria-hidden
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Design moves">
        <ol className="max-w-2xl space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-mono text-xs text-foreground">1.</span>{" "}
            Monospace Y-axis numbers + tabular-nums (Hack font) — values align
            by digit width.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">2.</span> Single
            <code className="mx-1 font-mono text-xs text-foreground">
              --brock-accent
            </code>
            (orange) for all bars — both sides of zero. No gradient, no glow,
            no palette coding; per-bar
            <code className="mx-1 font-mono text-xs text-foreground">color</code>
            is reserved for single editorial exceptions (the anomaly, the
            current period).
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">3.</span> No
            gridlines. Single 1px baseline at zero (Tufte data-ink).
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">4.</span>{" "}
            Hover-tooltip with value in Hack mono + period in Departure Mono
            pixel-font badge.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">5.</span>{" "}
            Staggered entry animation (30ms cascade, scale-Y from baseline).
            Disabled on
            <code className="mx-1 font-mono text-xs text-foreground">
              prefers-reduced-motion
            </code>
            .
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">6.</span>{" "}
            Built-in
            <code className="mx-1 font-mono text-xs text-foreground">
              source
            </code>
            prop renders FT/Bloomberg-style attribution line below the chart.
          </li>
          <li>
            <span className="font-mono text-xs text-foreground">7.</span> ASCII
            empty state (
            <code className="mx-1 font-pixel text-xs tracking-wider">
              ▒▒▒ no data
            </code>
            ) when the dataset is empty; full state machine via
            <code className="mx-1 font-mono text-xs text-foreground">
              loading
            </code>
            /
            <code className="mx-1 font-mono text-xs text-foreground">
              error
            </code>
            (skeleton, refresh overlay, retry) in the same visual language.
          </li>
        </ol>
      </Section>

      <Section title="When to use">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Column Chart fits ordered categories where each bar is a discrete
          bucket: temporal (hours, days, weeks, agent calls per minute) or
          ranked (traffic by channel via sort + topN, revenue by region,
          profit/loss by month — negatives are first-class). Best for showing
          volume, count, or activity rhythm at a glance with sparse axes that
          don&rsquo;t compete with the data.
        </p>
      </Section>

      <Section title="When not to use">
        <p className="max-w-2xl text-sm text-muted-foreground">
          For continuous trends use Line Chart. For tiny embedded charts inside
          metric cards or prose use Sparkline. For categorical ranking with
          long labels (horizontal bars) use Bar Chart (coming soon). For
          composition over time use Stacked Column Chart (coming soon).
        </p>
      </Section>

      <Section title="Inspired by">
        <ul className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
          <li>
            · Financial Times Visual Journalism — sparse axes, source-line
            attribution, single-color bars
          </li>
          <li>· Stripe Annual Letters — inline numerics in editorial flow</li>
          <li>· The Pudding — interactive storytelling with restraint</li>
          <li>
            · Edward Tufte, <em>The Visual Display of Quantitative Information</em>{" "}
            — data-ink discipline
          </li>
        </ul>
      </Section>
    </div>
  );
}
