import { createChartScene } from "@tanstack/charts";
import { describe, expect, it } from "vitest";

import { CHART_WINE } from "@/lib/charts/theme";
import { faNum } from "@/lib/products";

import {
  defineHorizontalRankingChart,
  formatRankingTooltip,
  rankHorizontalBars,
  type RankingBar,
} from "./HorizontalBars";

const rows: RankingBar[] = [
  { label: "بازدید محصول", value: 12 },
  { label: "جستجو", value: 40 },
  { label: "ایجاد سفارش", value: 7 },
];

describe("rankHorizontalBars", () => {
  it("sorts largest value first without mutating the input", () => {
    const ranked = rankHorizontalBars(rows);
    expect(ranked.map((row) => row.label)).toEqual([
      "جستجو",
      "بازدید محصول",
      "ایجاد سفارش",
    ]);
    expect(rows[0]?.label).toBe("بازدید محصول");
  });
});

describe("formatRankingTooltip", () => {
  it("joins the category with the formatted value", () => {
    expect(formatRankingTooltip("جستجو", faNum(40))).toBe(
      `جستجو: ${faNum(40)}`,
    );
  });
});

describe("defineHorizontalRankingChart", () => {
  it("materializes one horizontal bar per ranked row", () => {
    const scene = createChartScene(
      defineHorizontalRankingChart(rows, {
        color: CHART_WINE,
        valueFormatter: faNum,
        reduced: true,
      }),
      { width: 480, height: 220 },
    );

    const bars = scene.points.filter((point) => point.markId === "ranking");
    expect(bars).toHaveLength(rows.length);
    expect(bars.map((point) => point.datum.label)).toEqual([
      "جستجو",
      "بازدید محصول",
      "ایجاد سفارش",
    ]);
    expect(bars.every((point) => point.color === CHART_WINE)).toBe(true);

    const xLabels = scene.scales.x?.ticks.map((tick) => tick.label) ?? [];
    expect(xLabels.length).toBeGreaterThan(0);
    expect(xLabels.every((label) => /[۰-۹]/.test(label))).toBe(true);
  });
});
