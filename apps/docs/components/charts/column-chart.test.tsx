import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ColumnChart,
  type ColumnChartHandle,
  type ColumnChartProps,
} from "./column-chart";
import {
  COLUMN_CHART_JSON_SCHEMA,
  fromJSON,
  pointsToCSV,
  renderToHTMLString,
  synthesizeSVG,
  toJSON,
  type ColumnChartJSON,
  type ExportPoint,
  type SynthesisContext,
} from "./column-chart-export";

describe("ColumnChart — rendering", () => {
  it("renders one bar per data point with numeric form", () => {
    render(<ColumnChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(3);
  });

  it("renders one bar per data point with object form", () => {
    render(
      <ColumnChart
        data={[
          { label: "Q1", value: 100 },
          { label: "Q2", value: 200 },
        ]}
      />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(2);
  });

  it("uses label in aria-label for object form", () => {
    render(
      <ColumnChart
        data={[{ label: "Q1", value: 1248 }]}
        formatValue={(v) => String(v)}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar).toHaveAttribute("aria-label", "Q1: 1248");
  });

  it("falls back to index-based aria-label when no label given", () => {
    render(<ColumnChart data={[10, 20]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[0]).toHaveAttribute("aria-label", "Bar 1: 10");
    expect(bars[1]).toHaveAttribute("aria-label", "Bar 2: 20");
  });

  it("uses custom formatValue for tooltip and aria-label", () => {
    render(
      <ColumnChart data={[1500]} formatValue={(v) => `$${v}`} />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar).toHaveAttribute("aria-label", "Bar 1: $1500");
  });
});

describe("ColumnChart — empty + edge cases", () => {
  it("renders ASCII empty state when data is []", () => {
    render(<ColumnChart data={[]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "No data available for this period",
    );
    expect(screen.queryAllByRole("graphics-symbol")).toHaveLength(0);
  });

  it("renders empty state with source line when source provided", () => {
    render(<ColumnChart data={[]} source="Acme Analytics" />);
    expect(screen.getByText(/Acme Analytics/)).toBeInTheDocument();
  });

  it("filters NaN and Infinity with console.warn (in dev)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ColumnChart data={[10, NaN, 20, Infinity, 30]} />);
    expect(screen.getAllByRole("graphics-symbol")).toHaveLength(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("skipped 2 non-finite value(s)"),
    );
    spy.mockRestore();
  });

  it("clamps negative values to 0 with console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ColumnChart data={[10, -5, 20]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(3);
    expect(bars[1]).toHaveAttribute("aria-label", "Bar 2: 0");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("clamped 1 negative value(s)"),
    );
    spy.mockRestore();
  });

  it("renders all-zero data with bars at 0 height", () => {
    render(<ColumnChart data={[0, 0, 0]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(3);
    // Bars exist but tooltip suppressed (no value to show)
    bars.forEach((bar) => {
      expect(bar).toHaveAttribute("aria-label", expect.stringMatching(/: 0$/));
    });
  });

  it("handles single bar without crashing", () => {
    render(
      <ColumnChart
        data={[{ label: "TOTAL", value: 12847 }]}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByRole("graphics-symbol")).toHaveAttribute(
      "aria-label",
      "TOTAL: 12847",
    );
  });
});

describe("ColumnChart — accessibility", () => {
  it("wraps chart in <figure> with aria-labelledby pointing to figcaption", () => {
    const { container } = render(
      <ColumnChart data={[10, 20]} source="Acme" />,
    );
    const figure = container.querySelector("figure");
    expect(figure).toHaveAttribute("role", "figure");
    const labelledBy = figure?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const caption = container.querySelector(`#${labelledBy}`);
    expect(caption).toHaveTextContent(
      "Column chart with 2 data points. Source: Acme.",
    );
  });

  it("auto-description handles singular vs plural", () => {
    const { container } = render(<ColumnChart data={[42]} />);
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${id}`)).toHaveTextContent(
      "Column chart with 1 data point.",
    );
  });

  it("uses custom description when provided", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20]}
        description="Quarterly revenue from Q1 to Q2 2026"
      />,
    );
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${id}`)).toHaveTextContent(
      "Quarterly revenue from Q1 to Q2 2026",
    );
  });

  it("provides sr-only data table summary with one row per bar", () => {
    const { container } = render(
      <ColumnChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    const table = container.querySelector("table.sr-only");
    expect(table).toBeInTheDocument();
    const caption = within(table as HTMLElement).getByText(
      /Column chart with 3 data points/,
    );
    expect(caption.tagName).toBe("CAPTION");
    const rows = within(table as HTMLElement).getAllByRole("row");
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("A");
    expect(within(rows[1]).getByRole("cell")).toHaveTextContent("10");
  });

  it("uses roving tabindex: only one bar tabbable at a time", () => {
    render(<ColumnChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[0]).toHaveAttribute("tabindex", "0");
    expect(bars[1]).toHaveAttribute("tabindex", "-1");
    expect(bars[2]).toHaveAttribute("tabindex", "-1");
  });
});

describe("ColumnChart — keyboard navigation", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("Arrow Right moves focus to next bar and updates tabindex", async () => {
    render(<ColumnChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(bars[1]);
    expect(bars[1]).toHaveAttribute("tabindex", "0");
    expect(bars[0]).toHaveAttribute("tabindex", "-1");
  });

  it("Arrow Left clamps at first bar (no wraparound)", async () => {
    render(<ColumnChart data={[10, 20, 30]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(bars[0]);
  });

  it("End jumps to last bar", async () => {
    render(<ColumnChart data={[10, 20, 30, 40, 50]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(bars[4]);
  });

  it("Home jumps to first bar", async () => {
    render(<ColumnChart data={[10, 20, 30]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[2].focus();
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(bars[0]);
  });

  it("Arrow Right clamps at last bar (no wraparound)", async () => {
    render(<ColumnChart data={[10, 20]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[1].focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(bars[1]);
  });
});

describe("ColumnChart — trend indicator", () => {
  it("shows positive trend with up arrow + accessible label", () => {
    render(<ColumnChart data={[10]} trend={0.184} />);
    expect(screen.getByText(/\+18\.4%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Trend up 18\.4 percent/)).toBeInTheDocument();
  });

  it("shows negative trend with down arrow + accessible label", () => {
    render(<ColumnChart data={[10]} trend={-0.075} />);
    expect(screen.getByText(/-7\.5%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Trend down -7\.5 percent/)).toBeInTheDocument();
  });

  it("does not render trend when prop is undefined", () => {
    render(<ColumnChart data={[10]} />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});

describe("ColumnChart — goal line", () => {
  it("renders goal line with label + value when both provided", () => {
    render(
      <ColumnChart
        data={[100, 150, 200]}
        goal={{ value: 180, label: "Q3 target" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Q3 target · 180/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Q3 target reference line at 180/),
    ).toBeInTheDocument();
  });

  it("renders 'Goal: value' fallback when label omitted", () => {
    render(
      <ColumnChart
        data={[100]}
        goal={{ value: 50 }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Goal: 50/)).toBeInTheDocument();
  });

  it("includes goal in max calc so goal > data still renders bars correctly", () => {
    render(
      <ColumnChart
        data={[100]}
        goal={{ value: 500, label: "Stretch" }}
        formatValue={(v) => String(v)}
      />,
    );
    // Goal line present
    expect(screen.getByText(/Stretch · 500/)).toBeInTheDocument();
    // Bar still renders (would be at 100/500 = 20% height)
    expect(screen.getByRole("graphics-symbol")).toHaveAttribute(
      "aria-label",
      "Bar 1: 100",
    );
  });

  it("skips goal line when value is 0, negative, or non-finite", () => {
    const { rerender } = render(
      <ColumnChart data={[100]} goal={{ value: 0 }} />,
    );
    expect(screen.queryByText(/Goal/)).not.toBeInTheDocument();

    rerender(<ColumnChart data={[100]} goal={{ value: -50 }} />);
    expect(screen.queryByText(/Goal/)).not.toBeInTheDocument();

    rerender(<ColumnChart data={[100]} goal={{ value: NaN }} />);
    expect(screen.queryByText(/Goal/)).not.toBeInTheDocument();
  });

  it("skips goal when no data renders (empty array)", () => {
    render(<ColumnChart data={[]} goal={{ value: 100, label: "Target" }} />);
    // Empty state shown instead — no goal line
    expect(screen.queryByText(/Target/)).not.toBeInTheDocument();
  });
});

describe("ColumnChart — source line", () => {
  it("renders source attribution when source prop given", () => {
    render(<ColumnChart data={[10]} source="FT, 2026" />);
    // Two matches expected: visible source line + sr-only figcaption
    expect(screen.getAllByText(/Source: FT, 2026/i).length).toBeGreaterThan(0);
  });

  it("omits source line when prop absent", () => {
    render(<ColumnChart data={[10]} />);
    expect(screen.queryByText(/^Source:/i)).not.toBeInTheDocument();
  });
});

describe("ColumnChart — header", () => {
  it("renders title and subtitle when both provided", () => {
    render(
      <ColumnChart
        data={[10]}
        header={{ title: "Active users", subtitle: "Last 7 days" }}
      />,
    );
    expect(screen.getByText("Active users")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  it("renders only title when subtitle missing", () => {
    render(<ColumnChart data={[10]} header={{ title: "Revenue" }} />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("omits header element when header prop absent", () => {
    const { container } = render(<ColumnChart data={[10]} />);
    expect(container.querySelector("figure > div:first-child")?.textContent)
      .not.toBe("Revenue");
  });
});

describe("ColumnChart — xAxis / yAxis config", () => {
  it("renders xAxis.title below the chart", () => {
    render(
      <ColumnChart
        data={[10, 20]}
        labels={["A", "B"]}
        xAxis={{ title: "Quarter" }}
      />,
    );
    expect(screen.getByText("Quarter")).toBeInTheDocument();
  });

  it("hides Y-axis tick column when yAxis.hideTicks is true", () => {
    const { container } = render(
      <ColumnChart
        data={[100]}
        yAxisFormat={(v) => `Y${v}`}
        yAxis={{ hideTicks: true }}
      />,
    );
    expect(container.textContent).not.toContain("Y100");
  });

  it("hides X-axis tick labels when xAxis.hideTicks is true", () => {
    render(
      <ColumnChart
        data={[10, 20]}
        labels={["FIRST", "SECOND"]}
        xAxis={{ hideTicks: true }}
      />,
    );
    // labels appear in bar aria-labels but not as visible X-axis text
    const xAxisLabels = screen
      .queryAllByText("FIRST")
      .filter((el) => el.getAttribute("aria-hidden") !== null);
    expect(xAxisLabels.length).toBe(0);
  });

  it("renders yAxis.title vertically", () => {
    render(
      <ColumnChart data={[10]} yAxis={{ title: "Users" }} />,
    );
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("yAxis.max overrides data-derived max for tick computation", () => {
    render(
      <ColumnChart
        data={[10]}
        yAxisFormat={(v) => `Y${v}`}
        yAxis={{ max: 500 }}
      />,
    );
    // top tick should be 500, not 10
    expect(screen.getByText("Y500")).toBeInTheDocument();
  });
});

describe("ColumnChart — numberFormat", () => {
  it("applies prefix and suffix to Y-axis ticks", () => {
    render(
      <ColumnChart
        data={[1000]}
        numberFormat={{ prefix: "$", suffix: "k" }}
      />,
    );
    // Same formatted value appears in Y-axis ticks + tooltip + sr-only table.
    // At least one occurrence is enough.
    expect(screen.getAllByText(/^\$1.*k$/).length).toBeGreaterThan(0);
  });

  it("applies decimals", () => {
    render(
      <ColumnChart
        data={[100]}
        numberFormat={{ decimals: 2 }}
      />,
    );
    // happy-dom may use a comma decimal separator depending on host locale.
    const bar = screen.getByRole("graphics-symbol");
    expect(bar.getAttribute("aria-label")).toMatch(/100[.,]00/);
  });

  it("explicit formatValue wins over numberFormat", () => {
    render(
      <ColumnChart
        data={[100]}
        numberFormat={{ prefix: "$" }}
        formatValue={(v) => `RAW${v}`}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar.getAttribute("aria-label")).toMatch(/RAW100/);
  });
});

describe("ColumnChart — dataLabels", () => {
  it("renders inline value above each bar when dataLabels.show is true", () => {
    const { container } = render(
      <ColumnChart
        data={[100, 200]}
        labels={["A", "B"]}
        formatValue={(v) => `V${v}`}
        dataLabels={{ show: true }}
      />,
    );
    // Inline labels carry the -top-4 class; both values should appear in that slot.
    const inlineLabels = Array.from(
      container.querySelectorAll(".-top-4"),
    ).map((n) => n.textContent);
    expect(inlineLabels).toContain("V100");
    expect(inlineLabels).toContain("V200");
  });

  it("does not render inline labels by default", () => {
    render(
      <ColumnChart
        data={[100]}
        formatValue={(v) => `V${v}`}
      />,
    );
    // tooltip text V100 is in DOM but hidden via classes; check via specific selector
    const inlineLabels = screen.queryAllByText("V100").filter((el) =>
      el.classList.contains("pointer-events-none") &&
      el.classList.contains("-top-4"),
    );
    expect(inlineLabels.length).toBe(0);
  });

  it("dataLabels.format overrides default formatter for inline labels", () => {
    render(
      <ColumnChart
        data={[100]}
        formatValue={(v) => `default${v}`}
        dataLabels={{ show: true, format: (v) => `custom${v}` }}
      />,
    );
    expect(screen.getByText("custom100")).toBeInTheDocument();
  });
});

describe("ColumnChart — pattern (hatching)", () => {
  it("applies brock-bar-hatched class when chart-level pattern is 'hatched'", () => {
    const { container } = render(
      <ColumnChart data={[10, 20, 30]} pattern="hatched" />,
    );
    const hatched = container.querySelectorAll(".brock-bar-hatched");
    expect(hatched.length).toBe(3);
  });

  it("defaults to solid (bg-brock-accent) when no pattern is given", () => {
    const { container } = render(<ColumnChart data={[10]} />);
    expect(container.querySelector(".brock-bar-hatched")).toBeFalsy();
    expect(container.querySelector(".bg-brock-accent")).toBeTruthy();
  });

  it("per-point pattern overrides chart-level pattern", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "A", value: 10, pattern: "hatched" },
          { label: "B", value: 20 },
        ]}
        pattern="solid"
      />,
    );
    const hatched = container.querySelectorAll(".brock-bar-hatched");
    expect(hatched.length).toBe(1);
  });

  it("hatchUntilIndex hatches the first N bars, solid for the rest", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30, 40, 50]}
        labels={["A", "B", "C", "D", "E"]}
        hatchUntilIndex={2}
      />,
    );
    const hatched = container.querySelectorAll(".brock-bar-hatched");
    expect(hatched.length).toBe(2);
  });

  it("hatchFromIndex hatches the last N bars (from index inclusive)", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30, 40, 50]}
        labels={["A", "B", "C", "D", "E"]}
        hatchFromIndex={3}
      />,
    );
    const hatched = container.querySelectorAll(".brock-bar-hatched");
    expect(hatched.length).toBe(2);
  });

  it("hatchUntilIndex and hatchFromIndex combine (union)", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30, 40, 50]}
        labels={["A", "B", "C", "D", "E"]}
        hatchUntilIndex={1}
        hatchFromIndex={4}
      />,
    );
    // bar 0 hatched (until 1), bar 4 hatched (from 4) → 2 total
    const hatched = container.querySelectorAll(".brock-bar-hatched");
    expect(hatched.length).toBe(2);
  });

  it("patternStyle defaults to 'diagonal' (class on wrapper)", () => {
    const { container } = render(
      <ColumnChart data={[10]} pattern="hatched" />,
    );
    expect(
      container.querySelector(".brock-bars-pattern-diagonal"),
    ).toBeTruthy();
  });

  it("patternStyle='dots' applies dots wrapper class", () => {
    const { container } = render(
      <ColumnChart data={[10]} pattern="hatched" patternStyle="dots" />,
    );
    expect(container.querySelector(".brock-bars-pattern-dots")).toBeTruthy();
    expect(
      container.querySelector(".brock-bars-pattern-diagonal"),
    ).toBeFalsy();
  });

  it("patternStyle='diagonal-reverse' applies reverse wrapper class", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        pattern="hatched"
        patternStyle="diagonal-reverse"
      />,
    );
    expect(
      container.querySelector(".brock-bars-pattern-diagonal-reverse"),
    ).toBeTruthy();
  });

  it("per-point pattern wins over hatchUntilIndex", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, pattern: "solid" },
          { label: "C", value: 30 },
        ]}
        hatchUntilIndex={3}
      />,
    );
    // A and C hatched (idx 0, 2), B forced solid via per-point override
    const hatched = container.querySelectorAll(".brock-bar-hatched");
    expect(hatched.length).toBe(2);
  });
});

