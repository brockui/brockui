import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LineChart,
  type LineChartHandle,
  type LineChartProps,
} from "./line-chart";
import {
  LINE_CHART_JSON_SCHEMA,
  fromJSON,
  pointsToCSV,
  renderToHTMLString,
  synthesizeSVG,
  toJSON,
  type ExportSeries,
  type LineChartJSON,
  type SynthesisContext,
} from "./line-chart-export";

/* ─── Rendering (single + multi-series, three data forms) ───────────── */

describe("LineChart — rendering", () => {
  it("renders a single number[] series with labels", () => {
    const { container } = render(
      <LineChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    // One <path.brock-line> for the single series.
    expect(container.querySelectorAll(".brock-line").length).toBe(1);
    // Focusable points appear (emphasized single series).
    expect(
      screen.getAllByRole("img").some((n) => n.classList.contains("brock-plot")),
    ).toBe(true);
  });

  it("renders single-series object form (LineChartDataPoint[])", () => {
    const { container } = render(
      <LineChart
        data={[
          { x: "Q1", y: 10 },
          { x: "Q2", y: 20 },
        ]}
      />,
    );
    expect(container.querySelectorAll(".brock-line").length).toBe(1);
  });

  it("renders one line path per series in multi-series form", () => {
    const { container } = render(
      <LineChart
        data={[
          { name: "Revenue", data: [10, 20, 30] },
          { name: "Costs", data: [5, 8, 12] },
        ]}
        labels={["A", "B", "C"]}
      />,
    );
    expect(container.querySelectorAll(".brock-line").length).toBe(2);
  });

  it("labels each focusable point with 'series, x: value'", () => {
    render(
      <LineChart
        data={[{ x: "Q1", y: 1248 }]}
        formatValue={(v) => String(v)}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Series, Q1: 1248" }),
    ).toBeInTheDocument();
  });

  it("only the emphasized series exposes focusable points", () => {
    const { container } = render(
      <LineChart
        data={[
          { name: "A", data: [10, 20], emphasis: true },
          { name: "B", data: [5, 8] },
        ]}
        labels={["x1", "x2"]}
      />,
    );
    // Emphasized series A has 2 points wired with pointer-events auto + tabindex.
    const focusable = container.querySelectorAll(".brock-point[tabindex]");
    // Both series render point buttons, but only A's are interactive — all
    // points carry a tabindex attribute (0 / -1); assert A has the tab stop.
    const tabStops = Array.from(focusable).filter(
      (el) => el.getAttribute("tabindex") === "0",
    );
    expect(tabStops.length).toBe(1);
  });
});

/* ─── Gaps (y: null breaks the path) ────────────────────────────────── */

describe("LineChart — gaps", () => {
  it("breaks the path into sub-paths around a null point", () => {
    const { container } = render(
      <LineChart data={[10, null, 30, 40]} labels={["A", "B", "C", "D"]} />,
    );
    const path = container.querySelector(".brock-line") as SVGPathElement;
    const d = path.getAttribute("d") ?? "";
    // A gap produces two move commands (two sub-paths).
    expect((d.match(/M /g) ?? []).length).toBe(2);
  });

  it("does not render a focusable point at a null gap", () => {
    const { container } = render(
      <LineChart data={[10, null, 30]} labels={["A", "B", "C"]} />,
    );
    // 3 input points, 1 is a gap → 2 rendered point buttons.
    expect(container.querySelectorAll(".brock-point").length).toBe(2);
  });

  it("treats NaN / Infinity as gaps with a dev warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <LineChart data={[10, NaN, 20, Infinity, 30]} />,
    );
    expect(container.querySelectorAll(".brock-point").length).toBe(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("non-finite value(s)"),
    );
    spy.mockRestore();
  });
});

/* ─── Empty / loading / error states ────────────────────────────────── */

