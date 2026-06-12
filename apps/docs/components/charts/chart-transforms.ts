/**
 * Shared chart data transforms — the math core every Brock UI chart imports.
 *
 * Lives in its own file (canon-spec §4 + §13: one implementation for the live
 * render AND the static render path of every component — no fidelity drift,
 * and the honest "math core vs view" boundary for registry upgrades).
 * Shipped through the shadcn registry alongside each chart component; both
 * Column Chart and Bar Chart target the same copy.
 */

/**
 * topN input shape — defined HERE (not imported from a chart) so this file is
 * fully self-contained: a consumer may install only one chart, and the math
 * core must never depend on any specific chart's types. Each chart exposes
 * its own structurally-identical public alias (ColumnChartTopN, BarChartTopN).
 */
export type ChartTopNInput =
  | number
  | { n: number; label?: string; pinned?: boolean; distinct?: boolean };

/* ─── Shared data transforms (used by the live chart AND the static render
       path so a JSON config produces the same bars in both worlds) ────── */

/** Fully-resolved topN config (number shorthand expanded, defaults applied). */
export type ColumnChartTopNConfig = {
  n: number;
  label: string;
  pinned: boolean;
  distinct: boolean;
};

/** Expand the `topN` prop (number shorthand or object form) into full config. */
export function resolveTopNConfig(
  topN: ChartTopNInput | undefined,
): ColumnChartTopNConfig | undefined {
  if (topN === undefined) return undefined;
  if (typeof topN === "number") {
    return { n: topN, label: "Other", pinned: true, distinct: true };
  }
  return {
    n: topN.n,
    label: topN.label ?? "Other",
    pinned: topN.pinned ?? true,
    distinct: topN.distinct ?? true,
  };
}

/**
 * Apply topN bucketing + sort to a list of points. Generic over the point
 * shape so the React component (NormalizedPoint) and the static render path
 * (ExportPoint) share ONE implementation — no fidelity drift.
 *
 * Semantics: topN keeps the N largest by value (stable ties), collapses the
 * tail into one "Other" point built by `makeOther`. Sort is by value and
 * stable (native sort, ES2019+). A pinned "Other" is excluded from the sort
 * and appended last; unpinned participates by its summed value.
 */
export function transformDataPoints<P extends { value: number }>(
  points: P[],
  sort: "none" | "asc" | "desc",
  topN: ColumnChartTopNConfig | undefined,
  makeOther: (sum: number, collapsed: P[], config: ColumnChartTopNConfig) => P,
): P[] {
  let result = [...points];
  let other: P | undefined;

  if (topN && topN.n > 0 && points.length > topN.n) {
    const keptIndices = new Set(
      points
        .map((p, i) => ({ v: p.value, i }))
        .sort((a, b) => b.v - a.v || a.i - b.i)
        .slice(0, topN.n)
        .map((x) => x.i),
    );
    const kept: P[] = [];
    const collapsed: P[] = [];
    let sum = 0;
    points.forEach((p, i) => {
      if (keptIndices.has(i)) {
        kept.push(p);
      } else {
        sum += p.value;
        collapsed.push(p);
      }
    });
    other = makeOther(sum, collapsed, topN);
    result = kept;
  }

  if (other && !topN!.pinned) result.push(other);
  if (sort !== "none") {
    result.sort((a, b) => (sort === "asc" ? a.value - b.value : b.value - a.value));
  }
  if (other && topN!.pinned) result.push(other);
  return result;
}

/** Compute a reference statistic over the ORIGINAL input values. */
export function computeStat(
  values: readonly number[],
  stat: "mean" | "median",
): number {
  if (values.length === 0) return 0;
  if (stat === "mean") {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