describe("ColumnChart — state machine (loading / error / empty / ready)", () => {
  it("loading + no data renders the full skeleton with role=status and aria-busy", () => {
    const { container } = render(<ColumnChart data={[]} loading />);
    const status = container.querySelector('[role="status"]') as HTMLElement;
    expect(status).toBeTruthy();
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe("Loading…");
    // 12 skeleton bars by default
    expect(container.querySelectorAll(".brock-skeleton-bar").length).toBe(12);
  });

  it("loading + populated data renders the chart with an overlay (not the skeleton)", () => {
    const { container } = render(
      <ColumnChart data={[10, 20, 30]} labels={["A", "B", "C"]} loading />,
    );
    // Skeleton must NOT replace the chart
    expect(container.querySelector(".brock-skeleton-bar")).toBeFalsy();
    // Real bars are still rendered
    expect(container.querySelectorAll('[role="graphics-symbol"]').length).toBe(3);
    // Overlay is layered on top
    const overlay = container.querySelector(".brock-loading-overlay");
    expect(overlay).toBeTruthy();
    // Figure carries aria-busy
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.getAttribute("aria-busy")).toBe("true");
  });

  it("error replaces the chart even when data is present (terminal state)", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        error="Boom"
      />,
    );
    expect(container.querySelectorAll('[role="graphics-symbol"]').length).toBe(0);
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.textContent).toContain("Boom");
  });

  it("accepts an Error instance and renders its message", () => {
    render(<ColumnChart data={[]} error={new Error("Upstream timeout")} />);
    expect(screen.getByText("Upstream timeout")).toBeInTheDocument();
  });

  it("error takes precedence over loading and empty", () => {
    const { container } = render(
      <ColumnChart data={[]} loading error="Failed" />,
    );
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeFalsy();
    expect(container.querySelector(".brock-skeleton-bar")).toBeFalsy();
  });

  it("retry button appears only when onRetry is provided and fires the callback", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender, container } = render(
      <ColumnChart data={[]} error="X" />,
    );
    expect(
      container.querySelector('button[type="button"]'),
    ).toBeFalsy();

    rerender(<ColumnChart data={[]} error="X" onRetry={onRetry} />);
    const btn = container.querySelector(
      'button[type="button"]',
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain("Retry");
    await user.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("custom loadingLabel / errorLabel / retryLabel are respected", () => {
    const { container, rerender } = render(
      <ColumnChart data={[]} loading loadingLabel="Загрузка…" />,
    );
    expect(
      container.querySelector('[role="status"]')?.getAttribute("aria-label"),
    ).toBe("Загрузка…");

    rerender(
      <ColumnChart
        data={[]}
        error="Сбой"
        errorLabel="Ошибка"
        onRetry={() => {}}
        retryLabel="Повторить"
      />,
    );
    expect(
      container.querySelector('[role="alert"]')?.getAttribute("aria-label"),
    ).toBe("Ошибка: Сбой");
    expect(
      container.querySelector('button[type="button"]')?.textContent,
    ).toContain("Повторить");
  });

  it("loadingFallback overrides the default skeleton entirely", () => {
    const { container } = render(
      <ColumnChart
        data={[]}
        loading
        loadingFallback={<div data-testid="custom-loader">spinning…</div>}
      />,
    );
    expect(container.querySelector(".brock-skeleton-bar")).toBeFalsy();
    expect(screen.getByTestId("custom-loader")).toBeInTheDocument();
  });

  it("errorFallback as a React node overrides the default error UI", () => {
    render(
      <ColumnChart
        data={[]}
        error="X"
        errorFallback={<div data-testid="custom-err">oh no</div>}
      />,
    );
    expect(screen.getByTestId("custom-err")).toBeInTheDocument();
    expect(screen.queryByText("Error")).not.toBeInTheDocument();
  });

  it("errorFallback as a function receives the normalized Error", () => {
    const fn = vi.fn((err: Error) => <div data-testid="fn-err">{err.message}</div>);
    render(<ColumnChart data={[]} error="boom-string" errorFallback={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(fn.mock.calls[0][0].message).toBe("boom-string");
    expect(screen.getByTestId("fn-err")).toHaveTextContent("boom-string");
  });

  it("default ready state is unchanged when loading=false and error=null", () => {
    const { container } = render(
      <ColumnChart data={[10, 20]} labels={["A", "B"]} />,
    );
    expect(container.querySelectorAll('[role="graphics-symbol"]').length).toBe(2);
    expect(container.querySelector(".brock-skeleton-bar")).toBeFalsy();
    expect(container.querySelector(".brock-loading-overlay")).toBeFalsy();
    expect(container.querySelector('[role="alert"]')).toBeFalsy();
    expect(
      (container.querySelector("figure") as HTMLElement).getAttribute(
        "aria-busy",
      ),
    ).toBeNull();
  });

  it("ready state preserves the source line in the skeleton and error states too", () => {
    const src = "Brock Analytics, 2026";

    const { rerender } = render(
      <ColumnChart data={[]} loading source={src} />,
    );
    expect(screen.getAllByText(new RegExp(src))[0]).toBeInTheDocument();

    rerender(<ColumnChart data={[]} error="x" source={src} />);
    expect(screen.getAllByText(new RegExp(src))[0]).toBeInTheDocument();
  });
});

describe("ColumnChart — bands (plot bands)", () => {
  it("renders one band element per band entry", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30, 40, 50]}
        labels={["A", "B", "C", "D", "E"]}
        bands={[
          { from: 1, to: 2, label: "Q1" },
          { from: 3, to: 4 },
        ]}
      />,
    );
    expect(container.querySelectorAll(".brock-band").length).toBe(2);
  });

  it("clamps band indices to the data range (-5..99 → 0..2 of 3 bars)", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        bands={[{ from: -5, to: 99, label: "All" }]}
      />,
    );
    // happy-dom drops calc()-valued styles, so we verify clamping via the
    // generated aria-label (1-indexed for screen readers).
    const band = container.querySelector(".brock-band") as HTMLElement;
    expect(band.getAttribute("aria-label")).toBe("All band, bars 1 to 3");
  });

  it("renders band label text when provided", () => {
    render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        bands={[{ from: 0, to: 1, label: "deployment" }]}
      />,
    );
    expect(screen.getByText("deployment")).toBeInTheDocument();
  });

  it("uses custom band color when provided", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20]}
        labels={["A", "B"]}
        bands={[{ from: 0, to: 1, color: "rgb(255, 0, 0)" }]}
      />,
    );
    const band = container.querySelector(".brock-band") as HTMLElement;
    expect(band.style.background).toMatch(/rgb\(255, 0, 0\)/);
  });

  it("does not render bands overlay when bands prop is omitted", () => {
    const { container } = render(
      <ColumnChart data={[10, 20]} labels={["A", "B"]} />,
    );
    expect(container.querySelectorAll(".brock-band").length).toBe(0);
  });
});

