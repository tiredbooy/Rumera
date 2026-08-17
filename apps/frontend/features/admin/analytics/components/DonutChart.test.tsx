// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SLICE_COLORS } from "@/lib/charts";

import { DonutLegend } from "./DonutChart";

afterEach(() => {
  cleanup();
});

const slices = [
  { label: "تکمیل شده", value: 12 },
  { label: "لغو شده", value: 3 },
];

describe("DonutLegend", () => {
  it("renders Persian labels, fa-IR values, and slice colours", () => {
    render(<DonutLegend data={slices} />);

    expect(screen.getByText("تکمیل شده")).toBeInTheDocument();
    expect(screen.getByText("لغو شده")).toBeInTheDocument();
    expect(screen.getByText("۱۲")).toBeInTheDocument();
    expect(screen.getByText("۳")).toBeInTheDocument();

    const swatches = document.querySelectorAll("li span.size-2\\.5");
    expect(swatches).toHaveLength(2);
    expect(swatches[0]).toHaveStyle({ background: SLICE_COLORS[0] });
    expect(swatches[1]).toHaveStyle({ background: SLICE_COLORS[1] });
  });
});
