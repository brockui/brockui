import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BarChart,
  type BarChartHandle,
  type BarChartProps,
} from "./bar-chart";
import {
  BAR_CHART_JSON_SCHEMA,
  fromJSON,
  pointsToCSV,
  renderToHTMLString,
  synthesizeSVG,
  toJSON,
  type BarChartJSON,
  type ExportPoint,
  type SynthesisContext,
} from "./bar-chart-export";

describe("BarChart — rendering", () => {
  it("renders one bar per data point with numeric form", () => {
    render(<BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(3);
  });

  it("renders one bar per data point with object form", () => {
    render(
      <BarChart
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
      <BarChart
        data={[{ label: "Q1", value: 1248 }]}
        formatValue={(v) => String(v)}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar).toHaveAttribute("aria-label", "Q1: 1248");
  });

  it("falls back to index-based aria-label when no label given", () => {
    render(<BarChart data={[10, 20]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[0]).toHaveAttribute("aria-label", "Bar 1: 10");
    expect(bars[1]).toHaveAttribute("aria-label", "Bar 2: 20");
  });

  it("uses custom formatValue for tooltip and aria-label", () => {
    render(<BarChart data={[1500]} formatValue={(v) => `$${v}`} />);
    const bar = screen.getByRole("graphics-symbol");
    expect(bar).toHaveAttribute("aria-label", "Bar 1: $1500");
  });
});

describe("BarChart — empty + edge cases", () => {
  it("renders ASCII empty state when data is []", () => {
    render(<BarChart data={[]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "No data available for this period",
    );
    expect(screen.queryAllByRole("graphics-symbol")).toHaveLength(0);
  });

  it("renders empty state with source line when source provided", () => {
    render(<BarChart data={[]} source="Acme Analytics" />);
    expect(screen.getByText(/Acme Analytics/)).toBeInTheDocument();
  });

  it("filters NaN and Infinity with console.warn (in dev)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BarChart data={[10, NaN, 20, Infinity, 30]} />);
    expect(screen.getAllByRole("graphics-symbol")).toHaveLength(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("skipped 2 non-finite value(s)"),
    );
    spy.mockRestore();
  });

  it("renders negative values honestly (no clamping, no warning)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BarChart data={[10, -5, 20]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(3);
    expect(bars[1]).toHaveAttribute("aria-label", "Bar 2: -5");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders all-zero data with bars at 0 width and no tooltips", () => {
    const { container } = render(
      <BarChart data={[0, 0, 0]} labels={["A", "B", "C"]} />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars).toHaveLength(3);
    bars.forEach((bar) => {
      expect(bar).toHaveAttribute("aria-label", expect.stringMatching(/: 0$/));
    });
    const fills = container.querySelectorAll(".brock-hbar");
    fills.forEach((f) => {
      expect((f as HTMLElement).style.width).toBe("0%");
    });
    expect(container.querySelector(".brock-hbar-tip")).toBeFalsy();
  });

  it("handles single bar without crashing", () => {
    render(
      <BarChart
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

describe("BarChart — height derivation (no height prop, canon §13)", () => {
  it("derives the bars-area height from N items: N*barThickness + (N-1)*gap", () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    // Defaults: 3 * 24 + 2 * 8 = 88px
    const rows = container.querySelector(".brock-hbar-rows") as HTMLElement;
    expect(rows.style.height).toBe("88px");
  });

  it("respects custom barThickness and gap in the derivation", () => {
    const { container } = render(
      <BarChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        barThickness={30}
        gap={10}
      />,
    );
    // 3 * 30 + 2 * 10 = 110px
    const rows = container.querySelector(".brock-hbar-rows") as HTMLElement;
    expect(rows.style.height).toBe("110px");
  });

  it("each bar row is exactly barThickness tall", () => {
    render(
      <BarChart data={[10, 20]} labels={["A", "B"]} barThickness={32} />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    bars.forEach((bar) => {
      expect((bar as HTMLElement).style.height).toBe("32px");
    });
  });
});

describe("BarChart — label column (canon §13 pre-decision)", () => {
  it("renders category labels in a left column with truncate + full-text title", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "Extraordinarily long category name", value: 10 },
          { label: "B", value: 20 },
        ]}
      />,
    );
    const cells = container.querySelectorAll(".brock-hbar-label");
    expect(cells.length).toBe(2);
    // Full text survives in the title attribute (truncation policy fallback)
    expect(cells[0].getAttribute("title")).toBe(
      "Extraordinarily long category name",
    );
    // The text span carries CSS truncation
    expect(cells[0].querySelector("span")?.className).toContain("truncate");
  });

  it("applies labelWidth as a style (CSS variable on the figure)", () => {
    const { container } = render(
      <BarChart data={[10]} labels={["A"]} labelWidth={120} />,
    );
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.style.getPropertyValue("--brock-hbar-label-width")).toBe(
      "120px",
    );
  });

  it("defaults the label column width to 96px", () => {
    const { container } = render(<BarChart data={[10]} labels={["A"]} />);
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.style.getPropertyValue("--brock-hbar-label-width")).toBe(
      "96px",
    );
  });

  it("hides the label column when yAxis.hideTicks is true (var collapses to 0)", () => {
    const { container } = render(
      <BarChart data={[10]} labels={["A"]} yAxis={{ hideTicks: true }} />,
    );
    expect(container.querySelector(".brock-hbar-label")).toBeFalsy();
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.style.getPropertyValue("--brock-hbar-label-width")).toBe(
      "0px",
    );
  });

  it("omits the label column entirely when no datum has a label", () => {
    const { container } = render(<BarChart data={[10, 20]} />);
    expect(container.querySelector(".brock-hbar-label")).toBeFalsy();
  });

  it("ships container-query rules that clamp/hide the label column", () => {
    const { container } = render(<BarChart data={[10]} labels={["A"]} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("@container (max-width: 420px)");
    expect(css).toContain("@container (max-width: 240px)");
    expect(css).toContain("--brock-hbar-label-width");
  });
});