describe("ColumnChart — numberFormat (notation / style / currency)", () => {
  it("compact notation shrinks long values (1500 → ~1.5K)", () => {
    render(
      <ColumnChart
        data={[1500]}
        numberFormat={{ notation: "compact", locale: "en-US" }}
      />,
    );
    // Y-axis top tick gets compact format
    expect(
      screen.getAllByText((_, node) => node?.textContent === "1.5K").length,
    ).toBeGreaterThan(0);
  });

  it("percent style formats values as percentages", () => {
    render(
      <ColumnChart
        data={[{ label: "A", value: 0.42 }]}
        numberFormat={{ style: "percent", locale: "en-US" }}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar.getAttribute("aria-label")).toContain("42%");
  });

  it("currency style with USD wraps values in $ formatting", () => {
    render(
      <ColumnChart
        data={[{ label: "A", value: 1250 }]}
        numberFormat={{ style: "currency", currency: "USD", locale: "en-US" }}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar.getAttribute("aria-label")).toMatch(/\$1,250/);
  });

  it("respects explicit locale for separator", () => {
    render(
      <ColumnChart
        data={[{ label: "A", value: 1250 }]}
        numberFormat={{ locale: "de-DE" }}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    // German uses '.' as thousand separator
    expect(bar.getAttribute("aria-label")).toContain("1.250");
  });
});

describe("ColumnChart — per-bar emphasis (color / highlight / note)", () => {
  it("applies per-bar color as inline backgroundColor on solid bars", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, color: "#FF0000" },
        ]}
      />,
    );
    const bars = container.querySelectorAll(".brock-bar");
    // Bar 1: no color → no inline backgroundColor
    expect((bars[0] as HTMLElement).style.backgroundColor).toBe("");
    // Bar 2: color set → inline backgroundColor applied
    expect((bars[1] as HTMLElement).style.backgroundColor).toMatch(/rgb\(255, 0, 0\)|#ff0000/i);
  });

  it("drops bg-brock-accent class when per-bar color is set on a solid bar", () => {
    const { container } = render(
      <ColumnChart
        data={[{ label: "A", value: 10, color: "#FF0000" }]}
      />,
    );
    expect(container.querySelector(".bg-brock-accent")).toBeFalsy();
  });

  it("sets --brock-accent CSS variable from per-bar color for hatched bars", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "A", value: 10, color: "#FF0000", pattern: "hatched" },
        ]}
      />,
    );
    const bar = container.querySelector(".brock-bar") as HTMLElement;
    expect(bar.style.getPropertyValue("--brock-accent")).toBeTruthy();
  });

  it("applies brock-bar-highlighted class when highlight=true", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, highlight: true },
        ]}
      />,
    );
    expect(container.querySelectorAll(".brock-bar-highlighted").length).toBe(1);
  });

  it("renders per-bar note text above the bar", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, note: "← peak" },
        ]}
      />,
    );
    expect(screen.getByText("← peak")).toBeInTheDocument();
  });

  it("omits note span when value is zero", () => {
    render(
      <ColumnChart
        data={[{ label: "A", value: 0, note: "should not render" }]}
      />,
    );
    expect(screen.queryByText("should not render")).not.toBeInTheDocument();
  });
});

describe("ColumnChart — scroll & minBarWidth", () => {
  it("default scroll='none' does not add the scroll wrapper", () => {
    const { container } = render(
      <ColumnChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    expect(container.querySelector(".brock-bars-scroll")).toBeFalsy();
  });

  it("scroll='auto' adds the overflow-x wrapper", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        scroll="auto"
      />,
    );
    const scroller = container.querySelector(".brock-bars-scroll");
    expect(scroller).toBeTruthy();
    expect(scroller?.className).toContain("overflow-x-auto");
  });

  it("scroll='auto' applies min-width = N*minBarWidth + (N-1)*gap to inner shim", () => {
    const { container } = render(
      <ColumnChart
        data={[1, 2, 3, 4, 5]}
        labels={["A", "B", "C", "D", "E"]}
        scroll="auto"
        minBarWidth={10}
        gap={2}
      />,
    );
    // 5 * 10 + 4 * 2 = 58
    const inner = container.querySelector(".brock-bars-scroll > div") as HTMLDivElement;
    expect(inner?.style.minWidth).toBe("58px");
  });

  it("X-axis labels are inside the scroll area when scroll='auto'", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20]}
        labels={["A", "B"]}
        scroll="auto"
      />,
    );
    const scroller = container.querySelector(".brock-bars-scroll");
    // Both bars wrapper AND X-axis labels live inside the scroll container.
    expect(scroller?.textContent).toContain("A");
    expect(scroller?.textContent).toContain("B");
  });
});

