/**
 * ColumnChartStudio — Highcharts × Flourish-inspired interface.
 *
 *  ┌─ Code ────┬─ Chart ─────────┬─ Settings ──┐
 *  │ live TSX  │  rendered chart │  12 panels  │
 *  └───────────┴─────────────────┴─────────────┘
 *
 * Every setting in the right rail mutates state → chart re-renders → code
 * regenerates. Code panel is read-only with a copy button (paste-into-app).
 *
 * The 12 MUST settings (sections):
 *  1. Data (preset)        7.  Color (accent)
 *  2. Header               8.  Bar style (radius + gap)
 *  3. X-axis               9.  Goal line
 *  4. Y-axis               10. Trend
 *  5. Number format        11. Source
 *  6. Data labels          12. Animation
 */

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ColumnChart } from "@/components/charts/column-chart";
import { CopyButton } from "@/components/ui/copy-button";

/* ─── Presets ────────────────────────────────────────────────────────── */

const ACCENTS = [
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
    suggestedGoal: number;
    suggestedGoalLabel: string;
  }
> = {
  daily: {
    label: "Daily",
    data: [42, 68, 51, 89, 73, 105, 96, 82, 119, 87, 64, 93, 110, 78],
    labels: [
      "01", "02", "03", "04", "05", "06", "07",
      "08", "09", "10", "11", "12", "13", "14",
    ],
    suggestedGoal: 100,
    suggestedGoalLabel: "Daily target",
  },
  weekly: {
    label: "Weekly",
    data: [142, 168, 187, 159, 203, 178, 215],
    labels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    suggestedGoal: 190,
    suggestedGoalLabel: "Weekly target",
  },
  monthly: {
    label: "Monthly",
    data: [1248, 1587, 1923, 2104, 1876, 2231],
    labels: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
    suggestedGoal: 2000,
    suggestedGoalLabel: "Monthly target",
  },
};

/* ─── State shape ────────────────────────────────────────────────────── */

type StudioState = {
  // data
  period: DatasetKey;
  // header
  headerTitle: string;
  headerSubtitle: string;
  // x-axis
  xAxisTitle: string;
  xAxisHideTicks: boolean;
  // y-axis
  yAxisTitle: string;
  yAxisHideTicks: boolean;
  yAxisMinEnabled: boolean;
  yAxisMin: number;
  yAxisMaxEnabled: boolean;
  yAxisMax: number;
  // number format
  numberPrefix: string;
  numberSuffix: string;
  numberDecimals: number;
  // data labels
  dataLabelsShow: boolean;
  // color
  accentIdx: number;
  // bar style
  radiusIdx: number;
  densityIdx: number;
  // goal
  goalShow: boolean;
  goalValue: number;
  goalLabel: string;
  // trend
  trendShow: boolean;
  trendValue: number;
  // source
  sourceShow: boolean;
  sourceText: string;
  // animation
  animationEnabled: boolean;
  animationDuration: number;
};

const INITIAL_STATE: StudioState = {
  period: "weekly",
  headerTitle: "Active users",
  headerSubtitle: "Last 7 days",
  xAxisTitle: "",
  xAxisHideTicks: false,
  yAxisTitle: "",
  yAxisHideTicks: false,
  yAxisMinEnabled: false,
  yAxisMin: 0,
  yAxisMaxEnabled: false,
  yAxisMax: 250,
  numberPrefix: "",
  numberSuffix: "",
  numberDecimals: 0,
  dataLabelsShow: false,
  accentIdx: 0,
  radiusIdx: 0,
  densityIdx: 1,
  goalShow: true,
  goalValue: 190,
  goalLabel: "Weekly target",
  trendShow: true,
  trendValue: 0.184,
  sourceShow: true,
  sourceText: "Brock Analytics, 2026",
  animationEnabled: true,
  animationDuration: 400,
};

/* ─── Code generator ─────────────────────────────────────────────────── */

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

