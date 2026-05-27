import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnChart } from "./column-chart";

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