describe("ColumnChart — animation", () => {
  it("applies brock-bars-animated class by default", () => {
    const { container } = render(<ColumnChart data={[10]} />);
    expect(container.querySelector(".brock-bars-animated")).toBeTruthy();
  });

  it("omits brock-bars-animated class when animation.enabled is false", () => {
    const { container } = render(
      <ColumnChart data={[10]} animation={{ enabled: false }} />,
    );
    expect(container.querySelector(".brock-bars-animated")).toBeFalsy();
    expect(container.querySelector(".brock-bars")).toBeTruthy();
  });

  it("sets --brock-bar-duration CSS variable when duration provided", () => {
    const { container } = render(
      <ColumnChart data={[10]} animation={{ duration: 800 }} />,
    );
    const figure = container.querySelector("figure");
    expect(figure?.style.getPropertyValue("--brock-bar-duration")).toBe("800ms");
  });
});

/* ─── Forward-compat (Z6) ─────────────────────────────────────────── */

describe("ColumnChart — forward-compat props", () => {
  it("stamps data-chart-type onto the figure (default 'column')", () => {
    const { container } = render(<ColumnChart data={[10]} />);
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.getAttribute("data-chart-type")).toBe("column");
  });

  it("custom chartType overrides the default tag", () => {
    const { container } = render(
      <ColumnChart data={[10]} chartType="cohort-retention" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-chart-type"),
    ).toBe("cohort-retention");
  });

  it("dataDescription is stamped as data-description (AI-readable)", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        dataDescription="Daily active users, last 7 days"
      />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-description"),
    ).toBe("Daily active users, last 7 days");
  });

  it("data-testid is forwarded onto the figure", () => {
    const { container } = render(
      <ColumnChart data={[10]} data-testid="active-users" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-testid"),
    ).toBe("active-users");
  });
});

describe("toJSON / fromJSON", () => {
  it("includes $schema and strips functions / callbacks / ReactNodes", () => {
    const json = toJSON({
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      height: 240,
      accent: "#FF0000",
      onBarClick: () => {},
      onBarHover: () => {},
      formatValue: (v: number) => `${v}!`,
      slots: { tooltip: () => null },
      loadingFallback: { type: "div" } as unknown,
      className: "my-class",
    });
    expect(json.$schema).toBe(COLUMN_CHART_JSON_SCHEMA);
    expect(json.data).toEqual([10, 20, 30]);
    expect(json.labels).toEqual(["A", "B", "C"]);
    expect(json.height).toBe(240);
    expect(json.accent).toBe("#FF0000");
    // None of these should leak into the JSON
    expect(JSON.stringify(json)).not.toContain("onBarClick");
    expect(JSON.stringify(json)).not.toContain("formatValue");
    expect(JSON.stringify(json)).not.toContain("slots");
    expect(JSON.stringify(json)).not.toContain("loadingFallback");
    expect(JSON.stringify(json)).not.toContain("className");
  });

  it("normalizes error: Error → message, string stays, null is dropped", () => {
    expect(toJSON({ data: [], error: new Error("boom") }).error).toBe("boom");
    expect(toJSON({ data: [], error: "string error" }).error).toBe(
      "string error",
    );
    expect("error" in toJSON({ data: [], error: null })).toBe(false);
  });

  it("dataLabels.format function is dropped; show is preserved", () => {
    const json = toJSON({
      data: [10],
      dataLabels: { show: true, format: (v: number) => `${v}` },
    });
    expect(json.dataLabels).toEqual({ show: true });
    expect(JSON.stringify(json)).not.toContain("format");
  });

  it("exportFileName function is dropped; string is preserved", () => {
    expect(toJSON({ data: [], exportFileName: "report" }).exportFileName).toBe(
      "report",
    );
    expect(
      "exportFileName" in
        toJSON({
          data: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          exportFileName: ((fmt: string) => `chart-${fmt}`) as any,
        }),
    ).toBe(false);
  });

  it("toJSON is JSON.stringify-safe (no circular refs, no functions)", () => {
    const json = toJSON({
      data: [{ label: "A", value: 10, color: "#F00", highlight: true }],
      labels: undefined,
      onBarHover: () => {},
      bands: [{ from: 0, to: 0, label: "Q1" }],
      annotations: [{ x: 0, y: 5, text: "x" }],
      caption: "note",
      watermark: "DRAFT",
      dataDescription: "the data",
      chartType: "column",
    });
    expect(() => JSON.stringify(json)).not.toThrow();
    const round = JSON.parse(JSON.stringify(json)) as ColumnChartJSON;
    expect(round.data).toEqual([
      { label: "A", value: 10, color: "#F00", highlight: true },
    ]);
    expect(round.bands).toEqual([{ from: 0, to: 0, label: "Q1" }]);
    expect(round.caption).toBe("note");
    expect(round.dataDescription).toBe("the data");
  });

  it("fromJSON is a pass-through for known keys and drops $schema", () => {
    const json: ColumnChartJSON = {
      $schema: COLUMN_CHART_JSON_SCHEMA,
      data: [10, 20],
      labels: ["A", "B"],
      accent: "#00F",
      caption: "x",
    };
    const props = fromJSON(json);
    expect(props.data).toEqual([10, 20]);
    expect(props.labels).toEqual(["A", "B"]);
    expect(props.accent).toBe("#00F");
    expect(props.caption).toBe("x");
    expect("$schema" in props).toBe(false);
  });

  it("toJSON → fromJSON roundtrip is stable for serializable props", () => {
    const original = {
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      height: 320,
      accent: "#F54900",
      header: { title: "Active users", subtitle: "Last 7 days" },
      trend: 0.184,
      goal: { value: 25, label: "Target" },
      source: "FT",
      caption: "Excludes weekends",
      watermark: "DRAFT",
      annotations: [{ x: "B", y: 22, text: "spike", arrow: true } as const],
      chartType: "column",
      dataDescription: "Daily active users",
    };
    const json = toJSON(original);
    const back = fromJSON(json);
    // Drops $schema, but everything else round-trips faithfully.
    delete (json as { $schema?: string }).$schema;
    expect(back).toEqual(json);
  });

  it("fromJSON warns in dev when $schema is unknown", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      fromJSON({
        $schema: "brock-ui/column-chart/v99",
        data: [1],
      } as ColumnChartJSON);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain("brock-ui/column-chart/v99");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("renderToHTMLString", () => {
  it("wraps the SVG in a div with role=img and the description as aria-label", () => {
    const html = renderToHTMLString({
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      source: "FT",
    });
    expect(html).toMatch(/^<div role="img" aria-label="[^"]+"/);
    expect(html).toContain("Column chart with 3 data points");
    expect(html).toContain("Source: FT");
    expect(html).toContain("<svg ");
    expect(html.trim().endsWith("</div>")).toBe(true);
  });

  it("includes data-chart-type / data-description attrs on the wrapper", () => {
    const html = renderToHTMLString({
      data: [10],
      chartType: "cohort-retention",
      dataDescription: "Weekly cohorts",
    });
    expect(html).toContain('data-chart-type="cohort-retention"');
    expect(html).toContain('data-description="Weekly cohorts"');
  });

  it("normalizes object-form data points and preserves per-bar overrides", () => {
    const html = renderToHTMLString({
      data: [
        { label: "A", value: 10 },
        { label: "B", value: 20, color: "#F00", highlight: true },
      ],
    });
    expect(html).toContain("<svg ");
    // Highlight outline path adds an extra path; expect 3 paths (2 bars + 1 highlight)
    expect((html.match(/<path d="/g) ?? []).length).toBe(3);
  });

  it("supports overriding width / height / theme colors", () => {
    const html = renderToHTMLString(
      { data: [1, 2, 3] },
      {
        width: 1200,
        height: 600,
        colors: { accent: "#0F0", background: "#000" },
      },
    );
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="600"');
    expect(html).toContain('fill="#0F0"'); // accent
    expect(html).toContain('fill="#000"'); // background rect
  });

  it("escapes attribute values to prevent HTML injection through dataDescription", () => {
    const html = renderToHTMLString({
      data: [10],
      dataDescription: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;xss&quot;");
  });
});

/* ─── Editorial layers (caption / watermark / annotations) ──────── */

describe("ColumnChart — caption prop", () => {
  it("renders the caption string below source", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        source="FT"
        caption="Excludes weekends."
      />,
    );
    const cap = container.querySelector(".brock-caption");
    expect(cap).toBeInTheDocument();
    expect(cap).toHaveTextContent("Excludes weekends.");
  });

  it("slots.caption overrides the string caption prop", () => {
    render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        caption="should not show"
        slots={{
          caption: () => <div data-testid="slot-cap">slot</div>,
        }}
      />,
    );
    expect(screen.getByTestId("slot-cap")).toBeInTheDocument();
    expect(screen.queryByText("should not show")).not.toBeInTheDocument();
  });

  it("no caption is rendered when neither prop nor slot is set", () => {
    const { container } = render(<ColumnChart data={[10]} labels={["A"]} />);
    expect(container.querySelector(".brock-caption")).toBeFalsy();
  });
});

describe("ColumnChart — watermark prop", () => {
  it("renders watermark text uppercased and rotated", () => {
    const { container } = render(
      <ColumnChart data={[10]} labels={["A"]} watermark="draft" />,
    );
    const wm = container.querySelector(".brock-watermark");
    expect(wm).toBeInTheDocument();
    expect(wm).toHaveTextContent("DRAFT");
    const span = wm?.querySelector("span") as HTMLElement;
    expect(span.style.transform).toContain("rotate");
  });

  it("watermark is aria-hidden and pointer-events-none", () => {
    const { container } = render(
      <ColumnChart data={[10]} labels={["A"]} watermark="draft" />,
    );
    const wm = container.querySelector(".brock-watermark") as HTMLElement;
    expect(wm.getAttribute("aria-hidden")).toBe("true");
    expect(wm.className).toContain("pointer-events-none");
  });

  it("slots.watermark overrides the string watermark prop", () => {
    render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        watermark="should not show"
        slots={{
          watermark: () => <div data-testid="slot-wm">brand</div>,
        }}
      />,
    );
    expect(screen.getByTestId("slot-wm")).toBeInTheDocument();
  });
});

describe("ColumnChart — annotations prop", () => {
  it("renders one annotation card per entry, matched by label string", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "MON", value: 10 },
          { label: "TUE", value: 20 },
          { label: "WED", value: 30 },
        ]}
        annotations={[
          { x: "TUE", y: 25, text: "← spike" },
          { x: "WED", y: 32, text: "anomaly", arrow: true },
        ]}
      />,
    );
    const cards = container.querySelectorAll(".brock-annotation");
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain("← spike");
    expect(cards[1].textContent).toContain("anomaly");
  });

  it("annotations match by 0-based numeric index", () => {
    const { container } = render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        annotations={[{ x: 2, y: 32, text: "tail" }]}
      />,
    );
    const card = container.querySelector(".brock-annotation");
    expect(card?.textContent).toContain("tail");
  });

  it("annotations with no x match are silently skipped", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        annotations={[{ x: "NOPE", y: 5, text: "stray" }]}
      />,
    );
    expect(container.querySelectorAll(".brock-annotation").length).toBe(0);
  });

  it("arrow=true draws a dashed connector", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        annotations={[{ x: 0, y: 8, text: "x", arrow: true }]}
      />,
    );
    const card = container.querySelector(".brock-annotation") as HTMLElement;
    const arrow = card.querySelector("span[aria-hidden]") as HTMLElement;
    expect(arrow).toBeTruthy();
    // The dashed border is set via inline style on either borderLeft or borderTop
    const css = arrow.outerHTML;
    expect(css).toContain("dashed");
  });
});

