# Brock UI

Opinionated React components for modern data and AI products. Built on the [shadcn](https://ui.shadcn.com) registry. MIT licensed.

**Micrographics-first, density-with-discipline, monospace where data lives.**

## Philosophy

- **Data-ink discipline** (Tufte) — one accent color, no decorative chrome, the data is the chart
- **Vertical specialist** in the shadcn ecosystem (data viz + AI agent UI), not another horizontal component library
- **Honest credit** — every component documents what shadcn / Radix / open-source primitive it builds on
- **MIT all the way down** — fonts (Geist, Hack, Departure Mono), primitives (Radix), styling (Tailwind), distribution (shadcn registry). No license friction for downstream users.

## Status

**Phase 0 — Foundation.** The docs site, design tokens, and first components are in active development. Not yet on npm. Not yet shipping a public registry endpoint.

What works today:
- Docs site under `apps/docs/`
- First chart component: `Column Chart` (time-series vertical bars)
- Sparkline (Tufte word-sized chart)
- Cmd+K palette, hover-expand sidebar, dot-matrix branding

What's coming:
- Public registry at `brockui.com/r/<component>`
- Metric Card (priority Phase 0 component)
- Bar Chart, Line Chart, Area Chart, Heatmap, Funnel Chart
- Agent Flow Visualizer, Tool Call Inspector, Streaming Tokens (Flow components)

## Repo structure

```
brockui/
├── apps/
│   └── docs/          ← Next.js docs site (brockui.com)
└── packages/
    ├── core/          ← shadcn-with-opinion primitives (charts, cards, tables)
    └── flow/          ← AI agent UI (visualizers, inspectors, streams)
```

## Development

```bash
pnpm install
pnpm dev
```

Docs site runs at http://localhost:3000.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** with CSS variables for theming
- **shadcn/ui** registry format
- **Radix UI** primitives via unified `radix-ui` package
- Typography: **Geist Sans** (UI), **Hack** (data/code), **Departure Mono** (pixel accents) — all MIT/OFL

## License

MIT — see [LICENSE](./LICENSE).

## Credits

Built on the shoulders of: [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com), [Tailwind CSS](https://tailwindcss.com), [Geist Sans](https://vercel.com/font), [Hack](https://sourcefoundry.org/hack/), [Departure Mono](https://departuremono.com).

Design thesis informed by Edward Tufte (*The Visual Display of Quantitative Information*), Cole Knaflic (*Storytelling with Data*), and the data journalism canon (FT, Pudding, Stripe Annual Letters).
