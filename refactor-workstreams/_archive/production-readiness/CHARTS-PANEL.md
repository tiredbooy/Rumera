# TanStack Charts panel (founder)

**Package:** `@tanstack/charts@0.14.0`  
**React:** `import { Chart } from "@tanstack/charts/react"`  
**Grammar:** `import { defineChart, areaY, lineY, barY, … } from "@tanstack/charts"`  
**Docs:** https://tanstack.com/charts/latest

## Exclusive files

| Agent | Task | Exclusive files |
| --- | --- | --- |
| charts-kernel | PR-100a | `apps/frontend/lib/charts/**`, `next.config.ts` (optimizePackageImports only) |
| charts-revenue | PR-100b | `…/RevenueAreaChart.tsx` (new), `RevenueChartSection.tsx` |
| charts-orders | PR-100c | `…/OrdersBarChart.tsx` (new), `AnalyticsRevenueCharts.tsx` |
| charts-donut | PR-100d | `…/DonutChart.tsx` (new), `OrderStatusSection.tsx` |
| charts-monitoring | PR-100e | `MonitoringCharts.tsx` |
| charts-rankings-cleanup | PR-100f | `HorizontalBars.tsx` (new), `AnalyticsTopProducts.tsx`, `AnalyticsEventBreakdown.tsx`, `components/ui/chart.tsx`, `package.json` recharts removal **only after grep is clean** |

Do not edit `Charts.tsx` except to re-export new modules (one unique export line each). Prefer importing the new files directly from consumers.

Quality: gold `oklch(0.72 0.15 75)`, blue `oklch(0.62 0.16 250)`, RTL, `faNum`, reduced-motion, Persian tooltips, existing empty/error cards.