function generateCode(s: StudioState): string {
  const ds = DATASETS[s.period];
  const accent = ACCENTS[s.accentIdx];
  const radius = RADII[s.radiusIdx];
  const density = DENSITIES[s.densityIdx];

  const lines: string[] = [];
  lines.push(`import { ColumnChart } from "@/components/charts/column-chart";`);
  lines.push("");
  lines.push(
    `const data = [${ds.data.join(", ")}];`,
  );
  lines.push(
    `const labels = [${ds.labels.map(quote).join(", ")}];`,
  );
  lines.push("");
  lines.push(`export function Example() {`);
  lines.push(`  return (`);
  lines.push(`    <ColumnChart`);
  lines.push(`      data={data}`);
  lines.push(`      labels={labels}`);
  lines.push(`      height={240}`);
  lines.push(`      gap={${density.value}}`);

  if (accent.value !== "#F54900") {
    lines.push(`      accent=${quote(accent.value)}`);
  }
  if (radius.value !== 0) {
    lines.push(`      barRadius={${radius.value}}`);
  }
  if (s.headerTitle || s.headerSubtitle) {
    const parts: string[] = [];
    if (s.headerTitle) parts.push(`title: ${quote(s.headerTitle)}`);
    if (s.headerSubtitle) parts.push(`subtitle: ${quote(s.headerSubtitle)}`);
    lines.push(`      header={{ ${parts.join(", ")} }}`);
  }
  if (s.xAxisTitle || s.xAxisHideTicks) {
    const parts: string[] = [];
    if (s.xAxisTitle) parts.push(`title: ${quote(s.xAxisTitle)}`);
    if (s.xAxisHideTicks) parts.push(`hideTicks: true`);
    lines.push(`      xAxis={{ ${parts.join(", ")} }}`);
  }
  if (
    s.yAxisTitle ||
    s.yAxisHideTicks ||
    s.yAxisMinEnabled ||
    s.yAxisMaxEnabled
  ) {
    const parts: string[] = [];
    if (s.yAxisTitle) parts.push(`title: ${quote(s.yAxisTitle)}`);
    if (s.yAxisMinEnabled) parts.push(`min: ${s.yAxisMin}`);
    if (s.yAxisMaxEnabled) parts.push(`max: ${s.yAxisMax}`);
    if (s.yAxisHideTicks) parts.push(`hideTicks: true`);
    lines.push(`      yAxis={{ ${parts.join(", ")} }}`);
  }
  if (s.numberPrefix || s.numberSuffix || s.numberDecimals > 0) {
    const parts: string[] = [];
    if (s.numberPrefix) parts.push(`prefix: ${quote(s.numberPrefix)}`);
    if (s.numberSuffix) parts.push(`suffix: ${quote(s.numberSuffix)}`);
    if (s.numberDecimals > 0) parts.push(`decimals: ${s.numberDecimals}`);
    lines.push(`      numberFormat={{ ${parts.join(", ")} }}`);
  }
  if (s.dataLabelsShow) {
    lines.push(`      dataLabels={{ show: true }}`);
  }
  if (s.trendShow) {
    lines.push(`      trend={${s.trendValue}}`);
  }
  if (s.goalShow) {
    lines.push(
      `      goal={{ value: ${s.goalValue}, label: ${quote(s.goalLabel)} }}`,
    );
  }
  if (s.sourceShow && s.sourceText) {
    lines.push(`      source=${quote(s.sourceText)}`);
  }
  if (!s.animationEnabled || s.animationDuration !== 400) {
    const parts: string[] = [];
    if (!s.animationEnabled) parts.push(`enabled: false`);
    if (s.animationDuration !== 400) {
      parts.push(`duration: ${s.animationDuration}`);
    }
    lines.push(`      animation={{ ${parts.join(", ")} }}`);
  }

  lines.push(`    />`);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join("\n");
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function ColumnChartStudio() {
  const [s, setS] = useState<StudioState>(INITIAL_STATE);

  function update<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function setPeriod(period: DatasetKey) {
    const ds = DATASETS[period];
    setS((prev) => ({
      ...prev,
      period,
      goalValue: ds.suggestedGoal,
      goalLabel: ds.suggestedGoalLabel,
    }));
  }

  const ds = DATASETS[s.period];
  const accent = ACCENTS[s.accentIdx];
  const radius = RADII[s.radiusIdx];
  const density = DENSITIES[s.densityIdx];
  const code = generateCode(s);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_260px] lg:gap-0">
      {/* ── Code panel (left) ─────────────────────────────────────── */}
      <div className="border border-border bg-card lg:border-r-0">
        <PanelHeader label="Code">
          <CopyButton text={code} />
        </PanelHeader>
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground">
          <code>{code}</code>
        </pre>
      </div>

      {/* ── Chart panel (center) ──────────────────────────────────── */}
      <div className="border border-border bg-card">
        <PanelHeader label="Chart" />
        <div className="p-6">
          <ColumnChart
            data={ds.data}
            labels={ds.labels}
            height={260}
            gap={density.value}
            accent={accent.value}
            barRadius={radius.value}
            header={
              s.headerTitle || s.headerSubtitle
                ? { title: s.headerTitle, subtitle: s.headerSubtitle }
                : undefined
            }
            xAxis={
              s.xAxisTitle || s.xAxisHideTicks
                ? {
                    title: s.xAxisTitle || undefined,
                    hideTicks: s.xAxisHideTicks,
                  }
                : undefined
            }
            yAxis={
              s.yAxisTitle ||
              s.yAxisHideTicks ||
              s.yAxisMinEnabled ||
              s.yAxisMaxEnabled
                ? {
                    title: s.yAxisTitle || undefined,
                    hideTicks: s.yAxisHideTicks,
                    min: s.yAxisMinEnabled ? s.yAxisMin : undefined,
                    max: s.yAxisMaxEnabled ? s.yAxisMax : undefined,
                  }
                : undefined
            }
            numberFormat={
              s.numberPrefix || s.numberSuffix || s.numberDecimals > 0
                ? {
                    prefix: s.numberPrefix || undefined,
                    suffix: s.numberSuffix || undefined,
                    decimals: s.numberDecimals,
                  }
                : undefined
            }
            dataLabels={s.dataLabelsShow ? { show: true } : undefined}
            trend={s.trendShow ? s.trendValue : undefined}
            goal={
              s.goalShow
                ? { value: s.goalValue, label: s.goalLabel }
                : undefined
            }
            source={s.sourceShow ? s.sourceText : undefined}
            animation={{
              enabled: s.animationEnabled,
              duration: s.animationDuration,
            }}
          />
        </div>
      </div>

      {/* ── Settings panel (right) ────────────────────────────────── */}
      <aside className="border border-border bg-card lg:border-l-0">
        <PanelHeader label="Settings" />
        <div className="divide-y divide-border">
          <Accordion label="Data" defaultOpen>
            <Field label="Preset">
              <Segmented
                options={(Object.keys(DATASETS) as DatasetKey[]).map(
                  (k) => DATASETS[k].label,
                )}
                selectedIndex={(Object.keys(DATASETS) as DatasetKey[]).indexOf(
                  s.period,
                )}
                onSelect={(i) =>
                  setPeriod((Object.keys(DATASETS) as DatasetKey[])[i])
                }
              />
            </Field>
          </Accordion>

          <Accordion label="Header">
            <Field label="Title">
              <TextInput
                value={s.headerTitle}
                onChange={(v) => update("headerTitle", v)}
                placeholder="Active users"
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={s.headerSubtitle}
                onChange={(v) => update("headerSubtitle", v)}
                placeholder="Last 7 days"
              />
            </Field>
          </Accordion>

          <Accordion label="X-axis">
            <Field label="Title">
              <TextInput
                value={s.xAxisTitle}
                onChange={(v) => update("xAxisTitle", v)}
                placeholder="Day of week"
              />
            </Field>
            <Toggle
              label="Hide tick labels"
              checked={s.xAxisHideTicks}
              onChange={(v) => update("xAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label="Y-axis">
            <Field label="Title">
              <TextInput
                value={s.yAxisTitle}
                onChange={(v) => update("yAxisTitle", v)}
                placeholder="Users"
              />
            </Field>
            <Toggle
              label="Custom min"
              checked={s.yAxisMinEnabled}
              onChange={(v) => update("yAxisMinEnabled", v)}
            />
            {s.yAxisMinEnabled && (
              <Field label="Min value">
                <NumberInput
                  value={s.yAxisMin}
                  onChange={(v) => update("yAxisMin", v)}
                />
              </Field>
            )}
            <Toggle
              label="Custom max"
              checked={s.yAxisMaxEnabled}
              onChange={(v) => update("yAxisMaxEnabled", v)}
            />
            {s.yAxisMaxEnabled && (
              <Field label="Max value">
                <NumberInput
                  value={s.yAxisMax}
                  onChange={(v) => update("yAxisMax", v)}
                />
              </Field>
            )}
            <Toggle
              label="Hide tick labels"
              checked={s.yAxisHideTicks}
              onChange={(v) => update("yAxisHideTicks", v)}
            />
          </Accordion>

          <Accordion label="Number format">
            <Field label="Prefix">
              <TextInput
                value={s.numberPrefix}
                onChange={(v) => update("numberPrefix", v)}
                placeholder="$"
              />
            </Field>
            <Field label="Suffix">
              <TextInput
                value={s.numberSuffix}
                onChange={(v) => update("numberSuffix", v)}
                placeholder="k"
              />
            </Field>
            <Field label="Decimals">
              <NumberInput
                value={s.numberDecimals}
                onChange={(v) => update("numberDecimals", Math.max(0, v))}
              />
            </Field>
          </Accordion>

          <Accordion label="Data labels">
            <Toggle
              label="Show value above each bar"
              checked={s.dataLabelsShow}
              onChange={(v) => update("dataLabelsShow", v)}
            />
          </Accordion>

          <Accordion label="Color">
            <Field label="Accent">
              <div className="flex gap-2">
                {ACCENTS.map((c, i) => {
                  const selected = i === s.accentIdx;
                  return (
                    <button
                      key={c.name}
                      onClick={() => update("accentIdx", i)}
                      className={`h-6 w-6 cursor-pointer rounded-[2px] transition-all ${
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
            </Field>
          </Accordion>

          <Accordion label="Bar style">
            <Field label="Corner radius">
              <Segmented
                options={RADII.map((r) => r.name)}
                selectedIndex={s.radiusIdx}
                onSelect={(i) => update("radiusIdx", i)}
              />
            </Field>
            <Field label="Density">
              <Segmented
                options={DENSITIES.map((d) => d.name)}
                selectedIndex={s.densityIdx}
                onSelect={(i) => update("densityIdx", i)}
              />
            </Field>
          </Accordion>

          <Accordion label="Goal line">
            <Toggle
              label="Show goal line"
              checked={s.goalShow}
              onChange={(v) => update("goalShow", v)}
            />
            {s.goalShow && (
              <>
                <Field label="Value">
                  <NumberInput
                    value={s.goalValue}
                    onChange={(v) => update("goalValue", v)}
                  />
                </Field>
                <Field label="Label">
                  <TextInput
                    value={s.goalLabel}
                    onChange={(v) => update("goalLabel", v)}
                  />
                </Field>
              </>
            )}
          </Accordion>

          <Accordion label="Trend">
            <Toggle
              label="Show trend indicator"
              checked={s.trendShow}
              onChange={(v) => update("trendShow", v)}
            />
            {s.trendShow && (
              <Field label="Value (decimal — 0.184 = +18.4%)">
                <NumberInput
                  value={s.trendValue}
                  step={0.01}
                  onChange={(v) => update("trendValue", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Source">
            <Toggle
              label="Show source line"
              checked={s.sourceShow}
              onChange={(v) => update("sourceShow", v)}
            />
            {s.sourceShow && (
              <Field label="Text">
                <TextInput
                  value={s.sourceText}
                  onChange={(v) => update("sourceText", v)}
                />
              </Field>
            )}
          </Accordion>

          <Accordion label="Animation">
            <Toggle
              label="Enable mount animation"
              checked={s.animationEnabled}
              onChange={(v) => update("animationEnabled", v)}
            />
            {s.animationEnabled && (
              <Field label="Duration (ms)">
                <NumberInput
                  value={s.animationDuration}
                  step={50}
                  onChange={(v) =>
                    update("animationDuration", Math.max(0, v))
                  }
                />
              </Field>
            )}
          </Accordion>
        </div>
      </aside>
    </div>
  );
}

/* ─── Panel/section primitives ───────────────────────────────────────── */

function PanelHeader({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-border px-3">
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function Accordion({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-foreground hover:bg-muted/40"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[2px] border border-border bg-background px-2 py-1.5 font-sans text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-brock-accent focus:outline-none"
    />
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (!Number.isNaN(next)) onChange(next);
      }}
      className="w-full rounded-[2px] border border-border bg-background px-2 py-1.5 font-mono text-xs tabular-nums text-foreground focus:border-brock-accent focus:outline-none"
    />
  );
}

function Segmented({
  options,
  selectedIndex,
  onSelect,
}: {
  options: readonly string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex rounded-[2px] border border-border bg-muted/40 p-0.5">
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={opt}
            onClick={() => onSelect(i)}
            className={`flex-1 cursor-pointer rounded-[2px] px-2 py-1 text-[11px] transition-colors ${
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
            : "border-muted-foreground/50 bg-transparent"
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
