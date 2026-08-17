---
tags: [frontend, admin]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Admin Analytics

## What it is

Staff dashboards for revenue, products, search terms, events — backed by analytics DB APIs (not the main catalogue DB joins).

## Surfaces

| Area | Components (under `features/admin/analytics/`) |
|------|--------------------------------------------------|
| Admin home | `RevenueCards`, `RevenueChartSection` (`RevenueAreaChart`), `OrderStatusSection` (`DonutChart` pie/donut), `RecentOrdersTable`, `LowStockList` (live `product_title`, else SKU / `#id` — PR-063c) |
| Boards | `DashboardBoard`, KPIs, range toggle |
| Revenue / orders | `AnalyticsRevenueCharts` — gold `RevenueAreaChart` (`areaY` + `lineY`) + blue `OrdersBarChart` (`barY`) |
| Search analytics | `AnalyticsSearchTerms` (top / zero-result / converting) |
| Products | `AnalyticsTopProducts` + TanStack `barX` (`HorizontalBars`) |
| Events | `AnalyticsEventBreakdown` + TanStack `barX` (`HorizontalBars`) |
| Monitoring (related) | separate [[Admin Console]] monitoring board |

## Data

- Client/server helpers in `features/analytics/api.ts`
- Permission: typically `analytics:read` → [[RBAC]]
- Backend rollups: [[Analytics]] · [[Search Backend]] search_summary job

## Charts

Daily revenue (`RevenueChartSection` / `AnalyticsRevenueCharts`) is a gold
TanStack `areaY` + `lineY` (`RevenueAreaChart`, `CHART_GOLD`). Tooltips are
`faToman`; Y ticks are `faMoneyTick`.

Daily order counts are a vertical TanStack `barY` (`OrdersBarChart`) in blue
`oklch(0.62 0.16 250)`. Rankings (top products, event mix) are horizontal
TanStack `barX` in `HorizontalBars` — wine for products, blue for events;
product bars with an `href` navigate on select. Today's order-status mix is a
TanStack `pie` / `radialArc` donut (`DonutChart`) with center total + Persian
`DonutLegend` (`SLICE_COLORS`). Tooltips/ticks use `faNum`; `dir="rtl"` via
`RumeraChart`; animation off when `prefers-reduced-motion`. Empty and error
cards stay text.

Recharts is gone from the frontend package. Rankings, revenue, orders,
donut, and monitoring all use TanStack Charts via `RumeraChart` from
`@/lib/charts` (the unused `components/ui/chart.tsx` re-export was removed
in PR-090i).

Project depth: `apps/frontend/docs/features/admin-console.md` (Analytics charts).

## Chart kernel (PR-100a)

Import from `@/lib/charts` (`RumeraChart`, `rumeraChartTheme`, `faTick` / `faMoneyTick`, gold/blue tokens). Grammar marks (`defineChart`, `areaY`, `barY`, …) stay on `@tanstack/charts`. RTL host + `--ts-chart-*` palette. Reduced motion is `svgAnimation.respectReducedMotion` on the definition (`rumeraSvgAnimation`) — the React `Chart` adapter has no motion prop.

Bridge: `apps/frontend/docs/features/admin-console.md` (Admin charts) · `apps/frontend/lib/charts/`

## Truthfulness

Unconfigured/offline Prometheus is separate (monitoring). Analytics APIs should show empty/error states without inventing series.

## Related

[[Analytics]] · [[Admin Console]] · [[Search]] · [[Observability]] · [[Surface Admin]]

#frontend #admin
