<div align="center">

# Brock UI

### Editable React components for charts and data, installable straight from the [shadcn](https://ui.shadcn.com) registry.

[![License: MIT](https://img.shields.io/badge/License-MIT-000000.svg)](./LICENSE)
[![shadcn registry](https://img.shields.io/badge/shadcn-registry-000000.svg)](https://ui.shadcn.com/docs/registry)
[![React 19](https://img.shields.io/badge/React-19-000000.svg?logo=react)](https://react.dev)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org)
[![GitHub stars](https://img.shields.io/github/stars/brockui/brockui?style=flat&color=F54900)](https://github.com/brockui/brockui/stargazers)

**[brockui.com](https://brockui.com)** · [Components](https://brockui.com/components/column-chart) · [Installation](https://brockui.com/installation) · [Author](https://kasymzhanov.com)

</div>

---

Brock UI is an open-source registry of opinionated React components for charts and data. You copy the source straight into your project through the shadcn CLI, then own and edit it like any other file in your codebase – no runtime package to install, no API to learn, no lock-in.

It is built by [Almas Kasymzhanov](https://kasymzhanov.com), a data journalist, analyst, developer, and entrepreneur, for the people who do that work too: **journalists, frontend developers, and data-visualization designers**. Every component is a tool he reaches for in his own daily work, and the registry grows as that work does.

Each chart is hand-built in SVG with a clear point of view, grounded in the data-visualization canon (Edward Tufte's data-ink, the Financial Times / John Burn-Murdoch school of data journalism): one accent color, no decorative chrome, monospace numerics, direct value labels, honest baselines, and built-in source attribution.

## Why Brock UI

- **You own the code.** Components install as source files via the shadcn registry. Edit them, theme them, delete the parts you do not need. There is no `node_modules` dependency to track.
- **Opinionated, not generic.** A deliberate design point of view out of the box, instead of a neutral starting point you have to style yourself.
- **Dependency-light.** Charts are hand-written SVG. No charting library, no D3 in your bundle – just React and the styling you already have.
- **Production-grade by default.** TypeScript strict, full keyboard navigation, WCAG 2.2 AA semantics, screen-reader table summaries, SSR-safe rendering, light + dark themes, and PNG / SVG / CSV export.
- **Bilingual.** Docs and component copy ship in English and Russian.
- **MIT all the way down.** Fonts ([Geist](https://vercel.com/font), [Hack](https://sourcefoundry.org/hack/), [Departure Mono](https://departuremono.com)), primitives ([Radix](https://www.radix-ui.com)), styling ([Tailwind](https://tailwindcss.com)), and distribution (shadcn registry). Nothing carries license friction downstream.

## Quick start

Add a component to any React project that uses the [shadcn CLI](https://ui.shadcn.com/docs/cli):

```bash
npx shadcn@latest add https://brockui.com/r/column-chart.json
```

Then use it:

```tsx
import { ColumnChart } from "@/components/charts/column-chart";

export function ActiveUsers() {
  return (
    <ColumnChart
      data={[142, 168, 187, 159, 203, 178, 215]}
      labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
      header={{ title: "Active users", subtitle: "Last 7 days" }}
      trend={0.184}
      source="Brock Analytics, 2026"
    />
  );
}
```

Every component has a live, three-panel studio on [brockui.com](https://brockui.com): tweak the settings on the right, watch the chart update in the middle, and copy the generated code on the left.

## Components

Installable today (`npx shadcn@latest add https://brockui.com/r/<name>.json`):

| Component | Status | What it is |
| --- | --- | --- |
| [Column Chart](https://brockui.com/components/column-chart) | Stable | Vertical bars for ordered categories – time buckets and rankings. |
| [Bar Chart](https://brockui.com/components/bar-chart) | Stable | Horizontal bars for ranked categorical comparisons. |
| [Line Chart](https://brockui.com/components/line-chart) | Stable | Multi-series trends with direct labels and honest gaps. |

**On the roadmap:** Area Chart, Stacked Bar Chart, Pie, Donut, Histogram, Scatter Plot, Heatmap, Funnel Chart, Metric Card, and a Flow layer of components for AI-agent interfaces (execution graphs, tool-call inspectors, streaming token views).

## Design principles

These are non-negotiable and visible in every component:

1. **Data-ink discipline (Tufte).** Every pixel serves the data or is removed. No gridlines by default, no drop shadows, no gradients.
2. **One accent color.** A single `--brock-accent` carries emphasis; everything else is a monochrome scale.
3. **Numbers live in monospace.** Values, axes, and tooltips use Hack mono with tabular figures so digits line up.
4. **Direct labels over legends.** Label the data in place; reach for a legend only when you must.
5. **Honest baselines.** Column charts anchor at zero. A truncated baseline turns bar length into a lie.
6. **Source attribution is built in.** Charts accept a `source` prop and render the credit by default (the FT / Bloomberg pattern).
7. **Accessibility is not optional.** Radix primitives, keyboard paths, and a visually-hidden data table for screen readers.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) and [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org) in strict mode
- [Tailwind CSS v4](https://tailwindcss.com) with CSS variables for theming
- [Radix UI](https://www.radix-ui.com) primitives via the unified `radix-ui` package
- [shadcn](https://ui.shadcn.com) registry format for distribution
- [next-intl](https://next-intl.dev) for English / Russian docs
- Typography: [Geist Sans](https://vercel.com/font) (UI), [Hack](https://sourcefoundry.org/hack/) (data and code), [Departure Mono](https://departuremono.com) (pixel accents)

## Repository structure

```
brockui/
├── apps/
│   └── docs/                  # Next.js docs site (brockui.com)
│       ├── app/[locale]/      # EN / RU routes
│       ├── components/
│       │   ├── charts/        # the shipped chart components
│       │   ├── playground/    # the live "studio" for each chart
│       │   └── chrome/        # header, sidebar, theme + locale switchers
│       ├── messages/          # i18n catalogs (en.json, ru.json)
│       ├── registry.json      # shadcn registry index
│       └── public/r/          # generated registry endpoints
└── packages/                  # reserved for extracted packages
```

## Local development

Requires [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io) 9+.

```bash
pnpm install        # install workspace dependencies
pnpm dev            # start the docs site at http://localhost:3000
pnpm test           # run the test suite (Vitest)
pnpm build          # rebuild the registry and produce a production build
```

The registry endpoints under `apps/docs/public/r/` are generated by `shadcn build` (run automatically as part of `pnpm build`). After editing a shipped component, regenerate them with `pnpm --filter @brockui/docs registry:build`.

## Contributing

Brock UI is in active early development and the component set is intentionally small and deep rather than broad. Issues and discussions are welcome – if you have found a bug, a rough accessibility edge, or a chart the canon is missing, open an issue. For larger changes, please open an issue to discuss the direction before sending a pull request, so it fits the design point of view above.

## Author

**Almas Kasymzhanov** – data journalist, analyst, developer, and entrepreneur, based in Kazakhstan. Brock UI is his public, open-source toolkit: the components he uses to turn data into things people can read.

- Website: [kasymzhanov.com](https://kasymzhanov.com)
- X / Twitter: [@akasymzhanov](https://x.com/akasymzhanov) · project: [@getbrockui](https://x.com/getbrockui)
- GitHub: [@AlmasKasymzhanov](https://github.com/AlmasKasymzhanov)

## License

[MIT](./LICENSE) © Almas Kasymzhanov. Use it, fork it, ship it.

## Credits

Built on the shoulders of [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com), and [Tailwind CSS](https://tailwindcss.com). The design thesis draws on Edward Tufte (*The Visual Display of Quantitative Information*), Cole Nussbaumer Knaflic (*Storytelling with Data*), and the data-journalism work of the Financial Times, The Pudding, and Stripe's annual letters.