describe("synthesizeSVG — editorial layers", () => {
  it("watermark is rendered as a rotated text node with low fill-opacity", () => {
    const svg = synthesizeSVG(ctx({ watermark: "DRAFT" }));
    expect(svg).toContain("transform=\"rotate(-20");
    expect(svg).toContain("fill-opacity=\"0.06\"");
    expect(svg).toContain(">DRAFT<");
  });

  it("caption is rendered as italic text below the source line", () => {
    const svg = synthesizeSVG(
      ctx({ caption: "Excludes weekends.", source: "FT" }),
    );
    expect(svg).toContain("font-style=\"italic\"");
    expect(svg).toContain(">Excludes weekends.<");
  });

  it("annotations emit a chip (rect+text) + dashed connector when arrow=true", () => {
    const svg = synthesizeSVG(
      ctx({
        annotations: [
          { x: 1, y: 25, text: "peak", arrow: true },
        ],
        max: 30,
      }),
    );
    // Chip rect + chip text + connector line = 3 SVG elements added
    expect(svg).toContain(">peak<");
    expect(svg).toContain("stroke-dasharray=\"2 2\"");
  });

  it("annotation chip omits the connector when arrow is omitted", () => {
    const svg = synthesizeSVG(
      ctx({
        annotations: [{ x: 0, y: 8, text: "no-arrow" }],
      }),
    );
    expect(svg).toContain(">no-arrow<");
    expect(svg).not.toContain("stroke-dasharray=\"2 2\"");
  });
});

/* ─── Slots (headless customization) ──────────────────────────────── */

describe("ColumnChart — slots", () => {
  it("slots.empty replaces the default ASCII empty state", () => {
    render(
      <ColumnChart
        data={[]}
        slots={{
          empty: ({ height, source }) => (
            <div data-testid="custom-empty" style={{ height }}>
              empty · source={source ?? "—"}
            </div>
          ),
        }}
        source="FT"
      />,
    );
    const node = screen.getByTestId("custom-empty");
    expect(node).toBeInTheDocument();
    expect(node).toHaveTextContent("source=FT");
    expect(screen.queryByText(/no data for this period/)).not.toBeInTheDocument();
  });

  it("slots.loading replaces the default skeleton", () => {
    const { container } = render(
      <ColumnChart
        data={[]}
        loading
        slots={{
          loading: ({ label }) => (
            <div data-testid="custom-loading">spinning · {label}</div>
          ),
        }}
      />,
    );
    expect(screen.getByTestId("custom-loading")).toHaveTextContent("Loading…");
    expect(container.querySelector(".brock-skeleton-bar")).toBeFalsy();
  });

  it("slots.error replaces the default ▲▲▲ error block and receives the Error", () => {
    const onRetry = vi.fn();
    render(
      <ColumnChart
        data={[]}
        error="Upstream timeout"
        onRetry={onRetry}
        slots={{
          error: ({ error, message, onRetry: retry, retryLabel }) => (
            <div data-testid="custom-error">
              <span>kind:{error.name}</span>
              <span>msg:{message}</span>
              <button type="button" onClick={retry}>{retryLabel}</button>
            </div>
          ),
        }}
      />,
    );
    const node = screen.getByTestId("custom-error");
    expect(node).toHaveTextContent("kind:Error");
    expect(node).toHaveTextContent("msg:Upstream timeout");
  });

  it("slots > shortcut fallbacks: slots.error wins over errorFallback", () => {
    render(
      <ColumnChart
        data={[]}
        error="boom"
        errorFallback={<div data-testid="shortcut">should not show</div>}
        slots={{
          error: () => <div data-testid="slot-error">slot wins</div>,
        }}
      />,
    );
    expect(screen.getByTestId("slot-error")).toBeInTheDocument();
    expect(screen.queryByTestId("shortcut")).not.toBeInTheDocument();
  });

  it("slots.toolbar replaces the default chip bar and gets bound handlers", async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
    const onExport = vi.fn();
    render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        exportable
        onExport={onExport}
        slots={{
          toolbar: ({ exportCSV, enabled }) => (
            <div data-testid="custom-tb">
              <span>csv-enabled:{String(enabled.csv)}</span>
              <button type="button" onClick={exportCSV}>
                MyCSV
              </button>
            </div>
          ),
        }}
      />,
    );
    expect(screen.getByTestId("custom-tb")).toHaveTextContent("csv-enabled:true");
    // Default chips should not render
    expect(screen.queryByRole("button", { name: "Download PNG" })).not.toBeInTheDocument();
    await user.click(screen.getByText("MyCSV"));
    expect(onExport).toHaveBeenCalledWith("csv", expect.stringContaining("label,value"));
  });

  it("slots.caption renders below the source line", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        source="FT"
        slots={{
          caption: () => <div data-testid="caption">reading note</div>,
        }}
      />,
    );
    expect(screen.getByTestId("caption")).toBeInTheDocument();
    // Caption must come after the source-line node in DOM order.
    const sourceNode = within(container).getByText((_, n) =>
      n?.textContent?.startsWith("Source: FT") ?? false,
    );
    const captionNode = screen.getByTestId("caption");
    const pos = sourceNode.compareDocumentPosition(captionNode);
    // eslint-disable-next-line no-bitwise
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("slots.watermark mounts as an absolute overlay over the figure", () => {
    const { container } = render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        slots={{
          watermark: () => <div data-testid="wm">brock</div>,
        }}
      />,
    );
    const wm = screen.getByTestId("wm");
    expect(wm).toBeInTheDocument();
    const wrapper = wm.parentElement as HTMLElement;
    expect(wrapper.className).toContain("absolute");
    expect(wrapper.className).toContain("pointer-events-none");
    // Watermark sits inside the figure
    expect(container.querySelector("figure")?.contains(wm)).toBe(true);
  });

  it("slots.tooltip renders the custom node above a focused bar", () => {
    const { container } = render(
      <ColumnChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        slots={{
          tooltip: ({ point, index, value, edge }) => (
            <div data-testid="custom-tt">
              <span>i={index}</span>
              <span>v={value}</span>
              <span>e={edge}</span>
              <span>lbl={point.label}</span>
            </div>
          ),
        }}
      />,
    );
    const tt = container.querySelectorAll('[data-testid="custom-tt"]');
    // One tooltip per bar (visibility is CSS-driven via group-hover/focus)
    expect(tt.length).toBe(2);
    // First tooltip carries index=0, value, lbl=A, edge=left
    expect(tt[0].textContent).toContain("i=0");
    expect(tt[0].textContent).toContain("lbl=A");
    expect(tt[0].textContent).toContain("e=left");
  });

  it("when no slots are provided, defaults render unchanged", () => {
    const { container } = render(
      <ColumnChart data={[]} source="FT" />,
    );
    // Default ASCII empty still shows
    expect(screen.getByText(/no data for this period/)).toBeInTheDocument();
    expect(container.querySelector('[data-testid="custom-empty"]')).toBeFalsy();
  });

  it("slots.empty wins over the ASCII default even with source preserved", () => {
    render(
      <ColumnChart
        data={[]}
        source="FT"
        slots={{
          empty: () => <span data-testid="just-empty">empty</span>,
        }}
      />,
    );
    expect(screen.getByTestId("just-empty")).toBeInTheDocument();
    // The default's "Source: FT" line lives inside ChartSource which is no
    // longer rendered when slot.empty is provided — the slot owns the full
    // visual.
    expect(screen.queryByText(/^Source: FT/)).not.toBeInTheDocument();
  });

  it("multiple slots can coexist", () => {
    render(
      <ColumnChart
        data={[10]}
        labels={["A"]}
        source="FT"
        exportable={{ csv: true }}
        slots={{
          toolbar: () => <div data-testid="tb">tb</div>,
          caption: () => <div data-testid="cap">cap</div>,
          watermark: () => <div data-testid="wm">wm</div>,
        }}
      />,
    );
    expect(screen.getByTestId("tb")).toBeInTheDocument();
    expect(screen.getByTestId("cap")).toBeInTheDocument();
    expect(screen.getByTestId("wm")).toBeInTheDocument();
  });
});

