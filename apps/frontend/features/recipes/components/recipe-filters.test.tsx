// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/recipes",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));

import { RecipeFilters } from "./recipe-filters";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.params = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RecipeFilters", () => {
  it("preserves search, difficulty, and sort through rapid changes", () => {
    render(<RecipeFilters query={{ sort: "new" }} />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "جستجوی دستورها" }),
      { target: { value: "موخیتو" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "متوسط" }));
    fireEvent.change(screen.getByRole("combobox", { name: "مرتب‌سازی دستورها" }), {
      target: { value: "quick" },
    });

    expect(mocks.replace).toHaveBeenCalledTimes(2);
    const href = String(mocks.replace.mock.calls.at(-1)?.[0]);
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("q")).toBe("موخیتو");
    expect(url.searchParams.get("difficulty")).toBe("medium");
    expect(url.searchParams.get("sort")).toBe("quick");
    expect(url.hash).toBe("#recipe-results-title");

    vi.advanceTimersByTime(400);
    expect(mocks.replace).toHaveBeenCalledTimes(2);
  });
});