describe("BarChart — accessibility", () => {
  it("wraps chart in <figure> with aria-labelledby pointing to figcaption", () => {
    const { container } = render(<BarChart data={[10, 20]} source="Acme" />);
    const figure = container.querySelector("figure");
    expect(figure).toHaveAttribute("role", "figure");
    const labelledBy = figure?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const caption = container.querySelector(`#${labelledBy}`);
    expect(caption).toHaveTextContent(
      "Bar chart with 2 data points. Highest: 1 (20); lowest: 0 (10). Source: Acme.",
    );
  });

  it("auto-description handles singular vs plural", () => {
    const { container } = render(<BarChart data={[42]} />);
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${id}`)).toHaveTextContent(
      "Bar chart with 1 data point.",
    );
  });

  it("enriches the auto description with highest/lowest insight", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "Jan", value: 10 },
          { label: "Feb", value: 40 },
          { label: "Mar", value: 25 },
        ]}
        source="Acme"
      />,
    );
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${id}`)).toHaveTextContent(
      "Highest: Feb (40); lowest: Jan (10)",
    );
  });

  it("uses custom description when provided", () => {
    const { container } = render(
      <BarChart data={[10, 20]} description="Revenue by region, FY2026" />,
    );
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${id}`)).toHaveTextContent(
      "Revenue by region, FY2026",
    );
  });

  it("provides sr-only data table summary with one row per bar (full labels)", () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    const table = container.querySelector("table.sr-only");
    expect(table).toBeInTheDocument();
    const caption = within(table as HTMLElement).getByText(/Data table\./);
    expect(caption.tagName).toBe("CAPTION");
    const rows = within(table as HTMLElement).getAllByRole("row");
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("A");
    expect(within(rows[1]).getByRole("cell")).toHaveTextContent("10");
  });

  it("announces sort + topN transformations in the sr-table caption", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "A", value: 50 },
          { label: "B", value: 40 },
          { label: "C", value: 5 },
          { label: "D", value: 3 },
        ]}
        sort="desc"
        topN={2}
      />,
    );
    const caption = container.querySelector("table.sr-only caption");
    expect(caption?.textContent).toContain("Sorted by value, descending.");
    expect(caption?.textContent).toContain(
      '2 categories combined into "Other".',
    );
  });

  it("labels the Other row as an aggregate in the sr-table", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "A", value: 50 },
          { label: "B", value: 5 },
          { label: "C", value: 3 },
        ]}
        topN={1}
      />,
    );
    const rows = within(
      container.querySelector("table.sr-only") as HTMLElement,
    ).getAllByRole("row");
    expect(rows[2]).toHaveTextContent("Other (2 categories combined)");
  });

  it("uses roving tabindex: only one bar tabbable at a time", () => {
    render(<BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[0]).toHaveAttribute("tabindex", "0");
    expect(bars[1]).toHaveAttribute("tabindex", "-1");
    expect(bars[2]).toHaveAttribute("tabindex", "-1");
  });

  it("refresh overlay live region is NOT muted by aria-hidden", () => {
    const { container } = render(
      <BarChart data={[10, 20]} loading loadingLabel="Refreshing" />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Refreshing");
    // No aria-hidden ancestor between the live region and the figure.
    let node: HTMLElement | null = status.parentElement;
    while (node && node !== container) {
      expect(node.getAttribute("aria-hidden")).toBeNull();
      node = node.parentElement;
    }
  });

  it("ships a forced-colors (Windows High Contrast) stylesheet", () => {
    const { container } = render(<BarChart data={[10]} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("forced-colors: active");
    expect(css).toContain("CanvasText");
    expect(css).toContain("GrayText");
  });
});

describe("BarChart — keyboard navigation (↑↓ primary, ←→ also work)", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("Arrow Down moves focus to next bar and updates tabindex", async () => {
    render(<BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(bars[1]);
    expect(bars[1]).toHaveAttribute("tabindex", "0");
    expect(bars[0]).toHaveAttribute("tabindex", "-1");
  });

  it("Arrow Up clamps at first bar (no wraparound)", async () => {
    render(<BarChart data={[10, 20, 30]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(bars[0]);
  });

  it("Arrow Right also moves to the next bar (secondary axis)", async () => {
    render(<BarChart data={[10, 20, 30]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(bars[1]);
  });

  it("Arrow Left also moves to the previous bar (secondary axis)", async () => {
    render(<BarChart data={[10, 20, 30]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[2].focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(bars[1]);
  });

  it("End jumps to last bar, Home jumps back to first", async () => {
    render(<BarChart data={[10, 20, 30, 40, 50]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(bars[4]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(bars[0]);
  });

  it("Arrow Down clamps at last bar (no wraparound)", async () => {
    render(<BarChart data={[10, 20]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    bars[1].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(bars[1]);
  });

  it("Enter on a focused bar invokes onBarClick with the keyboard event", async () => {
    const onBarClick = vi.fn();
    render(
      <BarChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarClick={onBarClick}
      />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    bars[0].focus();
    await user.keyboard("{Enter}");
    expect(onBarClick).toHaveBeenCalledTimes(1);
    expect(onBarClick.mock.calls[0][1]).toBe(0);
  });

  it("Space on a focused bar invokes onBarClick", async () => {
    const onBarClick = vi.fn();
    render(
      <BarChart data={[10, 20]} labels={["A", "B"]} onBarClick={onBarClick} />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    bars[1].focus();
    await user.keyboard(" ");
    expect(onBarClick).toHaveBeenCalledTimes(1);
    expect(onBarClick.mock.calls[0][1]).toBe(1);
  });
});

describe("BarChart — state machine (loading / error / empty / ready)", () => {
  it("loading + no data renders the full skeleton with role=status and aria-busy", () => {
    const { container } = render(<BarChart data={[]} loading />);
    const status = container.querySelector('[role="status"]') as HTMLElement;
    expect(status).toBeTruthy();
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe("Loading…");
    // 7 horizontal ghost bars by default
    expect(container.querySelectorAll(".brock-hbar-skeleton").length).toBe(7);
  });

  it("skeleton ghost rows use barThickness for their height", () => {
    const { container } = render(
      <BarChart data={[]} loading barThickness={30} />,
    );
    const ghost = container.querySelector(".brock-hbar-skeleton") as HTMLElement;
    expect(ghost.style.height).toBe("30px");
  });

  it("loading + populated data renders the chart with an overlay (not the skeleton)", () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} loading />,
    );
    expect(container.querySelector(".brock-hbar-skeleton")).toBeFalsy();
    expect(container.querySelectorAll('[role="graphics-symbol"]').length).toBe(3);
    expect(container.querySelector(".brock-hbar-overlay")).toBeTruthy();
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.getAttribute("aria-busy")).toBe("true");
  });

  it("error replaces the chart even when data is present (terminal state)", () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} error="Boom" />,
    );
    expect(container.querySelectorAll('[role="graphics-symbol"]').length).toBe(0);
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.textContent).toContain("Boom");
  });

  it("accepts an Error instance and renders its message", () => {
    render(<BarChart data={[]} error={new Error("Upstream timeout")} />);
    expect(screen.getByText("Upstream timeout")).toBeInTheDocument();
  });

  it("error takes precedence over loading and empty", () => {
    const { container } = render(<BarChart data={[]} loading error="Failed" />);
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeFalsy();
    expect(container.querySelector(".brock-hbar-skeleton")).toBeFalsy();
  });

  it("retry button appears only when onRetry is provided and fires the callback", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender, container } = render(<BarChart data={[]} error="X" />);
    expect(container.querySelector('button[type="button"]')).toBeFalsy();

    rerender(<BarChart data={[]} error="X" onRetry={onRetry} />);
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
      <BarChart data={[]} loading loadingLabel="Загрузка…" />,
    );
    expect(
      container.querySelector('[role="status"]')?.getAttribute("aria-label"),
    ).toBe("Загрузка…");

    rerender(
      <BarChart
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
      <BarChart
        data={[]}
        loading
        loadingFallback={<div data-testid="custom-loader">spinning…</div>}
      />,
    );
    expect(container.querySelector(".brock-hbar-skeleton")).toBeFalsy();
    expect(screen.getByTestId("custom-loader")).toBeInTheDocument();
  });

  it("errorFallback as a function receives the normalized Error", () => {
    const fn = vi.fn((err: Error) => (
      <div data-testid="fn-err">{err.message}</div>
    ));
    render(<BarChart data={[]} error="boom-string" errorFallback={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(fn.mock.calls[0][0].message).toBe("boom-string");
    expect(screen.getByTestId("fn-err")).toHaveTextContent("boom-string");
  });

  it("default ready state is unchanged when loading=false and error=null", () => {
    const { container } = render(
      <BarChart data={[10, 20]} labels={["A", "B"]} />,
    );
    expect(container.querySelectorAll('[role="graphics-symbol"]').length).toBe(2);
    expect(container.querySelector(".brock-hbar-skeleton")).toBeFalsy();
    expect(container.querySelector(".brock-hbar-overlay")).toBeFalsy();
    expect(container.querySelector('[role="alert"]')).toBeFalsy();
    expect(
      (container.querySelector("figure") as HTMLElement).getAttribute(
        "aria-busy",
      ),
    ).toBeNull();
  });

  it("preserves the source line in the skeleton and error states too", () => {
    const src = "Brock Analytics, 2026";
    const { rerender } = render(<BarChart data={[]} loading source={src} />);
    expect(screen.getAllByText(new RegExp(src))[0]).toBeInTheDocument();

    rerender(<BarChart data={[]} error="x" source={src} />);
    expect(screen.getAllByText(new RegExp(src))[0]).toBeInTheDocument();
  });
});

describe("BarChart — dataLabels 'auto' (editorial mode, X axis inversion)", () => {
  // Value labels are spans anchored to the bar end via a calc() left/right.
  const labelSpans = (text: string) =>
    screen
      .getAllByText(text)
      .filter(
        (el) =>
          (el as HTMLElement).style.left.includes("calc") ||
          (el as HTMLElement).style.right.includes("calc"),
      );

  it("auto with <=8 bars shows labels at bar ends and hides the X tick row", () => {
    const { container } = render(
      <BarChart
        data={[10, 20, 30]}
        xAxisFormat={(v) => `TICK${v}`}
        dataLabels={{ show: "auto", format: (v) => `LBL${v}` }}
      />,
    );
    expect(labelSpans("LBL30")).toHaveLength(1);
    expect(container.querySelector(".brock-hbar-xaxis")).toBeFalsy();
    expect(container.textContent).not.toContain("TICK30");
  });

  it("auto is the DEFAULT (no dataLabels prop needed)", () => {
    const { container } = render(
      <BarChart data={[10, 20]} formatValue={(v) => `VAL${v}`} />,
    );
    expect(labelSpans("VAL20")).toHaveLength(1);
    expect(container.querySelector(".brock-hbar-xaxis")).toBeFalsy();
  });

  it("auto with >8 bars shows no labels and keeps the X tick row", () => {
    const data = Array.from({ length: 12 }, (_, i) => (i + 1) * 10);
    const { container } = render(
      <BarChart
        data={data}
        xAxisFormat={(v) => `TICK${v}`}
        dataLabels={{ show: "auto", format: (v) => `LBL${v}` }}
      />,
    );
    expect(screen.queryByText("LBL120")).not.toBeInTheDocument();
    expect(container.querySelector(".brock-hbar-xaxis")).toBeTruthy();
    expect(container.textContent).toContain("TICK120");
  });

  it("explicit xAxis.hideTicks=false wins over auto-hide", () => {
    const { container } = render(
      <BarChart
        data={[10, 20]}
        xAxisFormat={(v) => `TICK${v}`}
        xAxis={{ hideTicks: false }}
        dataLabels={{ show: "auto" }}
      />,
    );
    expect(container.textContent).toContain("TICK20");
  });

  it("explicit xAxis.hideTicks=true hides ticks even with many bars", () => {
    const data = Array.from({ length: 12 }, (_, i) => (i + 1) * 10);
    const { container } = render(
      <BarChart
        data={data}
        xAxisFormat={(v) => `TICK${v}`}
        xAxis={{ hideTicks: true }}
      />,
    );
    expect(container.querySelector(".brock-hbar-xaxis")).toBeFalsy();
  });

  it("dataLabels.format overrides default formatter for inline labels", () => {
    render(
      <BarChart
        data={[100]}
        formatValue={(v) => `default${v}`}
        dataLabels={{ show: true, format: (v) => `custom${v}` }}
      />,
    );
    expect(screen.getByText("custom100")).toBeInTheDocument();
  });

  it("deep positive bars (>86% of range) flip the label inside in background color", () => {
    render(
      <BarChart
        data={[
          { label: "A", value: 100 },
          { label: "B", value: 40 },
        ]}
        dataLabels={{ show: true, format: (v) => `L${v}` }}
      />,
    );
    // A spans the full range → label flips inside (right-anchored, bg color).
    const deep = labelSpans("L100")[0] as HTMLElement;
    expect(deep.className).toContain("text-background");
    expect(deep.style.right).toContain("calc");
    // B ends at 40% → label sits outside in muted color.
    const shallow = labelSpans("L40")[0] as HTMLElement;
    expect(shallow.className).toContain("text-muted-foreground");
    expect(shallow.style.left).toContain("calc");
  });

  it("deep negative bars flip the label inside too (mirrored)", () => {
    render(
      <BarChart
        data={[
          { label: "A", value: -100 },
          { label: "B", value: 40 },
          { label: "C", value: 100 },
        ]}
        dataLabels={{ show: true, format: (v) => `L${v}` }}
      />,
    );
    // Range 200, baseline at 50%. A ends at 0% (< 14) → flipped inside.
    const deepNeg = labelSpans("L-100")[0] as HTMLElement;
    expect(deepNeg.className).toContain("text-background");
    expect(deepNeg.style.left).toContain("calc");
    // B ends at 70% → outside, muted.
    const shallow = labelSpans("L40")[0] as HTMLElement;
    expect(shallow.className).toContain("text-muted-foreground");
  });
});

describe("BarChart — pattern (hatching)", () => {
  it("applies brock-hbar-hatched class when chart-level pattern is 'hatched'", () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} pattern="hatched" />,
    );
    expect(container.querySelectorAll(".brock-hbar-hatched").length).toBe(3);
  });

  it("defaults to solid (bg-brock-accent) when no pattern is given", () => {
    const { container } = render(<BarChart data={[10]} />);
    expect(container.querySelector(".brock-hbar-hatched")).toBeFalsy();
    expect(container.querySelector(".bg-brock-accent")).toBeTruthy();
  });

  it("per-point pattern overrides chart-level pattern", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "A", value: 10, pattern: "hatched" },
          { label: "B", value: 20 },
        ]}
        pattern="solid"
      />,
    );
    expect(container.querySelectorAll(".brock-hbar-hatched").length).toBe(1);
  });

  it("patternStyle defaults to 'diagonal' and is switchable (class on wrapper)", () => {
    const { container, rerender } = render(
      <BarChart data={[10]} pattern="hatched" />,
    );
    expect(
      container.querySelector(".brock-hbars-pattern-diagonal"),
    ).toBeTruthy();

    rerender(<BarChart data={[10]} pattern="hatched" patternStyle="dots" />);
    expect(container.querySelector(".brock-hbars-pattern-dots")).toBeTruthy();
    expect(
      container.querySelector(".brock-hbars-pattern-diagonal"),
    ).toBeFalsy();
  });
});

describe("BarChart — per-bar emphasis (color / highlight / note)", () => {
  it("applies per-bar color as inline backgroundColor on solid bars", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, color: "#FF0000" },
        ]}
      />,
    );
    const bars = container.querySelectorAll(".brock-hbar");
    expect((bars[0] as HTMLElement).style.backgroundColor).toBe("");
    expect((bars[1] as HTMLElement).style.backgroundColor).toMatch(
      /rgb\(255, 0, 0\)|#ff0000/i,
    );
  });

  it("sets --brock-accent CSS variable from per-bar color for hatched bars", () => {
    const { container } = render(
      <BarChart
        data={[{ label: "A", value: 10, color: "#FF0000", pattern: "hatched" }]}
      />,
    );
    const bar = container.querySelector(".brock-hbar") as HTMLElement;
    expect(bar.style.getPropertyValue("--brock-accent")).toBeTruthy();
  });

  it("applies brock-hbar-highlighted class when highlight=true", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, highlight: true },
        ]}
      />,
    );
    expect(container.querySelectorAll(".brock-hbar-highlighted").length).toBe(1);
  });

  it("renders per-bar note text at the bar end (beyond the value label)", () => {
    render(
      <BarChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20, note: "← leader" },
        ]}
      />,
    );
    expect(screen.getByText("← leader")).toBeInTheDocument();
  });

  it("omits note span when value is zero", () => {
    render(
      <BarChart data={[{ label: "A", value: 0, note: "should not render" }]} />,
    );
    expect(screen.queryByText("should not render")).not.toBeInTheDocument();
  });
});

describe("BarChart — numberFormat", () => {
  it("applies prefix and suffix", () => {
    render(<BarChart data={[1000]} numberFormat={{ prefix: "$", suffix: "k" }} />);
    expect(screen.getAllByText(/^\$1.*k$/).length).toBeGreaterThan(0);
  });

  it("formats negative prefixed values with the sign before the prefix (−$28k, not $-28k)", () => {
    render(
      <BarChart
        data={[{ label: "APR", value: -28 }, { label: "MAY", value: 42 }]}
        numberFormat={{ prefix: "$", suffix: "k" }}
        dataLabels={{ show: true }}
      />,
    );
    expect(screen.getAllByText("−$28k").length).toBeGreaterThan(0);
    expect(screen.queryByText("$-28k")).not.toBeInTheDocument();
    expect(screen.getAllByText("$42k").length).toBeGreaterThan(0);
  });

  it("explicit formatValue wins over numberFormat", () => {
    render(
      <BarChart
        data={[100]}
        numberFormat={{ prefix: "$" }}
        formatValue={(v) => `RAW${v}`}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar.getAttribute("aria-label")).toMatch(/RAW100/);
  });

  it("compact notation shrinks long values (1500 → ~1.5K)", () => {
    render(
      <BarChart
        data={[1500]}
        numberFormat={{ notation: "compact", locale: "en-US" }}
      />,
    );
    expect(
      screen.getAllByText((_, node) => node?.textContent === "1.5K").length,
    ).toBeGreaterThan(0);
  });

  it("currency style with USD wraps values in $ formatting", () => {
    render(
      <BarChart
        data={[{ label: "A", value: 1250 }]}
        numberFormat={{ style: "currency", currency: "USD", locale: "en-US" }}
      />,
    );
    const bar = screen.getByRole("graphics-symbol");
    expect(bar.getAttribute("aria-label")).toMatch(/\$1,250/);
  });
});

describe("BarChart — xAxis honesty (no min, extend-only max)", () => {
  it("xAxis.max below the data max is ignored with a dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <BarChart
        data={[100]}
        xAxisFormat={(v) => `T${v}`}
        xAxis={{ max: 50 }}
        dataLabels={{ show: false }}
      />,
    );
    // Scale stays at the data max (top tick T100) — no clipped bars.
    expect(container.textContent).toContain("T100");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("xAxis.max"));
    warn.mockRestore();
  });

  it("xAxis.max above the data max extends the scale (headroom)", () => {
    const { container } = render(
      <BarChart
        data={[100]}
        xAxisFormat={(v) => `T${v}`}
        xAxis={{ max: 200 }}
        dataLabels={{ show: false }}
      />,
    );
    expect(container.textContent).toContain("T200");
  });
});

describe("BarChart — scroll & maxHeight (vertical, sticky value axis)", () => {
  it("default scroll='none' does not add the scroll wrapper", () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    expect(container.querySelector(".brock-hbar-scroll")).toBeFalsy();
  });

  it("scroll='auto' adds a keyboard-focusable overflow-y wrapper with maxHeight", () => {
    const { container } = render(
      <BarChart
        data={Array.from({ length: 40 }, (_, i) => i + 1)}
        scroll="auto"
        maxHeight={300}
      />,
    );
    const scroller = container.querySelector(".brock-hbar-scroll") as HTMLElement;
    expect(scroller).toBeTruthy();
    expect(scroller.className).toContain("overflow-y-auto");
    expect(scroller.style.maxHeight).toBe("300px");
    // WCAG 2.1.1: a scroll region must be keyboard-operable.
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller).toHaveAttribute("role", "group");
    expect(scroller).toHaveAttribute("aria-label", "Scrollable chart area");
  });

  it("X (value) ticks stay OUTSIDE the scroll area — the sticky value axis", () => {
    const { container } = render(
      <BarChart
        data={Array.from({ length: 40 }, (_, i) => i + 1)}
        scroll="auto"
        maxHeight={300}
        xAxisFormat={(v) => `T${v}`}
      />,
    );
    const scroller = container.querySelector(".brock-hbar-scroll") as HTMLElement;
    expect(scroller.querySelector(".brock-hbar-xaxis")).toBeFalsy();
    expect(container.querySelector(".brock-hbar-xaxis")).toBeTruthy();
  });
});

describe("BarChart — pointer target size warning (WCAG 2.5.8)", () => {
  it("warns in dev when onBarClick is wired and barThickness < 24", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BarChart data={[1, 2, 3]} barThickness={16} onBarClick={() => {}} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("2.5.8"));
    warn.mockRestore();
  });

  it("stays silent without onBarClick (bars are not pointer targets)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BarChart data={[1, 2, 3]} barThickness={16} />);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("2.5.8"));
    warn.mockRestore();
  });

  it("stays silent at the default thickness (24px = the WCAG floor)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BarChart data={[1, 2, 3]} onBarClick={() => {}} />);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("2.5.8"));
    warn.mockRestore();
  });
});

describe("BarChart — animation", () => {
  it("applies brock-hbars-animated class by default", () => {
    const { container } = render(<BarChart data={[10]} />);
    expect(container.querySelector(".brock-hbars-animated")).toBeTruthy();
  });

  it("omits brock-hbars-animated class when animation.enabled is false", () => {
    const { container } = render(
      <BarChart data={[10]} animation={{ enabled: false }} />,
    );
    expect(container.querySelector(".brock-hbars-animated")).toBeFalsy();
    expect(container.querySelector(".brock-hbars")).toBeTruthy();
  });

  it("sets --brock-hbar-duration CSS variable when duration provided", () => {
    const { container } = render(
      <BarChart data={[10]} animation={{ duration: 800 }} />,
    );
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.style.getPropertyValue("--brock-hbar-duration")).toBe("800ms");
  });

  it("staggers bars by 30ms via animationDelay", () => {
    const { container } = render(<BarChart data={[10, 20, 30]} />);
    const bars = container.querySelectorAll(".brock-hbar");
    expect((bars[0] as HTMLElement).style.animationDelay).toBe("0ms");
    expect((bars[1] as HTMLElement).style.animationDelay).toBe("30ms");
    expect((bars[2] as HTMLElement).style.animationDelay).toBe("60ms");
  });

  it("grows bars from the baseline (scaleX keyframes, mirrored for negatives)", () => {
    const { container } = render(<BarChart data={[10, -5]} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("scaleX(0)");
    expect(css).toContain("transform-origin: left");
    expect(css).toContain("transform-origin: right");
    expect(css).toContain("prefers-reduced-motion");
  });
});

describe("BarChart — sort & topN", () => {
  const labelsOf = () =>
    screen
      .getAllByRole("graphics-symbol")
      .map((b) => b.getAttribute("aria-label"));

  it("preserves input order by default (sort='none', top→bottom)", () => {
    render(
      <BarChart
        data={[
          { label: "A", value: 30 },
          { label: "B", value: 10 },
          { label: "C", value: 20 },
        ]}
      />,
    );
    expect(labelsOf()).toEqual(["A: 30", "B: 10", "C: 20"]);
  });

  it("sort='desc' orders bars largest → smallest (the ranking shape)", () => {
    render(
      <BarChart
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
      <BarChart
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
      <BarChart
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
      <BarChart
        data={[
          { label: "A", value: 30 },
          { label: "B", value: 10, highlight: true },
          { label: "C", value: 20 },
        ]}
        sort="asc"
      />,
    );
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[0].getAttribute("aria-label")).toBe("B: 10");
    const highlighted = container.querySelector(".brock-hbar-highlighted");
    expect(
      highlighted
        ?.closest('[role="graphics-symbol"]')
        ?.getAttribute("aria-label"),
    ).toBe("B: 10");
  });

  it("topN keeps the N largest and rolls the rest into an 'Other' bar (summed)", () => {
    render(
      <BarChart
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
    expect(labelsOf()).toEqual(["A: 50", "B: 40", "Other: 10"]);
  });

  it("topN object form respects a custom label", () => {
    render(
      <BarChart
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
      <BarChart
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
      <BarChart
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
    expect(labelsOf()).toEqual(["A: 50", "B: 40", "Other: 55"]);
  });

  it("pinned: false lets 'Other' participate in the ranking", () => {
    render(
      <BarChart
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
});

describe("BarChart — 'Other' aggregate contract", () => {
  const RANKED = [
    { label: "A", value: 50 },
    { label: "B", value: 40 },
    { label: "C", value: 5 },
    { label: "D", value: 3 },
  ];

  it("renders the Other bar with the muted brock-hbar-other fill by default", () => {
    const { container } = render(<BarChart data={RANKED} topN={2} />);
    const muted = container.querySelectorAll(".brock-hbar-other");
    expect(muted.length).toBe(1);
    expect(
      muted[0].closest('[role="graphics-symbol"]')?.getAttribute("aria-label"),
    ).toBe("Other: 8");
  });

  it("distinct: false renders Other like a regular accent bar", () => {
    const { container } = render(
      <BarChart data={RANKED} topN={{ n: 2, distinct: false }} />,
    );
    expect(container.querySelector(".brock-hbar-other")).toBeFalsy();
  });

  it("onBarClick on Other receives isOther + the collapsed items", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    render(<BarChart data={RANKED} topN={2} onBarClick={onBarClick} />);
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
    render(<BarChart data={RANKED} topN={2} onBarClick={onBarClick} />);
    await user.click(screen.getByRole("graphics-symbol", { name: "A: 50" }));
    const [point] = onBarClick.mock.calls[0];
    expect(point.isOther).toBeUndefined();
    expect(point.items).toBeUndefined();
  });

  it("getSelection on a focused Other bar exposes the aggregate payload", () => {
    let api: BarChartHandle | undefined;
    const Harness = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart ref={ref} data={RANKED} topN={2} />
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

describe("BarChart — reference line (vertical, chip at top)", () => {
  it("renders reference line with label + value when both provided", () => {
    render(
      <BarChart
        data={[100, 150, 200]}
        referenceLine={{ value: 180, label: "Q3 target" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Q3 target · 180/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Q3 target line at 180/)).toBeInTheDocument();
  });

  it("renders as a VERTICAL dashed line positioned by value", () => {
    render(
      <BarChart
        data={[100, 200]}
        referenceLine={{ value: 100, label: "Half" }}
        formatValue={(v) => String(v)}
      />,
    );
    const line = screen.getByLabelText(/Half line at 100/) as HTMLElement;
    // Vertical: spans top→bottom, positioned by left%, dashed START border.
    expect(line.className).toContain("border-s");
    expect(line.className).toContain("border-dashed");
    expect(line.style.left).toBe("50%"); // 100 of max 200
  });

  it("includes the reference in max calc so ref > data still renders bars", () => {
    render(
      <BarChart
        data={[100]}
        referenceLine={{ value: 500, label: "Stretch" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Stretch · 500/)).toBeInTheDocument();
    expect(screen.getByRole("graphics-symbol")).toHaveAttribute(
      "aria-label",
      "Bar 1: 100",
    );
  });

  it("computes stat: 'mean' over the ORIGINAL input (sort/topN must not move it)", () => {
    render(
      <BarChart
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 20 },
          { label: "C", value: 30 },
          { label: "D", value: 40 },
        ]}
        topN={2}
        sort="desc"
        referenceLine={{ value: { stat: "mean" } }}
        formatValue={(v) => String(v)}
      />,
    );
    // Mean of the INPUT (10+20+30+40)/4 = 25 — not of the displayed bars.
    expect(screen.getByText(/Mean · 25/)).toBeInTheDocument();
  });

  it("computes stat: 'median' with even-count interpolation + custom label", () => {
    render(
      <BarChart
        data={[10, 20, 30, 100]}
        referenceLine={{ value: { stat: "median" }, label: "Typical week" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Typical week · 25/)).toBeInTheDocument();
  });

  it("renders negative reference values by extending the scale left", () => {
    render(
      <BarChart
        data={[100]}
        referenceLine={{ value: -50, label: "Floor" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Floor · -50/)).toBeInTheDocument();
  });

  it("skips the reference line when its value is non-finite", () => {
    render(
      <BarChart data={[100]} referenceLine={{ value: NaN, label: "Ref" }} />,
    );
    expect(screen.queryByText(/Ref/)).not.toBeInTheDocument();
  });
});

describe("BarChart — negative values (axis inversion: bars grow LEFT)", () => {
  const PNL = [
    { label: "JAN", value: 40 },
    { label: "FEB", value: -25 },
    { label: "MAR", value: 10 },
  ];

  it("renders negative bars with the leftward brock-hbar-neg class", () => {
    const { container } = render(<BarChart data={PNL} />);
    const neg = container.querySelectorAll(".brock-hbar-neg");
    expect(neg.length).toBe(1);
    expect(
      neg[0].closest('[role="graphics-symbol"]')?.getAttribute("aria-label"),
    ).toBe("FEB: -25");
  });

  it("draws the zero baseline as an inner VERTICAL line and drops the start border", () => {
    const { container } = render(<BarChart data={PNL} />);
    const bars = container.querySelector(".brock-hbars") as HTMLElement;
    expect(bars.className).not.toContain("border-s");
    const zeroLine = bars.querySelector(
      ".border-s.border-border",
    ) as HTMLElement;
    expect(zeroLine).toBeTruthy();
    // range = 40 - (-25) = 65; baseline at 25/65 ≈ 38.4%.
    expect(zeroLine.style.left).toMatch(/^38\.4/);
  });

  it("keeps the classic start border when no negatives exist", () => {
    const { container } = render(<BarChart data={[10, 20]} />);
    const bars = container.querySelector(".brock-hbars") as HTMLElement;
    expect(bars.className).toContain("border-s");
  });

  it("positions bars by |value| / range on both sides of the baseline", () => {
    const { container } = render(<BarChart data={PNL} />);
    const barEls = container.querySelectorAll(".brock-hbar");
    // JAN (40): starts at the baseline 38.46%, width 40/65 ≈ 61.5%
    expect((barEls[0] as HTMLElement).style.left).toMatch(/^38\.4/);
    expect((barEls[0] as HTMLElement).style.width).toMatch(/^61\.5/);
    // FEB (-25): width = 25/65 ≈ 38.4%, ends AT the baseline → starts at 0
    expect((barEls[1] as HTMLElement).style.left).toMatch(/^0/);
    expect((barEls[1] as HTMLElement).style.width).toMatch(/^38\.4/);
  });

  it("shows [max, 0, min] X ticks when negatives are present", () => {
    const { container } = render(
      <BarChart
        data={PNL}
        xAxisFormat={(v) => `T${v}`}
        dataLabels={{ show: false }}
      />,
    );
    expect(container.textContent).toContain("T40");
    expect(container.textContent).toContain("T0");
    expect(container.textContent).toContain("T-25");
  });

  it("renders all-negative data growing left from a right-edge baseline", () => {
    const { container } = render(<BarChart data={[-10, -30, -20]} />);
    expect(container.querySelectorAll(".brock-hbar-neg").length).toBe(3);
    const bars = screen.getAllByRole("graphics-symbol");
    expect(bars[1].getAttribute("aria-label")).toBe("Bar 2: -30");
  });

  it("sorts negatives naturally (asc puts the deepest loss first)", () => {
    render(<BarChart data={PNL} sort="asc" />);
    const labels = screen
      .getAllByRole("graphics-symbol")
      .map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["FEB: -25", "MAR: 10", "JAN: 40"]);
  });
});

describe("BarChart — event callbacks (onBarClick / Hover / Focus)", () => {
  it("onBarClick fires with point, index, and a click event", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    const { container } = render(
      <BarChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarClick={onBarClick}
      />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    await user.click(bars[1]);
    expect(onBarClick).toHaveBeenCalledTimes(1);
    const [point, index, event] = onBarClick.mock.calls[0];
    expect(index).toBe(1);
    expect(point).toEqual(expect.objectContaining({ label: "B", value: 20 }));
    expect(event).toBeDefined();
    expect((event as MouseEvent).type).toBe("click");
  });

  it("onBarHover fires with the point on mouse enter", async () => {
    const user = userEvent.setup();
    const onBarHover = vi.fn();
    const { container } = render(
      <BarChart
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
      <BarChart data={[10, 20]} labels={["A", "B"]} onBarHover={onBarHover} />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    await user.hover(bars[0]);
    await user.unhover(bars[0]);
    await user.unhover(container.querySelector(".brock-hbars") as HTMLElement);
    const sawLeave = onBarHover.mock.calls.some(
      (c) => c[0] === null && c[1] === null,
    );
    expect(sawLeave).toBe(true);
  });

  it("onBarFocus fires when keyboard nav moves between bars", async () => {
    const user = userEvent.setup();
    const onBarFocus = vi.fn();
    const { container } = render(
      <BarChart
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        onBarFocus={onBarFocus}
      />,
    );
    const bars = container.querySelectorAll('[role="graphics-symbol"]');
    (bars[0] as HTMLElement).focus();
    onBarFocus.mockClear();
    await user.keyboard("{ArrowDown}");
    const last = onBarFocus.mock.calls[onBarFocus.mock.calls.length - 1];
    expect(last[1]).toBe(1);
    expect(last[0]).toEqual(expect.objectContaining({ label: "B", value: 20 }));
  });

  it("cursor-pointer is added to bars only when onBarClick is provided", () => {
    const { container, rerender } = render(<BarChart data={[10]} />);
    expect(
      (container.querySelector('[role="graphics-symbol"]') as HTMLElement)
        .className,
    ).not.toContain("cursor-pointer");

    rerender(<BarChart data={[10]} onBarClick={() => {}} />);
    expect(
      (container.querySelector('[role="graphics-symbol"]') as HTMLElement)
        .className,
    ).toContain("cursor-pointer");
  });
});

describe("BarChart — touch tooltip (tap to pin)", () => {
  const tooltipOf = (bar: HTMLElement) =>
    bar.querySelector(".brock-hbar-tip") as HTMLElement;

  it("tooltips are hover/focus-driven (hidden) by default", () => {
    render(<BarChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    const tip = tooltipOf(bars[0]);
    expect(tip.classList.contains("hidden")).toBe(true);
    expect(tip.classList.contains("flex")).toBe(false);
  });

  it("tapping a bar pins its tooltip visible", () => {
    render(<BarChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[0]);
    const tip = tooltipOf(bars[0]);
    expect(tip.classList.contains("flex")).toBe(true);
    expect(tip.classList.contains("hidden")).toBe(false);
  });

  it("re-tapping the same bar dismisses its tooltip", () => {
    render(<BarChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[0]);
    fireEvent.touchStart(bars[0]);
    expect(tooltipOf(bars[0]).classList.contains("hidden")).toBe(true);
  });

  it("tapping another bar moves the pin", () => {
    render(<BarChart data={[10, 20]} labels={["A", "B"]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    fireEvent.touchStart(bars[0]);
    fireEvent.touchStart(bars[1]);
    expect(tooltipOf(bars[0]).classList.contains("hidden")).toBe(true);
    expect(tooltipOf(bars[1]).classList.contains("flex")).toBe(true);
  });

  it("tap pinning also works with a custom tooltip slot", () => {
    render(
      <BarChart
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

  it("top-edge rows anchor the tooltip below the row, others above", () => {
    render(<BarChart data={[10, 20, 30, 40, 50, 60, 70]} />);
    const bars = screen.getAllByRole("graphics-symbol");
    // 7 rows → edge zone = 1: row 0 anchors below (top-full), row 3 above.
    expect(tooltipOf(bars[0]).className).toContain("top-full");
    expect(tooltipOf(bars[3]).className).toContain("bottom-full");
  });
});

describe("BarChart — key addressing", () => {
  const DATA = [
    { label: "Jan", value: 30 },
    { label: "Feb", value: 10 },
    { label: "Mar", value: 20 },
  ];

  it("focusBar accepts a key and returns the display index after a sort", () => {
    let api: BarChartHandle | undefined;
    const Harness = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart ref={ref} data={DATA} sort="asc" />
        </>
      );
    };
    render(<Harness />);
    fireEvent.click(screen.getByText("grab"));
    // asc order: Feb(10), Mar(20), Jan(30) — "jan" is display index 2.
    expect(api!.focusBar("jan")).toBe(2);
    const sel = api!.getSelection();
    expect(sel?.key).toBe("Jan");
    expect(sel?.point.label).toBe("Jan");
  });

  it("focusBar with an unknown key returns -1 without moving focus", () => {
    let api: BarChartHandle | undefined;
    const Harness = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart ref={ref} data={DATA} />
        </>
      );
    };
    render(<Harness />);
    fireEvent.click(screen.getByText("grab"));
    expect(api!.focusBar("nope")).toBe(-1);
  });

  it("an explicit datum key wins over the label for addressing", () => {
    let api: BarChartHandle | undefined;
    const Harness = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart
            ref={ref}
            data={[
              { key: "q1-2026", label: "Q1", value: 10 },
              { key: "q2-2026", label: "Q2", value: 20 },
            ]}
          />
        </>
      );
    };
    render(<Harness />);
    fireEvent.click(screen.getByText("grab"));
    expect(api!.focusBar("q2-2026")).toBe(1);
  });

  it("warns in dev about duplicate keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <BarChart
        data={[
          { label: "Jan", value: 10 },
          { label: "Jan", value: 20 },
        ]}
      />,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("duplicate key"));
    warn.mockRestore();
  });
});

describe("BarChart — meta passthrough", () => {
  it("returns the original meta payload on callback datums", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    const row = { id: 42, region: "KZ" };
    render(
      <BarChart
        data={[{ label: "A", value: 10, meta: row }]}
        onBarClick={onBarClick}
      />,
    );
    await user.click(screen.getByRole("graphics-symbol"));
    expect(onBarClick.mock.calls[0][0].meta).toBe(row);
  });

  it("meta survives sort and is absent when not provided", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    render(
      <BarChart
        data={[
          { label: "A", value: 30, meta: "a-meta" },
          { label: "B", value: 10 },
        ]}
        sort="asc"
        onBarClick={onBarClick}
      />,
    );
    await user.click(screen.getByRole("graphics-symbol", { name: "A: 30" }));
    expect(onBarClick.mock.calls[0][0].meta).toBe("a-meta");
    await user.click(screen.getByRole("graphics-symbol", { name: "B: 10" }));
    expect(onBarClick.mock.calls[1][0].meta).toBeUndefined();
  });
});

describe("BarChart — slots", () => {
  it("slots.empty replaces the default ASCII empty state", () => {
    render(
      <BarChart
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
      <BarChart
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
    expect(container.querySelector(".brock-hbar-skeleton")).toBeFalsy();
  });

  it("slots > shortcut fallbacks: slots.error wins over errorFallback", () => {
    render(
      <BarChart
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
      <BarChart
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
    expect(
      screen.queryByRole("button", { name: "Download PNG" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("MyCSV"));
    expect(onExport).toHaveBeenCalledWith(
      "csv",
      expect.stringContaining("label,value"),
    );
  });

  it("slots.tooltip renders the custom node with point/index/value/edge props", () => {
    const { container } = render(
      <BarChart
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
    expect(tt.length).toBe(2);
    expect(tt[0].textContent).toContain("i=0");
    expect(tt[0].textContent).toContain("lbl=A");
    expect(tt[0].textContent).toContain("e=top");
  });

  it("slots.caption renders below the source line", () => {
    const { container } = render(
      <BarChart
        data={[10]}
        labels={["A"]}
        source="FT"
        slots={{
          caption: () => <div data-testid="caption">reading note</div>,
        }}
      />,
    );
    expect(screen.getByTestId("caption")).toBeInTheDocument();
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
      <BarChart
        data={[10]}
        labels={["A"]}
        slots={{
          watermark: () => <div data-testid="wm">brock</div>,
        }}
      />,
    );
    const wm = screen.getByTestId("wm");
    const wrapper = wm.parentElement as HTMLElement;
    expect(wrapper.className).toContain("absolute");
    expect(wrapper.className).toContain("pointer-events-none");
    expect(container.querySelector("figure")?.contains(wm)).toBe(true);
  });
});

describe("BarChart — caption / watermark props", () => {
  it("renders the caption string below source", () => {
    const { container } = render(
      <BarChart data={[10]} labels={["A"]} source="FT" caption="Self-reported." />,
    );
    const cap = container.querySelector(".brock-hbar-caption");
    expect(cap).toBeInTheDocument();
    expect(cap).toHaveTextContent("Self-reported.");
  });

  it("renders watermark text uppercased, rotated, aria-hidden", () => {
    const { container } = render(
      <BarChart data={[10]} labels={["A"]} watermark="draft" />,
    );
    const wm = container.querySelector(".brock-hbar-watermark") as HTMLElement;
    expect(wm).toBeInTheDocument();
    expect(wm).toHaveTextContent("DRAFT");
    expect(wm.getAttribute("aria-hidden")).toBe("true");
    const span = wm.querySelector("span") as HTMLElement;
    expect(span.style.transform).toContain("rotate");
  });

  it("keeps the watermark visible in print styles (lifecycle marker)", () => {
    const { container } = render(<BarChart data={[10]} watermark="DRAFT" />);
    const css = container.querySelector("style")?.textContent ?? "";
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock).not.toMatch(/brock-hbar-watermark[^}]*display:\s*none/);
    expect(printBlock).toContain(".brock-hbar-watermark span");
    // Print also unclamps the scroll area so the full ranking prints.
    expect(printBlock).toContain("max-height: none");
  });
});

describe("BarChart — forward-compat props", () => {
  it("stamps data-chart-type onto the figure (default 'bar')", () => {
    const { container } = render(<BarChart data={[10]} />);
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.getAttribute("data-chart-type")).toBe("bar");
  });

  it("custom chartType overrides the default tag", () => {
    const { container } = render(
      <BarChart data={[10]} chartType="region-ranking" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-chart-type"),
    ).toBe("region-ranking");
  });

  it("dataDescription is stamped as data-description (AI-readable)", () => {
    const { container } = render(
      <BarChart data={[10]} dataDescription="Revenue by region, FY2026" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-description"),
    ).toBe("Revenue by region, FY2026");
  });

  it("data-testid is forwarded onto the figure", () => {
    const { container } = render(
      <BarChart data={[10]} data-testid="region-revenue" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-testid"),
    ).toBe("region-revenue");
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
    height: 240,
    points,
    max: 30,
    min: 0,
    allZero: false,
    gap: 8,
    barRadius: 2,
    patternStyle: "diagonal",
    labelWidth: 96,
    accent: "#F54900",
    foreground: "#0a0a0a",
    muted: "#666666",
    border: "#e5e5e5",
    background: "#ffffff",
    xTicks: [30, 15, 0],
    xAxisFormat: (v) => String(v),
    formatValue: (v) => String(v),
    labelFormat: (v) => String(v),
    showLabels: false,
    showXTicks: true,
    showCategoryLabels: true,
    description: "Bar chart test",
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
    expect(header).not.toContain("highlight");
  });

  it("quotes cells containing commas, quotes, or CRLF (RFC 4180)", () => {
    const csv = pointsToCSV([
      { label: 'A,B"C', value: 10, pattern: "solid", note: "line\nbreak" },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"A,B""C"');
    expect(row).toContain('"line\nbreak"');
  });

  it("terminates with CRLF (RFC 4180)", () => {
    const csv = pointsToCSV([{ label: "A", value: 1, pattern: "solid" }]);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("synthesizeSVG — horizontal geometry", () => {
  it("produces a well-formed SVG with viewBox and a11y title+desc", () => {
    const svg = synthesizeSVG(ctx());
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 800 240"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>Bar chart test</title>");
    expect(svg).toContain("<desc>Bar chart test</desc>");
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("renders one <path> per visible bar", () => {
    const svg = synthesizeSVG(ctx());
    expect(svg.match(/<path d="/g)?.length).toBe(3);
  });

  it("draws the zero baseline as a VERTICAL line (x1 === x2)", () => {
    const svg = synthesizeSVG(ctx());
    expect(/<line x1="([\d.]+)" y1="[\d.]+" x2="\1" y2="/.test(svg)).toBe(true);
  });

  it("renders category labels in the left column, right-aligned", () => {
    const svg = synthesizeSVG(ctx());
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain(">A<");
    expect(svg).toContain(">C<");
  });

  it("truncates long category labels with an ellipsis (fixed char budget)", () => {
    const svg = synthesizeSVG(
      ctx({
        points: [
          {
            label: "EXTRAORDINARILY-LONG-CATEGORY",
            value: 10,
            pattern: "solid",
          },
        ],
      }),
    );
    expect(svg).toContain("…");
    expect(svg).not.toContain("EXTRAORDINARILY-LONG-CATEGORY<");
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
    expect(
      svg.match(/<pattern id="brock-hpat-diagonal-[a-f0-9]+"/g)?.length,
    ).toBe(2);
    expect(svg).toContain("<defs>");
  });

  it("draws an outline path on top of highlighted bars", () => {
    const svg = synthesizeSVG(
      ctx({
        points: [{ label: "A", value: 10, pattern: "solid", highlight: true }],
      }),
    );
    expect(svg.match(/<path d="/g)?.length).toBe(2);
    expect(svg).toContain('stroke="#0a0a0a"');
  });

  it("renders a VERTICAL dashed reference line + labelled chip at the top", () => {
    const svg = synthesizeSVG(
      ctx({
        referenceLine: { value: 25, label: "Target" },
        max: 30,
      }),
    );
    expect(svg).toContain('stroke-dasharray="4 2"');
    expect(svg).toContain("Target");
    // The reference line itself is vertical: x1 === x2 on the dashed line.
    const dashed = svg.match(
      /<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="#666666" stroke-width="1" stroke-dasharray="4 2"\/>/,
    );
    expect(dashed).toBeTruthy();
    expect(dashed![1]).toBe(dashed![2]);
  });

  it("positions X (value) ticks by value along the bottom", () => {
    const svg = synthesizeSVG(ctx({ xAxisFormat: (v) => `T${v}` }));
    expect(svg).toContain(">T30<");
    expect(svg).toContain(">T15<");
    expect(svg).toContain(">T0<");
  });

  it("inline value labels render at bar ends when showLabels=true", () => {
    const svg = synthesizeSVG(
      ctx({
        showLabels: true,
        labelFormat: (v) => `V${v}`,
      }),
    );
    expect(svg).toContain(">V10<");
    expect(svg).toContain(">V30<");
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
    expect(svg).toContain("FT &lt;DATA&gt;");
  });

  it("keeps negatives: bars on both sides of the baseline, [max,0,min] ticks", () => {
    const svg = synthesizeSVG(
      ctx({
        points: [
          { label: "A", value: 40, pattern: "solid" },
          { label: "B", value: -25, pattern: "solid" },
        ],
        max: 40,
        min: -25,
        xTicks: [40, 0, -25],
      }),
    );
    expect(svg.match(/<path d="/g)?.length).toBe(2);
    expect(svg).toContain(">40<");
    expect(svg).toContain(">0<");
    expect(svg).toContain(">-25<");
  });

  it("reproduces watermark and caption in the export", () => {
    const svg = synthesizeSVG(
      ctx({ watermark: "DRAFT", caption: "Self-reported.", source: "FT" }),
    );
    expect(svg).toContain('fill-opacity="0.06"');
    expect(svg).toContain(">DRAFT<");
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain(">Self-reported.<");
  });
});

describe("BarChart — toolbar (exportable prop)", () => {
  it("renders no toolbar by default", () => {
    const { container } = render(<BarChart data={[10]} />);
    expect(container.querySelector('[role="toolbar"]')).toBeFalsy();
  });

  it("renders all 4 buttons when exportable={true}", () => {
    const { container } = render(<BarChart data={[10]} exportable />);
    const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(toolbar).toBeTruthy();
    expect(toolbar.getAttribute("aria-label")).toBe("Chart export");
    expect(
      within(toolbar).getByRole("button", { name: "Download PNG" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Download SVG" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Download CSV" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Copy image to clipboard" }),
    ).toBeInTheDocument();
  });

  it("renders only chosen actions in object form", () => {
    const { container } = render(
      <BarChart data={[10]} exportable={{ csv: true }} />,
    );
    const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(toolbar.querySelectorAll("button").length).toBe(1);
    expect(within(toolbar).getByText("CSV")).toBeInTheDocument();
  });

  it("CSV button triggers onExport with the csv string", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:stub");
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = vi.fn();

    try {
      render(
        <BarChart
          data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
          exportable={{ csv: true }}
          exportFileName="region-revenue"
          onExport={onExport}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Download CSV" }));
      expect(onExport).toHaveBeenCalledWith(
        "csv",
        expect.stringContaining("label,value"),
      );
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
      <BarChart
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

describe("BarChart — imperative ref API", () => {
  function Harness({ onReady }: { onReady: (h: BarChartHandle) => void }) {
    const handle = useRef<BarChartHandle>(null);
    return (
      <>
        <BarChart
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
    let api: BarChartHandle | undefined;
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
    let api: BarChartHandle | undefined;
    render(<Harness onReady={(h) => (api = h)} />);
    await user.click(screen.getByText("ready"));
    const svg = api!.exportSVG({ download: false });
    expect(svg).toContain("<svg ");
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("exportCSV returns the CSV string and includes per-bar overrides", async () => {
    const user = userEvent.setup();
    let api: BarChartHandle | undefined;
    render(<Harness onReady={(h) => (api = h)} />);
    await user.click(screen.getByText("ready"));
    const csv = api!.exportCSV({ download: false });
    expect(csv).toContain("label,value,color,note");
    expect(csv).toContain("B,20,#FF0000,peak");
  });

  it("focusBar(n) moves keyboard focus and returns the clamped index", () => {
    let api: BarChartHandle | undefined;
    const Grab = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart
            ref={ref}
            data={[
              { label: "A", value: 10 },
              { label: "B", value: 20 },
              { label: "C", value: 30 },
            ]}
          />
        </>
      );
    };
    render(<Grab />);
    fireEvent.click(screen.getByText("grab"));
    expect(api!.focusBar(1)).toBe(1);
    expect(api!.focusBar(99)).toBe(2);
    expect(api!.focusBar(-5)).toBe(0);
  });

  it("focusBar returns -1 and getSelection returns null when no data", () => {
    let api: BarChartHandle | undefined;
    const Grab = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart ref={ref} data={[]} />
        </>
      );
    };
    render(<Grab />);
    fireEvent.click(screen.getByText("grab"));
    expect(api!.focusBar(0)).toBe(-1);
    expect(api!.getSelection()).toBeNull();
  });

  it("getSelection returns the currently focused bar", () => {
    let api: BarChartHandle | undefined;
    const Grab = () => {
      const ref = useRef<BarChartHandle>(null);
      return (
        <>
          <button onClick={() => (api = ref.current ?? undefined)}>grab</button>
          <BarChart
            ref={ref}
            data={[
              { label: "A", value: 10 },
              { label: "B", value: 20 },
              { label: "C", value: 30 },
            ]}
          />
        </>
      );
    };
    render(<Grab />);
    fireEvent.click(screen.getByText("grab"));
    expect(api!.getSelection()).toEqual({
      index: 0,
      key: "A",
      point: expect.objectContaining({ label: "A", value: 10 }),
    });
    api!.focusBar(2);
    expect(api!.getSelection()).toEqual({
      index: 2,
      key: "C",
      point: expect.objectContaining({ label: "C", value: 30 }),
    });
  });
});

describe("toJSON / fromJSON ($schema brock-ui/bar-chart/v1)", () => {
  it("includes $schema and strips functions / callbacks / ReactNodes", () => {
    const json = toJSON({
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      barThickness: 32,
      labelWidth: 120,
      accent: "#FF0000",
      onBarClick: () => {},
      onBarHover: () => {},
      formatValue: (v: number) => `${v}!`,
      slots: { tooltip: () => null },
      loadingFallback: { type: "div" } as unknown,
      className: "my-class",
    });
    expect(json.$schema).toBe(BAR_CHART_JSON_SCHEMA);
    expect(json.$schema).toBe("brock-ui/bar-chart/v1");
    expect(json.data).toEqual([10, 20, 30]);
    expect(json.barThickness).toBe(32);
    expect(json.labelWidth).toBe(120);
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

  it("dataLabels.format function is dropped; 'auto' survives as a literal", () => {
    const json = toJSON({
      data: [10],
      dataLabels: { show: "auto", format: (v: number) => `${v}` },
    });
    expect(json.dataLabels).toEqual({ show: "auto" });
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

  it("toJSON → fromJSON roundtrip is stable for serializable bar props", () => {
    const original = {
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      barThickness: 32,
      gap: 10,
      maxHeight: 400,
      labelWidth: 120,
      accent: "#F54900",
      header: { title: "Revenue", subtitle: "FY2026" },
      referenceLine: { value: 25, label: "Target" },
      sort: "desc" as const,
      topN: 2,
      scroll: "auto" as const,
      source: "FT",
      caption: "Self-reported",
      watermark: "DRAFT",
      chartType: "bar",
      dataDescription: "Revenue by region",
    };
    const json = toJSON(original);
    const back = fromJSON(json);
    delete (json as { $schema?: string }).$schema;
    expect(back).toEqual(json);
  });

  it("fromJSON warns in dev when $schema is unknown", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      fromJSON({
        $schema: "brock-ui/bar-chart/v99",
        data: [1],
      } as BarChartJSON);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain("brock-ui/bar-chart/v99");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("renderToHTMLString — static parity (canon §8)", () => {
  it("wraps the SVG in a div with role=img and the description as aria-label", () => {
    const html = renderToHTMLString({
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      source: "FT",
    });
    expect(html).toMatch(/^<div role="img" aria-label="[^"]+"/);
    expect(html).toContain("Bar chart with 3 data points");
    expect(html).toContain("Source: FT");
    expect(html).toContain("<svg ");
    expect(html.trim().endsWith("</div>")).toBe(true);
  });

  it("derives the default height from the item count (no height prop)", () => {
    const html = renderToHTMLString({ data: [10, 20, 30] });
    // 3 * 24 + 2 * 8 = 88 bars + 120 chrome = 208
    expect(html).toContain('height="208"');
  });

  it("includes data-chart-type / data-description attrs on the wrapper", () => {
    const html = renderToHTMLString({
      data: [10],
      chartType: "region-ranking",
      dataDescription: "Revenue by region",
    });
    expect(html).toContain('data-chart-type="region-ranking"');
    expect(html).toContain('data-description="Revenue by region"');
  });

  it("applies sort + topN from the JSON config (same transform as the live chart)", () => {
    const html = renderToHTMLString({
      $schema: BAR_CHART_JSON_SCHEMA,
      data: [
        { label: "A", value: 50 },
        { label: "B", value: 5 },
        { label: "C", value: 4 },
      ],
      sort: "desc",
      topN: 1,
    });
    // Other = 9, pinned last, rendered muted (the default otherFill color).
    expect(html).toContain("Other");
    expect(html).toContain("#a1a1aa");
  });

  it("resolves a stat referenceLine against the input values", () => {
    const html = renderToHTMLString({
      $schema: BAR_CHART_JSON_SCHEMA,
      data: [10, 20, 30],
      referenceLine: { value: { stat: "mean" } },
    });
    // mean = 20 -> dashed VERTICAL line + auto "Mean" chip in the SVG.
    expect(html).toContain('stroke-dasharray="4 2"');
    expect(html).toContain("Mean");
  });

  it("does not filter out negative values in the static render", () => {
    const html = renderToHTMLString({
      $schema: BAR_CHART_JSON_SCHEMA,
      data: [
        { label: "JAN", value: 40 },
        { label: "FEB", value: -25 },
      ],
    });
    expect(html).toContain("FEB");
    expect(html.match(/<path d="/g)?.length).toBe(2);
  });

  it("normalizes object-form data points and preserves per-bar overrides", () => {
    const html = renderToHTMLString({
      data: [
        { label: "A", value: 10 },
        { label: "B", value: 20, color: "#F00", highlight: true },
      ],
    });
    expect(html).toContain("<svg ");
    // Highlight outline adds an extra path: 2 bars + 1 outline = 3 paths.
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
    expect(html).toContain('fill="#0F0"');
    expect(html).toContain('fill="#000"');
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

/* ─── Type-level smoke test: BarChartProps stays usable as a value type ── */

describe("BarChart — props type smoke test", () => {
  it("accepts a fully-loaded props object", () => {
    const props: BarChartProps = {
      data: [{ label: "A", value: 1, meta: { id: 1 } }],
      barThickness: 24,
      gap: 8,
      labelWidth: 96,
      maxHeight: 320,
      scroll: "auto",
      sort: "desc",
      topN: { n: 5, label: "Rest", pinned: true, distinct: true },
      referenceLine: { value: { stat: "median" }, label: "Median" },
      dataLabels: { show: "auto" },
      numberFormat: { prefix: "$", decimals: 1 },
      xAxis: { title: "Revenue", max: 100, hideTicks: false },
      yAxis: { title: "Region", hideTicks: false },
      exportable: { csv: true },
      caption: "x",
      watermark: "DRAFT",
      chartType: "bar",
    };
    const { container } = render(<BarChart {...props} />);
    expect(container.querySelector("figure")).toBeTruthy();
  });
});
