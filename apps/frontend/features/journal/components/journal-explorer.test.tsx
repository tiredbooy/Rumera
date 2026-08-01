// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/journal",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));

import { JournalExplorer } from "./journal-explorer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.params = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("JournalExplorer", () => {
  it("commits search and sort atomically without a stale debounce overwrite", () => {
    render(<JournalExplorer query={{ sort: "new" }} />);

    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "جستجو در همهٔ نوشته‌های ژورنال",
      }),
      { target: { value: "مالت" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "پربازدیدترین" }));

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    const href = String(mocks.replace.mock.calls[0]?.[0]);
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("q")).toBe("مالت");
    expect(url.searchParams.get("sort")).toBe("popular");
    expect(url.hash).toBe("#journal-results-title");

    vi.advanceTimersByTime(400);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });
});
