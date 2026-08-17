import { createChartScene } from "@tanstack/charts";
import { describe, expect, it } from "vitest";

import { CHART_GOLD, faMoneyTick, faToman } from "@/lib/charts";

import {
  defineRevenueAreaChart,
  formatRevenueTooltip,
  type RevenuePoint,
} from "./RevenueAreaChart";

const rows: RevenuePoint[] = [
  { day: "۱ فروردین", revenue: 12_000_000 },
  { day: "۲ فروردین", revenue: 18_500_000 },
  { day: "۳ فروردین", revenue: 9_250_000 },
];

describe("formatRevenueTooltip", () => {
  it("joins the day label with a Persian Toman amount", () => {
    expect(formatRevenueTooltip({ datum: rows[1]! })).toBe(
      `${rows[1]!.day}: ${faToman(18_500_000)}`,
    );
  });
});

describe("defineRevenueAreaChart", () => {
  it("materializes one gold series from { day, revenue } rows", () => {
    const scene = createChartScene(defineRevenueAreaChart(rows), {
      width: 720,
      height: 256,
    });

    const linePoints = scene.points.filter(
      (point) => point.markId === "revenue-line",
    );
    expect(linePoints).toHaveLength(rows.length);
    expect(linePoints.map((point) => point.datum)).toEqual(rows);
    expect(linePoints.every((point) => point.color === CHART_GOLD)).toBe(true);

    const fill = scene.gradients.find(
      (gradient) => gradient.id === "revenue-fill",
    );
    expect(fill?.stops.some((stop) => stop.color === CHART_GOLD)).toBe(true);

    const yLabels = scene.scales.y?.ticks.map((tick) => tick.label) ?? [];
    expect(yLabels.length).toBeGreaterThan(0);
    expect(yLabels).toContain(faMoneyTick(0));
    expect(yLabels.every((label) => label.endsWith("م"))).toBe(true);
  });
});
