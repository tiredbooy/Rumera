// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

import { AnalyticsErrorState } from "./AnalyticsErrorState";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AnalyticsErrorState", () => {
  it("announces the failure and refreshes the server data on retry", () => {
    render(<AnalyticsErrorState>دریافت آمار ناموفق بود</AnalyticsErrorState>);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "دریافت آمار ناموفق بود",
    );
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });
});