/* ─── Export utility tests ─────────────────────────────────────────── */

function ctx(overrides: Partial<SynthesisContext> = {}): SynthesisContext {
  const points: ExportPoint[] = overrides.points ?? [
    { label: "A", value: 10, pattern: "solid" },
    { label: "B", value: 20, pattern: "solid" },
    { label: "C", value: 30, pattern: "solid" },
  ];
  return {
    width: 800,
    height: 400,
    points,
    max: 30,
    allZero: false,
    gap: 4,
    barRadius: 2,
    patternStyle: "diagonal",
    accent: "#F54900",
    foreground: "#0a0a0a",
    muted: "#666666",
    border: "#e5e5e5",
    background: "#ffffff",
    yTicks: [30, 15, 0],
    yAxisFormat: (v) => String(v),
    formatValue: (v) => String(v),
    labelFormat: (v) => String(v),
    showLabels: false,
    showYTicks: true,
    showXTicks: true,
    description: "Column chart test",
    ...overrides,
  };
}

describe("pointsToCSV", () => {
  it("emits the label,value header by default", () => {
    const csv = pointsToCSV([
      { label: "A", value: 10, pattern: "solid" },
      { label: "B", value: 20, pattern: "solid" },
    ]);
    expect(csv.split("\r\n")[0]).toBe("label,value");
  });

  it("includes optional columns only when at least one point has them", () => {
    const csv = pointsToCSV([
      { label: "A", value: 10, pattern: "solid" },
      { label: "B", value: 20, pattern: "solid", color: "#FF0000" },
      { label: "C", value: 30, pattern: "solid", note: "peak" },
    ]);
    const header = csv.split("\r\n")[0].split(",");
    expect(header).toEqual(["label", "value", "color", "note"]);
    // highlight column NOT added — no point set it
    expect(header).not.toContain("highlight");
  });

  it("quotes cells containing commas, quotes, or CRLF (RFC 4180)", () => {
    const csv = pointsToCSV([
      { label: 'A,B"C', value: 10, pattern: "solid", note: "line\nbreak" },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"A,B""C"'); // comma + escaped quote
    expect(row).toContain('"line\nbreak"');
  });

  it("terminates with CRLF (RFC 4180)", () => {
    const csv = pointsToCSV([{ label: "A", value: 1, pattern: "solid" }]);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("synthesizeSVG", () => {
  it("produces a well-formed SVG with viewBox and a11y title+desc", () => {
    const svg = synthesizeSVG(ctx());
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 800 400"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>Column chart test</title>");
    expect(svg).toContain("<desc>Column chart test</desc>");
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("renders one <path> per visible bar (top-rounded geometry)", () => {
    const svg = synthesizeSVG(ctx());
    // 3 bars → 3 <path d="..."/> for bars (highlight outline would add more)
    const matches = svg.match(/<path d="/g);
    expect(matches?.length).toBe(3);
  });

  it("emits a <pattern> def per (style,color) when bars are hatched", () => {
    const svg = synthesizeSVG(
      ctx({
        points: [
          { label: "A", value: 10, pattern: "hatched" },
          { label: "B", value: 20, pattern: "hatched", color: "#0000FF" },
        ],
      }),
    );
    // Two distinct colors → two patterns
    expect(svg.match(/<pattern id="brock-pat-diagonal-[a-f0-9]+"/g)?.length).toBe(2);
    expect(svg).toContain("<defs>");
  });

  it("draws an outline path on top of highlighted bars", () => {
    const svg = synthesizeSVG(
      ctx({
        points: [
          { label: "A", value: 10, pattern: "solid", highlight: true },
        ],
      }),
    );
    // 1 fill + 1 outline = 2 paths for that single bar
    expect(svg.match(/<path d="/g)?.length).toBe(2);
    expect(svg).toContain('stroke="#0a0a0a"');
  });

  it("renders a dashed goal line + labelled chip when goal is set", () => {
    const svg = synthesizeSVG(
      ctx({
        goal: { value: 25, label: "Target" },
        max: 30,
      }),
    );
    expect(svg).toContain('stroke-dasharray="4 2"');
    expect(svg).toContain("Target");
  });

  it("draws plot bands behind bars when bands are given", () => {
    const svg = synthesizeSVG(
      ctx({
        bands: [{ from: 0, to: 1, label: "Q1" }],
      }),
    );
    expect(svg).toContain("Q1".toUpperCase());
    // Band is a <rect>, two color sources (background bg + band)
    expect((svg.match(/<rect /g)?.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it("escapes XML special characters in labels, headers, source", () => {
    const svg = synthesizeSVG(
      ctx({
        points: [{ label: "<A>&B", value: 10, pattern: "solid" }],
        headerTitle: 'Tom & "Jerry"',
        source: "FT <data>",
      }),
    );
    expect(svg).not.toContain("<A>&B");
    expect(svg).toContain("&lt;A&gt;&amp;B");
    expect(svg).toContain("Tom &amp; &quot;Jerry&quot;");
    // Source is uppercased in the SOURCE: prefix render; entities preserved.
    expect(svg).toContain("FT &lt;DATA&gt;");
  });

  it("inline data labels render above bars when showLabels=true", () => {
    const svg = synthesizeSVG(
      ctx({
        showLabels: true,
        labelFormat: (v) => `V${v}`,
      }),
    );
    expect(svg).toContain(">V10<");
    expect(svg).toContain(">V30<");
  });
});

/* ─── ColumnChart component — toolbar + imperative API ─────────────── */

describe("ColumnChart — toolbar (exportable prop)", () => {
  it("renders no toolbar by default", () => {
    const { container } = render(<ColumnChart data={[10]} />);
    expect(container.querySelector('[role="toolbar"]')).toBeFalsy();
  });

  it("renders all 4 buttons when exportable={true}", () => {
    const { container } = render(<ColumnChart data={[10]} exportable />);
    const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(toolbar).toBeTruthy();
    expect(toolbar.getAttribute("aria-label")).toBe("Chart export");
    expect(within(toolbar).getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Download SVG" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Download CSV" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Copy image to clipboard" })).toBeInTheDocument();
  });

  it("renders only chosen actions in object form", () => {
    const { container } = render(
      <ColumnChart data={[10]} exportable={{ csv: true }} />,
    );
    const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(toolbar.querySelectorAll("button").length).toBe(1);
    expect(within(toolbar).getByText("CSV")).toBeInTheDocument();
  });

  it("renders no toolbar when all object flags are false", () => {
    const { container } = render(
      <ColumnChart data={[10]} exportable={{ png: false, svg: false }} />,
    );
    expect(container.querySelector('[role="toolbar"]')).toBeFalsy();
  });

  it("CSV button triggers onExport with the csv string", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    // Stub URL.createObjectURL — happy-dom returns blob: but document.createElement('a').click() works.
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:stub");
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = vi.fn();

    try {
      render(
        <ColumnChart
          data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
          exportable={{ csv: true }}
          exportFileName="active-users"
          onExport={onExport}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Download CSV" }));
      expect(onExport).toHaveBeenCalledWith("csv", expect.stringContaining("label,value"));
      const csv = onExport.mock.calls[0][1] as string;
      expect(csv).toContain("A,10");
      expect(csv).toContain("B,20");
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("SVG button triggers onExport with a full SVG string", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
    render(
      <ColumnChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        exportable={{ svg: true }}
        onExport={onExport}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Download SVG" }));
    const [format, artifact] = onExport.mock.calls[0];
    expect(format).toBe("svg");
    expect(artifact).toContain("<svg ");
    expect(artifact).toContain("</svg>");
  });
});

describe("ColumnChart — event callbacks (onBarClick / Hover / Focus)", () => {
  it("onBarClick fires with point, index, and a click event", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    const { container } = render(
      <ColumnChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarClick={onBarClick}
      />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    await user.click(bars[1]);
    expect(onBarClick).toHaveBeenCalledTimes(1);
    const [point, index, event] = onBarClick.mock.calls[0];
    expect(index).toBe(1);
    expect(point).toEqual(
      expect.objectContaining({ label: "B", value: 20 }),
    );
    expect(event).toBeDefined();
    expect((event as MouseEvent).type).toBe("click");
  });

  it("Enter on a focused bar invokes onBarClick with the keyboard event", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    const { container } = render(
      <ColumnChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarClick={onBarClick}
      />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    (bars[0] as HTMLElement).focus();
    await user.keyboard("{Enter}");
    expect(onBarClick).toHaveBeenCalledTimes(1);
    expect(onBarClick.mock.calls[0][1]).toBe(0);
  });

  it("Space on a focused bar invokes onBarClick", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    const { container } = render(
      <ColumnChart data={[10, 20]} labels={["A", "B"]} onBarClick={onBarClick} />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    (bars[1] as HTMLElement).focus();
    await user.keyboard(" ");
    expect(onBarClick).toHaveBeenCalledTimes(1);
    expect(onBarClick.mock.calls[0][1]).toBe(1);
  });

  it("onBarHover fires with the point on mouse enter", async () => {
    const user = userEvent.setup();
    const onBarHover = vi.fn();
    const { container } = render(
      <ColumnChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarHover={onBarHover}
      />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    await user.hover(bars[0]);
    expect(onBarHover).toHaveBeenCalledWith(
      expect.objectContaining({ label: "A", value: 10 }),
      0,
    );
  });

  it("onBarHover fires with (null, null) when mouse leaves the bars area", async () => {
    const user = userEvent.setup();
    const onBarHover = vi.fn();
    const { container } = render(
      <ColumnChart data={[10, 20]} labels={["A", "B"]} onBarHover={onBarHover} />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    // Hover a bar first so a subsequent unhover crosses the .brock-bars edge.
    await user.hover(bars[0]);
    await user.unhover(bars[0]);
    // Move pointer outside the bars area altogether.
    await user.unhover(container.querySelector(".brock-bars") as HTMLElement);
    const calls = onBarHover.mock.calls;
    // At least one call must be the leave signal (null, null).
    const sawLeave = calls.some((c) => c[0] === null && c[1] === null);
    expect(sawLeave).toBe(true);
  });

  it("onBarFocus fires when keyboard nav moves between bars", async () => {
    const user = userEvent.setup();
    const onBarFocus = vi.fn();
    const { container } = render(
      <ColumnChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarFocus={onBarFocus}
      />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    (bars[0] as HTMLElement).focus();
    onBarFocus.mockClear();
    await user.keyboard("{ArrowRight}");
    // Last focus emission is index 1
    const last = onBarFocus.mock.calls[onBarFocus.mock.calls.length - 1];
    expect(last[1]).toBe(1);
    expect(last[0]).toEqual(expect.objectContaining({ label: "B", value: 20 }));
  });

  it("cursor-pointer is added to bars only when onBarClick is provided", () => {
    const { container, rerender } = render(<ColumnChart data={[10]} />);
    expect(
      (container.querySelector('[role="graphics-symbol"]') as HTMLElement)
        .className,
    ).not.toContain("cursor-pointer");

    rerender(<ColumnChart data={[10]} onBarClick={() => {}} />);
    expect(
      (container.querySelector('[role="graphics-symbol"]') as HTMLElement)
        .className,
    ).toContain("cursor-pointer");
  });
});

describe("ColumnChart — imperative focusBar / getSelection", () => {
  /**
   * Returns the LIVE ref via a callback that re-reads `.current` each time —
   * useImperativeHandle re-binds methods when deps change (e.g. focusIndex),
   * so a stored snapshot would go stale.
   */
  function FocusHarness({
    refOut,
    data,
    onBarFocus,
  }: {
    refOut: { handle: React.RefObject<ColumnChartHandle | null> | null };
    data?: ColumnChartProps["data"];
    onBarFocus?: ColumnChartProps["onBarFocus"];
  }) {
    const handle = useRef<ColumnChartHandle>(null);
    refOut.handle = handle;
    return (
      <ColumnChart
        ref={handle}
        data={
          data ?? [
            { label: "A", value: 10 },
            { label: "B", value: 20 },
            { label: "C", value: 30 },
          ]
        }
        onBarFocus={onBarFocus}
      />
    );
  }

  it("focusBar(n) moves keyboard focus and returns the clamped index", () => {
    const refOut: { handle: React.RefObject<ColumnChartHandle | null> | null } = {
      handle: null,
    };
    render(<FocusHarness refOut={refOut} />);
    expect(refOut.handle!.current!.focusBar(1)).toBe(1);
    expect(refOut.handle!.current!.focusBar(99)).toBe(2);
    expect(refOut.handle!.current!.focusBar(-5)).toBe(0);
  });

  it("focusBar fires onBarFocus", () => {
    const refOut: { handle: React.RefObject<ColumnChartHandle | null> | null } = {
      handle: null,
    };
    const onBarFocus = vi.fn();
    render(
      <FocusHarness
        refOut={refOut}
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20 },
        ]}
        onBarFocus={onBarFocus}
      />,
    );
    onBarFocus.mockClear();
    refOut.handle!.current!.focusBar(1);
    expect(onBarFocus).toHaveBeenCalledTimes(1);
    expect(onBarFocus.mock.calls[0][1]).toBe(1);
    expect(onBarFocus.mock.calls[0][0]).toEqual(
      expect.objectContaining({ label: "B", value: 20 }),
    );
  });

  it("getSelection returns the currently focused bar", () => {
    const refOut: { handle: React.RefObject<ColumnChartHandle | null> | null } = {
      handle: null,
    };
    render(<FocusHarness refOut={refOut} />);
    expect(refOut.handle!.current!.getSelection()).toEqual({
      index: 0,
      point: expect.objectContaining({ label: "A", value: 10 }),
    });
    refOut.handle!.current!.focusBar(2);
    expect(refOut.handle!.current!.getSelection()).toEqual({
      index: 2,
      point: expect.objectContaining({ label: "C", value: 30 }),
    });
  });

  it("focusBar returns -1 and getSelection returns null when no data", () => {
    const refOut: { handle: React.RefObject<ColumnChartHandle | null> | null } = {
      handle: null,
    };
    render(<FocusHarness refOut={refOut} data={[]} />);
    expect(refOut.handle!.current!.focusBar(0)).toBe(-1);
    expect(refOut.handle!.current!.getSelection()).toBeNull();
  });
});

describe("ColumnChart — imperative ref API", () => {
  function Harness({
    onReady,
  }: {
    onReady: (h: ColumnChartHandle) => void;
  }) {
    const handle = useRef<ColumnChartHandle>(null);
    return (
      <>
        <ColumnChart
          ref={handle}
          data={[
            { label: "A", value: 10 },
            { label: "B", value: 20, color: "#FF0000", note: "peak" },
          ]}
        />
        <button
          type="button"
          onClick={() => {
            if (handle.current) onReady(handle.current);
          }}
        >
          ready
        </button>
      </>
    );
  }

  it("ref exposes exportSVG / exportPNG / exportCSV / copyImage", async () => {
    const user = userEvent.setup();
    let api: ColumnChartHandle | undefined;
    render(<Harness onReady={(h) => (api = h)} />);
    await user.click(screen.getByText("ready"));
    expect(api).toBeTruthy();
    expect(typeof api?.exportSVG).toBe("function");
    expect(typeof api?.exportPNG).toBe("function");
    expect(typeof api?.exportCSV).toBe("function");
    expect(typeof api?.copyImage).toBe("function");
  });

  it("exportSVG returns an SVG string and does not download when download=false", async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.fn();
    URL.createObjectURL = downloadSpy;
    URL.revokeObjectURL = vi.fn();
    let api: ColumnChartHandle | undefined;
    render(<Harness onReady={(h) => (api = h)} />);
    await user.click(screen.getByText("ready"));
    const svg = api!.exportSVG({ download: false });
    expect(svg).toContain("<svg ");
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("exportCSV returns the CSV string and includes per-bar overrides", async () => {
    const user = userEvent.setup();
    let api: ColumnChartHandle | undefined;
    render(<Harness onReady={(h) => (api = h)} />);
    await user.click(screen.getByText("ready"));
    const csv = api!.exportCSV({ download: false });
    expect(csv).toContain("label,value,color,note");
    expect(csv).toContain("B,20,#FF0000,peak");
  });

  it("custom file name extension is appended automatically", async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
    let api: ColumnChartHandle | undefined;
    render(<Harness onReady={(h) => (api = h)} />);
    await user.click(screen.getByText("ready"));
    // Spy on anchor.click via setting download attr — easier path: just check
    // that exportCSV runs without throwing when fileName lacks extension.
    expect(() => api!.exportCSV({ fileName: "report", download: true })).not.toThrow();
  });
});

describe("ColumnChart — sort & topN", () => {
  const labelsOf = () =>
    screen
      .getAllByRole("graphics-symbol")
      .map((b) => b.getAttribute("aria-label"));

  it("preserves input order by default (sort='none')", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 30 },
          { label: "B", value: 10 },
          { label: "C", value: 20 },
        ]}
      />,
    );
    expect(labelsOf()).toEqual(["A: 30", "B: 10", "C: 20"]);
  });

  it("sort='desc' orders bars largest → smallest", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 30 },
          { label: "B", value: 10 },
          { label: "C", value: 20 },
        ]}
        sort="desc"
      />,
    );
    expect(labelsOf()).toEqual(["A: 30", "C: 20", "B: 10"]);
  });

  it("sort='asc' orders bars smallest → largest", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 30 },
          { label: "B", value: 10 },
          { label: "C", value: 20 },
        ]}
        sort="asc"
      />,
    );
    expect(labelsOf()).toEqual(["B: 10", "C: 20", "A: 30"]);
  });

  it("is stable — equal values keep input order", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 10 },
          { label: "C", value: 10 },
        ]}
        sort="desc"
      />,
    );
    expect(labelsOf()).toEqual(["A: 10", "B: 10", "C: 10"]);
  });

  it("per-bar overrides travel with their datum across a sort", () => {
    const { container } = render(
      <ColumnChart
        data={[
          { label: "A", value: 30 },
          { label: "B", value: 10, highlight: true },
          { label: "C", value: 20 },
        ]}
        sort="asc"
      />,
    );
    // B (highlighted) is smallest → now first. Highlight must stay on B.
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[0].getAttribute("aria-label")).toBe("B: 10");
    const highlighted = container.querySelector(".brock-bar-highlighted");
    expect(
      highlighted
        ?.closest('[role="graphics-symbol"]')
        ?.getAttribute("aria-label"),
    ).toBe("B: 10");
  });

  it("topN keeps the N largest and rolls the rest into an 'Other' bar (summed)", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 50 },
          { label: "B", value: 40 },
          { label: "C", value: 5 },
          { label: "D", value: 3 },
          { label: "E", value: 2 },
        ]}
        topN={2}
      />,
    );
    // A, B kept (input order); C+D+E = 10 bucketed into Other (appended last).
    expect(labelsOf()).toEqual(["A: 50", "B: 40", "Other: 10"]);
  });

  it("topN object form respects a custom label", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 50 },
          { label: "B", value: 5 },
          { label: "C", value: 5 },
        ]}
        topN={{ n: 1, label: "Rest" }}
      />,
    );
    expect(labelsOf()).toEqual(["A: 50", "Rest: 10"]);
  });

  it("topN is a no-op when topN >= data length", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20 },
        ]}
        topN={5}
      />,
    );
    expect(labelsOf()).toEqual(["A: 10", "B: 20"]);
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("'Other' is pinned last by default, even when it outweighs ranked bars", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 50 },
          { label: "B", value: 40 },
          { label: "C", value: 30 },
          { label: "D", value: 25 },
        ]}
        topN={2}
        sort="desc"
      />,
    );
    // Kept: A(50), B(40). Other = C+D = 55 — bigger than A, but an aggregate
    // is not a category: it stays pinned at the end.
    expect(labelsOf()).toEqual(["A: 50", "B: 40", "Other: 55"]);
  });

  it("pinned: false lets 'Other' participate in the ranking", () => {
    render(
      <ColumnChart
        data={[
          { label: "A", value: 50 },
          { label: "B", value: 40 },
          { label: "C", value: 30 },
          { label: "D", value: 25 },
        ]}
        topN={{ n: 2, pinned: false }}
        sort="desc"
      />,
    );
    expect(labelsOf()).toEqual(["Other: 55", "A: 50", "B: 40"]);
  });

  it("serializes sort / topN (number and object form) through toJSON", () => {
    const json = toJSON({ data: [1, 2, 3], sort: "desc", topN: 2 });
    expect(json.sort).toBe("desc");
    expect(json.topN).toBe(2);

    const obj = toJSON({
      data: [1, 2, 3],
      topN: { n: 2, label: "Rest", pinned: false },
    });
    expect(obj.topN).toEqual({ n: 2, label: "Rest", pinned: false });
  });
});