describe("LineChart — state machine", () => {
  it("renders the ASCII empty state when data is []", () => {
    render(<LineChart data={[]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "No data available for this period",
    );
    expect(screen.queryAllByRole("button").length).toBe(0);
  });

  it("renders the empty state with a source line", () => {
    render(<LineChart data={[]} source="Acme Analytics" />);
    expect(screen.getByText(/Acme Analytics/)).toBeInTheDocument();
  });

  it("loading + no data renders the dashed skeleton with role=status", () => {
    const { container } = render(<LineChart data={[]} loading />);
    const status = container.querySelector('[role="status"]') as HTMLElement;
    expect(status).toBeTruthy();
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe("Loading…");
    expect(container.querySelector(".brock-skeleton-line")).toBeTruthy();
  });

  it("loading + data renders the chart with a refresh overlay", () => {
    const { container } = render(
      <LineChart data={[10, 20, 30]} labels={["A", "B", "C"]} loading />,
    );
    expect(container.querySelector(".brock-skeleton-line")).toBeFalsy();
    expect(container.querySelectorAll(".brock-line").length).toBe(1);
    expect(container.querySelector(".brock-loading-overlay")).toBeTruthy();
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.getAttribute("aria-busy")).toBe("true");
  });

  it("error replaces the chart even with data present (terminal)", () => {
    const { container } = render(
      <LineChart data={[10, 20, 30]} labels={["A", "B", "C"]} error="Boom" />,
    );
    expect(container.querySelectorAll(".brock-line").length).toBe(0);
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.textContent).toContain("Boom");
  });

  it("accepts an Error instance and renders its message", () => {
    render(<LineChart data={[]} error={new Error("Upstream timeout")} />);
    expect(screen.getByText("Upstream timeout")).toBeInTheDocument();
  });

  it("error takes precedence over loading and empty", () => {
    const { container } = render(
      <LineChart data={[]} loading error="Failed" />,
    );
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeFalsy();
    expect(container.querySelector(".brock-skeleton-line")).toBeFalsy();
  });

  it("retry button appears only with onRetry and fires the callback", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender, container } = render(<LineChart data={[]} error="X" />);
    expect(container.querySelector('button[type="button"]')).toBeFalsy();

    rerender(<LineChart data={[]} error="X" onRetry={onRetry} />);
    const btn = container.querySelector(
      'button[type="button"]',
    ) as HTMLButtonElement;
    expect(btn.textContent).toContain("Retry");
    await user.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("custom loadingLabel / errorLabel / retryLabel are respected", () => {
    const { container, rerender } = render(
      <LineChart data={[]} loading loadingLabel="Загрузка…" />,
    );
    expect(
      container.querySelector('[role="status"]')?.getAttribute("aria-label"),
    ).toBe("Загрузка…");

    rerender(
      <LineChart
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

  it("loadingFallback / errorFallback override the defaults", () => {
    const { rerender } = render(
      <LineChart
        data={[]}
        loading
        loadingFallback={<div data-testid="custom-loader">spinning…</div>}
      />,
    );
    expect(screen.getByTestId("custom-loader")).toBeInTheDocument();

    rerender(
      <LineChart
        data={[]}
        error="X"
        errorFallback={(err) => <div data-testid="fn-err">{err.message}</div>}
      />,
    );
    expect(screen.getByTestId("fn-err")).toHaveTextContent("X");
  });
});

/* ─── Accessibility ─────────────────────────────────────────────────── */

describe("LineChart — accessibility", () => {
  it("wraps the chart in <figure> with aria-labelledby → figcaption", () => {
    const { container } = render(
      <LineChart
        data={[{ name: "A", data: [10, 20] }]}
        labels={["x1", "x2"]}
        source="Acme"
        formatValue={(v) => String(v)}
      />,
    );
    const figure = container.querySelector("figure");
    expect(figure).toHaveAttribute("role", "figure");
    const labelledBy = figure?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const caption = container.querySelector(`#${labelledBy}`);
    expect(caption?.textContent).toContain("Line chart with 1 series");
    expect(caption?.textContent).toContain("Source: Acme");
  });

  it("auto-description reports per-series high/low for plural series", () => {
    const { container } = render(
      <LineChart
        data={[
          { name: "Rev", data: [10, 40, 25] },
          { name: "Cost", data: [5, 8, 6] },
        ]}
        labels={["JAN", "FEB", "MAR"]}
        formatValue={(v) => String(v)}
      />,
    );
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    const text = container.querySelector(`#${id}`)?.textContent ?? "";
    expect(text).toContain("Line chart with 2 series");
    expect(text).toContain("Rev: high 40 at FEB, low 10 at JAN");
    expect(text).toContain("Cost: high 8 at FEB, low 5 at JAN");
  });

  it("uses a custom description override when provided", () => {
    const { container } = render(
      <LineChart data={[10, 20]} description="Revenue Q1–Q2 2026" />,
    );
    const figure = container.querySelector("figure");
    const id = figure?.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${id}`)).toHaveTextContent(
      "Revenue Q1–Q2 2026",
    );
  });

  it("provides an sr-only table — one column per series, one row per x", () => {
    const { container } = render(
      <LineChart
        data={[
          { name: "A", data: [10, null] },
          { name: "B", data: [5, 8] },
        ]}
        labels={["x1", "x2"]}
        formatValue={(v) => String(v)}
      />,
    );
    const table = container.querySelector("table.sr-only") as HTMLElement;
    expect(table).toBeInTheDocument();
    const headers = within(table).getAllByRole("columnheader");
    // X + A + B
    expect(headers.map((h) => h.textContent)).toEqual(["X", "A", "B"]);
    const rows = within(table).getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
    // A is null at x2 → that cell renders as an em-dash (honest gap).
    expect(rows[2].textContent).toContain("—");
  });

  it("uses roving tabindex: exactly one point tabbable at a time", () => {
    const { container } = render(
      <LineChart data={[10, 20, 30]} labels={["A", "B", "C"]} />,
    );
    const pts = container.querySelectorAll(".brock-point");
    const tabbable = Array.from(pts).filter(
      (p) => p.getAttribute("tabindex") === "0",
    );
    expect(tabbable.length).toBe(1);
  });

  it("ships a forced-colors (Windows High Contrast) stylesheet", () => {
    const { container } = render(<LineChart data={[10]} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("forced-colors: active");
    expect(css).toContain("CanvasText");
    expect(css).toContain("GrayText");
  });
});

/* ─── Keyboard navigation (roving tabindex) ─────────────────────────── */

describe("LineChart — keyboard navigation", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    user = userEvent.setup();
  });

  it("Arrow Right moves focus to the next point on the emphasized series", async () => {
    render(<LineChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const pts = screen.getAllByRole("button");
    pts[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(pts[1]);
    expect(pts[1]).toHaveAttribute("tabindex", "0");
  });

  it("Arrow Left clamps at the first point (no wraparound)", async () => {
    render(<LineChart data={[10, 20, 30]} labels={["A", "B", "C"]} />);
    const pts = screen.getAllByRole("button");
    pts[0].focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(pts[0]);
  });

  it("Home / End jump to the first / last point", async () => {
    render(<LineChart data={[10, 20, 30, 40, 50]} />);
    const pts = screen.getAllByRole("button");
    pts[0].focus();
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(pts[4]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(pts[0]);
  });

  it("Arrow Down switches the focused series", async () => {
    const onPointFocus = vi.fn();
    render(
      <LineChart
        data={[
          { name: "A", data: [10, 20, 30] },
          { name: "B", data: [5, 8, 12] },
        ]}
        labels={["x1", "x2", "x3"]}
        emphasisSeries="A"
        onPointFocus={onPointFocus}
      />,
    );
    // Both series render points; emphasized A's first point is the tab stop.
    const pts = screen.getAllByRole("button");
    pts[0].focus();
    onPointFocus.mockClear();
    await user.keyboard("{ArrowDown}");
    // Down moves the focused-series pointer to the next series (B).
    expect(onPointFocus.mock.calls.at(-1)?.[0].series.name).toBe("B");

    // The switched-to (non-emphasized) series stays keyboard-navigable:
    // ArrowRight must walk along B, not no-op. Regression guard for the
    // "only the emphasized series had onKeyDown" bug.
    await user.keyboard("{ArrowRight}");
    const afterRight = onPointFocus.mock.calls.at(-1)?.[0];
    expect(afterRight.series.name).toBe("B");
    expect(afterRight.index).toBe(1);
    // And Up returns to the emphasized series at the same x.
    await user.keyboard("{ArrowUp}");
    const afterUp = onPointFocus.mock.calls.at(-1)?.[0];
    expect(afterUp.series.name).toBe("A");
    expect(afterUp.index).toBe(1);
  });

  it("Enter / Space invokes onPointClick on the focused point", async () => {
    const onPointClick = vi.fn();
    render(
      <LineChart
        data={[10, 20]}
        labels={["A", "B"]}
        onPointClick={onPointClick}
      />,
    );
    const pts = screen.getAllByRole("button");
    pts[0].focus();
    await user.keyboard("{Enter}");
    expect(onPointClick).toHaveBeenCalledTimes(1);
    expect(onPointClick.mock.calls[0][0].index).toBe(0);
  });
});

/* ─── Trend indicator ───────────────────────────────────────────────── */

describe("LineChart — trend indicator", () => {
  it("shows a positive trend with an accessible label", () => {
    render(<LineChart data={[10]} trend={0.184} />);
    expect(screen.getByText(/\+18\.4%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Trend up 18\.4 percent/)).toBeInTheDocument();
  });

  it("shows a negative trend", () => {
    render(<LineChart data={[10]} trend={-0.075} />);
    expect(screen.getByText(/-7\.5%/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Trend down -7\.5 percent/),
    ).toBeInTheDocument();
  });
});

/* ─── Reference line (fixed / mean / median) ────────────────────────── */

describe("LineChart — reference line", () => {
  it("renders a fixed reference line with label + value", () => {
    render(
      <LineChart
        data={[100, 150, 200]}
        referenceLine={{ value: 180, label: "Target" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Target · 180/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target line at 180/)).toBeInTheDocument();
  });

  it("computes stat: 'mean' over the emphasized series", () => {
    render(
      <LineChart
        data={[
          { name: "A", data: [10, 20, 30, 40], emphasis: true },
          { name: "B", data: [1, 1, 1, 1] },
        ]}
        labels={["w", "x", "y", "z"]}
        referenceLine={{ value: { stat: "mean" } }}
        formatValue={(v) => String(v)}
      />,
    );
    // Mean of A: (10+20+30+40)/4 = 25.
    expect(screen.getByText(/Mean · 25/)).toBeInTheDocument();
  });

  it("computes stat: 'median' with a custom label", () => {
    render(
      <LineChart
        data={[10, 20, 30, 100]}
        referenceLine={{ value: { stat: "median" }, label: "Typical" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Typical · 25/)).toBeInTheDocument();
  });

  it("keeps the reference visible by including it in the Y domain", () => {
    render(
      <LineChart
        data={[100]}
        referenceLine={{ value: 500, label: "Stretch" }}
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText(/Stretch · 500/)).toBeInTheDocument();
  });
});

/* ─── numberFormat ──────────────────────────────────────────────────── */

describe("LineChart — numberFormat", () => {
  it("applies prefix + suffix across the chart", () => {
    render(<LineChart data={[1000]} numberFormat={{ prefix: "$", suffix: "k" }} />);
    expect(screen.getAllByText(/^\$1.*k$/).length).toBeGreaterThan(0);
  });

  it("compact notation shrinks long values (1500 → ~1.5K)", () => {
    render(
      <LineChart
        data={[1500]}
        numberFormat={{ notation: "compact", locale: "en-US" }}
      />,
    );
    expect(
      screen.getAllByText((_, node) => node?.textContent === "1.5K").length,
    ).toBeGreaterThan(0);
  });

  it("explicit formatValue wins over numberFormat", () => {
    render(
      <LineChart
        data={[{ x: "A", y: 100 }]}
        numberFormat={{ prefix: "$" }}
        formatValue={(v) => `RAW${v}`}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Series, A: RAW100" }),
    ).toBeInTheDocument();
  });
});

/* ─── Log scale ─────────────────────────────────────────────────────── */

describe("LineChart — log scale", () => {
  it("drops non-positive values on a log scale with a dev warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <LineChart data={[0, 10, 100, 1000]} yScale="log" labels={["a", "b", "c", "d"]} />,
    );
    // The 0 has no log position → dropped → 3 points rendered.
    expect(container.querySelectorAll(".brock-point").length).toBe(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("non-positive value(s)"),
    );
    spy.mockRestore();
  });

  it("renders 1·2·5 ticks on a log scale", () => {
    render(
      <LineChart
        data={[1, 10, 100]}
        yScale="log"
        yAxisFormat={(v) => `Y${v}`}
      />,
    );
    expect(screen.getByText("Y1")).toBeInTheDocument();
    expect(screen.getByText("Y100")).toBeInTheDocument();
  });
});

/* ─── Direct labels / legend ────────────────────────────────────────── */

describe("LineChart — direct labels & legend", () => {
  it("renders direct line-end labels for multi-series by default", () => {
    const { container } = render(
      <LineChart
        data={[
          { name: "Revenue", data: [10, 20] },
          { name: "Costs", data: [5, 8] },
        ]}
        labels={["x1", "x2"]}
      />,
    );
    // Direct labels are absolute spans anchored at the line ends (left-full).
    // The series name also appears in the sr-only table header, so scope the
    // assertion to the direct-label spans inside the plot.
    const labels = Array.from(
      container.querySelectorAll(".brock-plot span.left-full"),
    ).map((el) => el.textContent);
    expect(labels).toContain("Revenue");
    expect(labels).toContain("Costs");
  });

  it("legend='top' renders a chip row instead of direct labels", () => {
    const { container } = render(
      <LineChart
        data={[
          { name: "Revenue", data: [10, 20] },
          { name: "Costs", data: [5, 8] },
        ]}
        labels={["x1", "x2"]}
        legend="top"
      />,
    );
    const list = container.querySelector('[role="list"]');
    expect(list).toBeTruthy();
    expect(within(list as HTMLElement).getByText("Revenue")).toBeInTheDocument();
  });

  it("directLabelValues appends the last value to each label", () => {
    render(
      <LineChart
        data={[{ name: "Revenue", data: [10, 99] }]}
        labels={["x1", "x2"]}
        legend="direct"
        directLabels
        directLabelValues
        formatValue={(v) => String(v)}
      />,
    );
    expect(screen.getByText("Revenue 99")).toBeInTheDocument();
  });
});

/* ─── Events & bands ────────────────────────────────────────────────── */

describe("LineChart — events & bands", () => {
  it("renders a vertical event marker with its label", () => {
    render(
      <LineChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        events={[{ x: "B", label: "Launch" }]}
      />,
    );
    expect(screen.getByText("Launch")).toBeInTheDocument();
    expect(screen.getByLabelText(/Event: Launch/)).toBeInTheDocument();
  });

  it("renders a shaded band with its label", () => {
    const { container } = render(
      <LineChart
        data={[10, 20, 30, 40]}
        labels={["A", "B", "C", "D"]}
        bands={[{ from: "B", to: "C", label: "Q2 push" }]}
      />,
    );
    expect(container.querySelector(".brock-band")).toBeTruthy();
    expect(screen.getByText("Q2 push")).toBeInTheDocument();
  });
});

/* ─── Animation ─────────────────────────────────────────────────────── */

describe("LineChart — animation", () => {
  it("applies the animated plot class by default", () => {
    const { container } = render(<LineChart data={[10, 20]} />);
    expect(container.querySelector(".brock-plot-animated")).toBeTruthy();
  });

  it("omits the animated class when animation.enabled is false", () => {
    const { container } = render(
      <LineChart data={[10, 20]} animation={{ enabled: false }} />,
    );
    expect(container.querySelector(".brock-plot-animated")).toBeFalsy();
    expect(container.querySelector(".brock-plot")).toBeTruthy();
  });

  it("sets --brock-line-duration when a duration is provided", () => {
    const { container } = render(
      <LineChart data={[10, 20]} animation={{ duration: 900 }} />,
    );
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.style.getPropertyValue("--brock-line-duration")).toBe("900ms");
  });

  it("honors prefers-reduced-motion via a stylesheet rule", () => {
    const { container } = render(<LineChart data={[10, 20]} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});

/* ─── Forward-compat (figure data attributes) ───────────────────────── */

describe("LineChart — forward-compat props", () => {
  it("stamps data-chart-type onto the figure (default 'line')", () => {
    const { container } = render(<LineChart data={[10]} />);
    expect(
      container.querySelector("figure")?.getAttribute("data-chart-type"),
    ).toBe("line");
  });

  it("custom chartType overrides the default tag", () => {
    const { container } = render(
      <LineChart data={[10]} chartType="cohort-curve" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-chart-type"),
    ).toBe("cohort-curve");
  });

  it("dataDescription is stamped as data-description", () => {
    const { container } = render(
      <LineChart data={[10]} dataDescription="Revenue, last 6 months" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-description"),
    ).toBe("Revenue, last 6 months");
  });

  it("data-testid is forwarded onto the figure", () => {
    const { container } = render(
      <LineChart data={[10]} data-testid="revenue-line" />,
    );
    expect(
      container.querySelector("figure")?.getAttribute("data-testid"),
    ).toBe("revenue-line");
  });
});

/* ─── Event callbacks ───────────────────────────────────────────────── */

describe("LineChart — event callbacks", () => {
  it("onPointClick fires with the selection on click", async () => {
    const user = userEvent.setup();
    const onPointClick = vi.fn();
    render(
      <LineChart
        data={[{ name: "A", data: [10, 20], emphasis: true }]}
        labels={["x1", "x2"]}
        onPointClick={onPointClick}
      />,
    );
    const pts = screen.getAllByRole("button");
    await user.click(pts[1]);
    expect(onPointClick).toHaveBeenCalledTimes(1);
    const [selection] = onPointClick.mock.calls[0];
    expect(selection.index).toBe(1);
    expect(selection.series.name).toBe("A");
  });

  it("onPointFocus fires when keyboard nav moves between points", async () => {
    const user = userEvent.setup();
    const onPointFocus = vi.fn();
    render(
      <LineChart
        data={[10, 20, 30]}
        labels={["A", "B", "C"]}
        onPointFocus={onPointFocus}
      />,
    );
    const pts = screen.getAllByRole("button");
    pts[0].focus();
    onPointFocus.mockClear();
    await user.keyboard("{ArrowRight}");
    expect(onPointFocus.mock.calls.at(-1)?.[0].index).toBe(1);
  });
});

/* ─── Imperative ref API ────────────────────────────────────────────── */

describe("LineChart — imperative ref API", () => {
  function Harness({
    refOut,
    data,
  }: {
    refOut: { handle: React.RefObject<LineChartHandle | null> | null };
    data?: LineChartProps["data"];
  }) {
    const handle = useRef<LineChartHandle>(null);
    refOut.handle = handle;
    return (
      <LineChart
        ref={handle}
        data={data ?? [{ name: "A", data: [10, 20, 30], emphasis: true }]}
        labels={["x1", "x2", "x3"]}
      />
    );
  }

  it("exposes export + focus methods", () => {
    const refOut: { handle: React.RefObject<LineChartHandle | null> | null } = {
      handle: null,
    };
    render(<Harness refOut={refOut} />);
    const api = refOut.handle!.current!;
    expect(typeof api.exportSVG).toBe("function");
    expect(typeof api.exportPNG).toBe("function");
    expect(typeof api.exportCSV).toBe("function");
    expect(typeof api.copyImage).toBe("function");
    expect(typeof api.focusPoint).toBe("function");
    expect(typeof api.getSelection).toBe("function");
  });

  it("focusPoint(n) clamps and returns the focused index", () => {
    const refOut: { handle: React.RefObject<LineChartHandle | null> | null } = {
      handle: null,
    };
    render(<Harness refOut={refOut} />);
    expect(refOut.handle!.current!.focusPoint(1)).toBe(1);
    expect(refOut.handle!.current!.focusPoint(99)).toBe(2);
    expect(refOut.handle!.current!.focusPoint(-5)).toBe(0);
  });

  it("getSelection returns the focused point + series", () => {
    const refOut: { handle: React.RefObject<LineChartHandle | null> | null } = {
      handle: null,
    };
    render(<Harness refOut={refOut} />);
    refOut.handle!.current!.focusPoint(2);
    const sel = refOut.handle!.current!.getSelection();
    expect(sel?.index).toBe(2);
    expect(sel?.series.name).toBe("A");
  });

  it("focusPoint returns -1 and getSelection null when no data", () => {
    const refOut: { handle: React.RefObject<LineChartHandle | null> | null } = {
      handle: null,
    };
    render(<Harness refOut={refOut} data={[]} />);
    expect(refOut.handle!.current!.focusPoint(0)).toBe(-1);
    expect(refOut.handle!.current!.getSelection()).toBeNull();
  });

  it("exportSVG returns a string without downloading when download=false", () => {
    const refOut: { handle: React.RefObject<LineChartHandle | null> | null } = {
      handle: null,
    };
    const downloadSpy = vi.fn();
    URL.createObjectURL = downloadSpy;
    URL.revokeObjectURL = vi.fn();
    render(<Harness refOut={refOut} />);
    const svg = refOut.handle!.current!.exportSVG({ download: false });
    expect(svg).toContain("<svg ");
    expect(downloadSpy).not.toHaveBeenCalled();
  });
});

/* ─── toJSON / fromJSON ─────────────────────────────────────────────── */

describe("toJSON / fromJSON", () => {
  it("includes $schema and strips functions / callbacks / nodes", () => {
    const json = toJSON({
      data: [10, 20, 30],
      labels: ["A", "B", "C"],
      height: 240,
      accent: "#FF0000",
      onPointClick: () => {},
      formatValue: (v: number) => `${v}!`,
      slots: { tooltip: () => null },
      className: "my-class",
    });
    expect(json.$schema).toBe(LINE_CHART_JSON_SCHEMA);
    expect(json.data).toEqual([10, 20, 30]);
    expect(json.labels).toEqual(["A", "B", "C"]);
    expect(json.accent).toBe("#FF0000");
    expect(JSON.stringify(json)).not.toContain("onPointClick");
    expect(JSON.stringify(json)).not.toContain("formatValue");
    expect(JSON.stringify(json)).not.toContain("slots");
    expect(JSON.stringify(json)).not.toContain("className");
  });

  it("normalizes error: Error → message, string stays, null dropped", () => {
    expect(toJSON({ data: [], error: new Error("boom") }).error).toBe("boom");
    expect(toJSON({ data: [], error: "string error" }).error).toBe(
      "string error",
    );
    expect("error" in toJSON({ data: [], error: null })).toBe(false);
  });

  it("toJSON → fromJSON roundtrip is stable for serializable props", () => {
    const original = {
      data: [
        { name: "Revenue", data: [10, 20, 30] },
        { name: "Costs", data: [5, 8, 12] },
      ],
      labels: ["A", "B", "C"],
      height: 320,
      emphasisSeries: "Revenue",
      curve: "monotone" as const,
      yScale: "log" as const,
      referenceLine: { value: 25, label: "Target" },
      source: "FT",
      caption: "Excludes weekends",
      events: [{ x: "B", label: "Launch" }],
      bands: [{ from: "A", to: "B", label: "Q1" }],
      chartType: "line",
      dataDescription: "Revenue vs costs",
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
        $schema: "brock-ui/line-chart@99",
        data: [1],
      } as LineChartJSON);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain("brock-ui/line-chart@99");
    } finally {
      spy.mockRestore();
    }
  });
});

/* ─── pointsToCSV (tidy shape) ──────────────────────────────────────── */

describe("pointsToCSV", () => {
  const series: ExportSeries[] = [
    {
      name: "Revenue",
      color: "#F54900",
      points: [
        { x: 0, y: 10, xLabel: "JAN" },
        { x: 1, y: 20, xLabel: "FEB" },
      ],
    },
    {
      name: "Costs",
      color: "#71717A",
      points: [
        { x: 0, y: 5, xLabel: "JAN" },
        { x: 1, y: null, xLabel: "FEB" },
      ],
    },
  ];

  it("emits a tidy header: x + one column per series", () => {
    const csv = pointsToCSV(series);
    expect(csv.split("\r\n")[0]).toBe("x,Revenue,Costs");
  });

  it("uses the x label and leaves gaps blank", () => {
    const csv = pointsToCSV(series);
    const rows = csv.split("\r\n");
    expect(rows[1]).toBe("JAN,10,5");
    // Costs is null at FEB → trailing blank cell.
    expect(rows[2]).toBe("FEB,20,");
  });

  it("terminates with CRLF (RFC 4180)", () => {
    expect(pointsToCSV(series).endsWith("\r\n")).toBe(true);
  });

  it("quotes cells containing commas or quotes", () => {
    const csv = pointsToCSV([
      {
        name: 'A,B"C',
        color: "#000",
        points: [{ x: 0, y: 1, xLabel: "x" }],
      },
    ]);
    expect(csv.split("\r\n")[0]).toContain('"A,B""C"');
  });
});

/* ─── synthesizeSVG (smoke) ─────────────────────────────────────────── */

function ctx(overrides: Partial<SynthesisContext> = {}): SynthesisContext {
  const series: ExportSeries[] = overrides.series ?? [
    {
      name: "Revenue",
      color: "#F54900",
      emphasis: true,
      points: [
        { x: 0, y: 10, xLabel: "A" },
        { x: 1, y: 20, xLabel: "B" },
        { x: 2, y: 30, xLabel: "C" },
      ],
    },
  ];
  return {
    width: 800,
    height: 400,
    series,
    xMin: 0,
    xMax: 2,
    yMin: 0,
    yMax: 30,
    yScale: "linear",
    xScale: "point",
    curve: "linear",
    lineWidth: 1.75,
    showMarkers: false,
    lastValueDot: false,
    gridlines: true,
    directLabels: true,
    directLabelValues: false,
    accent: "#F54900",
    seriesMuted: "#a1a1aa",
    foreground: "#0a0a0a",
    muted: "#666666",
    border: "#e5e5e5",
    background: "#ffffff",
    yTicks: [0, 15, 30],
    yAxisFormat: (v) => String(v),
    formatValue: (v) => String(v),
    xTicks: [0, 1, 2],
    xAxisFormat: (v) => String(v),
    showYTicks: true,
    showXTicks: true,
    description: "Line chart test",
    ...overrides,
  };
}

describe("synthesizeSVG", () => {
  it("produces a well-formed SVG with viewBox + a11y title/desc", () => {
    const svg = synthesizeSVG(ctx());
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 800 400"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>Line chart test</title>");
    expect(svg).toContain("<desc>Line chart test</desc>");
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("renders one <path> per series", () => {
    const svg = synthesizeSVG(
      ctx({
        series: [
          {
            name: "A",
            color: "#F54900",
            points: [
              { x: 0, y: 10 },
              { x: 1, y: 20 },
            ],
          },
          {
            name: "B",
            color: "#71717A",
            points: [
              { x: 0, y: 5 },
              { x: 1, y: 8 },
            ],
          },
        ],
      }),
    );
    expect((svg.match(/<path d="/g) ?? []).length).toBe(2);
  });

  it("renders a dashed reference line + chip when set", () => {
    const svg = synthesizeSVG(
      ctx({ referenceLine: { value: 25, label: "Target" } }),
    );
    expect(svg).toContain('stroke-dasharray="4 2"');
    expect(svg).toContain("Target");
  });

  it("escapes XML special characters in labels / source", () => {
    const svg = synthesizeSVG(
      ctx({
        series: [
          {
            name: "<A>&B",
            color: "#F54900",
            points: [{ x: 0, y: 10 }],
          },
        ],
        source: "FT <data>",
      }),
    );
    expect(svg).not.toContain("<A>&B");
    expect(svg).toContain("&lt;A&gt;&amp;B");
    expect(svg).toContain("FT &lt;DATA&gt;");
  });
});

/* ─── renderToHTMLString ────────────────────────────────────────────── */

describe("renderToHTMLString", () => {
  it("wraps the SVG in a div with role=img + description aria-label", () => {
    const html = renderToHTMLString({
      data: [
        { name: "Revenue", data: [10, 20, 30] },
        { name: "Costs", data: [5, 8, 12] },
      ],
      labels: ["A", "B", "C"],
      source: "FT",
    });
    expect(html).toMatch(/^<div role="img" aria-label="[^"]+"/);
    expect(html).toContain("Line chart with 2 series");
    expect(html).toContain("Source: FT");
    expect(html).toContain("<svg ");
    expect(html.trim().endsWith("</div>")).toBe(true);
  });

  it("includes data-chart-type / data-description on the wrapper", () => {
    const html = renderToHTMLString({
      data: [10],
      chartType: "cohort-curve",
      dataDescription: "Weekly retention",
    });
    expect(html).toContain('data-chart-type="cohort-curve"');
    expect(html).toContain('data-description="Weekly retention"');
  });

  it("escapes attribute values (no HTML injection via dataDescription)", () => {
    const html = renderToHTMLString({
      data: [10],
      dataDescription: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

/* ─── Docs page props-table drift guard (canon §14) ─────────────────── */

describe("docs page — props table drift guard", () => {
  it("every public prop of LineChartProps is mentioned on the docs page", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const componentSrc = fs.readFileSync(
      path.resolve(__dirname, "./line-chart.tsx"),
      "utf-8",
    );
    const pageSrc = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../app/[locale]/components/line-chart/page.tsx",
      ),
      "utf-8",
    );
    const ifaceStart = componentSrc.indexOf("export type LineChartProps = {");
    const ifaceEnd = componentSrc.indexOf(
      String.fromCharCode(10) + "};",
      ifaceStart,
    );
    const iface = componentSrc.slice(ifaceStart, ifaceEnd);
    const propNames = [
      ...iface.matchAll(/^  (?:"([\w-]+)"|([a-zA-Z]\w*))\??:/gm),
    ]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean);
    expect(propNames.length).toBeGreaterThan(30);
    const missing = propNames.filter((name) => !pageSrc.includes(name));
    expect(missing).toEqual([]);
  });
});
