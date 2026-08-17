import type { ChartTheme } from "@tanstack/charts"

/** Revenue / primary series — matches admin `Charts.tsx` GOLD. */
export const CHART_GOLD = "oklch(0.72 0.15 75)"

/** Orders / secondary series — matches admin `Charts.tsx` BLUE. */
export const CHART_BLUE = "oklch(0.62 0.16 250)"

/** Wine accent — second donut slice in admin `SLICE_COLORS`. */
export const CHART_WINE = "oklch(0.55 0.18 25)"

/** Muted grid: cellar `--border` (same token as `stroke-border`). */
export const CHART_GRID = "var(--border)"

/** Donut / categorical palette — keep in lock-step with admin `SLICE_COLORS`. */
export const SLICE_COLORS = [
  CHART_GOLD,
  CHART_WINE,
  CHART_BLUE,
  "oklch(0.68 0.14 160)",
  "oklch(0.6 0.16 320)",
  "oklch(0.7 0.13 130)",
  "oklch(0.58 0.05 250)",
] as const

export const rumeraChartTheme: Partial<ChartTheme> = {
  foreground: "currentColor",
  muted: "var(--muted-foreground)",
  grid: CHART_GRID,
  background: "transparent",
  palette: SLICE_COLORS,
}

/** `--ts-chart-*` overrides the library’s default categorical palette. */
export const rumeraChartCssVars = {
  "--ts-chart-1": CHART_GOLD,
  "--ts-chart-2": CHART_WINE,
  "--ts-chart-3": CHART_BLUE,
  "--ts-chart-4": SLICE_COLORS[3],
  "--ts-chart-5": SLICE_COLORS[4],
  "--ts-chart-6": SLICE_COLORS[5],
} as const