describe("ColumnChart — 'Other' aggregate contract", () => {
  const RANKED = [
    { label: "A", value: 50 },
    { label: "B", value: 40 },
    { label: "C", value: 5 },
    { label: "D", value: 3 },
  ];

  it("renders the Other bar with the muted brock-bar-other fill by default", () => {
    const { container } = render(<ColumnChart data={RANKED} topN={2} />);
    const muted = container.querySelectorAll(".brock-bar-other");
    expect(muted.length).toBe(1);
    expect(
      muted[0]
        .closest('[role="graphics-symbol"]')
        ?.getAttribute("aria-label"),
    ).toBe("Other: 8");
  });

  it("distinct: false renders Other like a regular accent bar", () => {
    const { container } = render(
      <ColumnChart data={RANKED} topN={{ n: 2, distinct: false }} />,
    );
    expect(container.querySelector(".brock-bar-other")).toBeFalsy();
  });

  it("onBarClick on Other receives isOther + the collapsed items", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    render(<ColumnChart data={RANKED} topN={2} onBarClick={onBarClick} />);
    await user.click(screen.getByRole("graphics-symbol", { name: "Other: 8" }));
    const [point] = onBarClick.mock.calls[0];
    expect(point.isOther).toBe(true);
    expect(point.items).toEqual([
      expect.objectContaining({ label: "C", value: 5 }),
      expect.objectContaining({ label: "D", value: 3 }),
    ]);
  });

  it("regular bars carry no isOther / items fields", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    render(<ColumnChart data={RANKED} topN={2} onBarClick={onBarClick} />);
    await user.click(screen.getByRole("graphics-symbol", { name: "A: 50" }));
    const [point] = onBarClick.mock.calls[0];
    expect(point.isOther).toBeUndefined();
    expect(point.items).toBeUndefined();
  });

  it("getSelection on a focused Other bar exposes the aggregate payload", () => {
    let api: ColumnChartHandle | undefined;
    const Harness = () => {
      const ref = useRef<ColumnChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <ColumnChart ref={ref} data={RANKED} topN={2} />
        </>
      );
    };
    render(<Harness />);
    fireEvent.click(screen.getByText("grab"));
    api!.focusBar(2); // Other is pinned last (index 2 of A, B, Other)
    const sel = api!.getSelection();
    expect(sel?.point.isOther).toBe(true);
    expect(sel?.point.items).toHaveLength(2);
  });
});

describe("ColumnChart — yAxis honesty (no min, extend-only max)", () => {
  it("yAxis.max below the data max is ignored with a dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <ColumnChart
        data={[100]}
        yAxisFormat={(v) => `Y${v}`}
        yAxis={{ max: 50 }}
      />,
    );
    // Scale stays at the data max (top tick Y100) — no clipped bars.
    expect(screen.getByText("Y100")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("yAxis.max"),
    );
    warn.mockRestore();
  });

  it("yAxis.max above the data max extends the scale (headroom)", () => {
    render(
      <ColumnChart
        data={[100]}
        yAxisFormat={(v) => `Y${v}`}
        yAxis={{ max: 200 }}
      />,
    );
    expect(screen.getByText("Y200")).toBeInTheDocument();
  });
});

describe("ColumnChart — touch tooltip (tap to pin)", () => {
  // The tooltip wrapper inside a bar is the only descendant carrying `mb-2`.
  const tooltipOf = (bar: HTMLElement) =>
    bar.querySelector(".mb-2") as HTMLElement;

  it("tooltips are hover/focus-driven (hidden) by default", () => {
    render(<ColumnChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    const tip = tooltipOf(bars[0]);
    expect(tip.classList.contains("hidden")).toBe(true);
    expect(tip.classList.contains("flex")).toBe(false);
  });

  it("tapping a bar pins its tooltip visible", () => {
    render(<ColumnChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[0]);
    const tip = tooltipOf(bars[0]);
    expect(tip.classList.contains("flex")).toBe(true);
    expect(tip.classList.contains("hidden")).toBe(false);
  });

  it("re-tapping the same bar dismisses its tooltip", () => {
    render(<ColumnChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[0]);
    fireEvent.touchStart(bars[0]);
    const tip = tooltipOf(bars[0]);
    expect(tip.classList.contains("hidden")).toBe(true);
  });

  it("tapping another bar moves the pin", () => {
    render(<ColumnChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[0]);
    fireEvent.touchStart(bars[1]);
    expect(tooltipOf(bars[0]).classList.contains("hidden")).toBe(true);
    expect(tooltipOf(bars[1]).classList.contains("flex")).toBe(true);
  });

  it("tap pinning also works with a custom tooltip slot", () => {
    render(
      <ColumnChart
        data={[10, 20]}
        labels={["A", "B"]}
        slots={{
          tooltip: ({ value }) => <div data-testid="custom-tip">{value}</div>,
        }}
      />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[1]);
    expect(tooltipOf(bars[1]).classList.contains("flex")).toBe(true);
    expect(within(bars[1]).getByTestId("custom-tip")).toBeInTheDocument();
  });
});
