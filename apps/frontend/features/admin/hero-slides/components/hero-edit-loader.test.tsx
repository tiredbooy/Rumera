// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSlideMock, useQueryMock } = vi.hoisted(() => ({
  getSlideMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("@/features/hero-slides/api/client", () => ({
  getAdminHeroSlide: getSlideMock,
  HeroSlideApiError: class HeroSlideApiError extends Error {
    constructor(public readonly status: number) {
      super("خطا");
    }
  },
}));

vi.mock("@/features/admin/hero-slides/components/hero-form", () => ({
  HeroForm: ({ slide }: { slide: { title: string } }) => (
    <p>ویرایش {slide.title}</p>
  ),
}));

import { HeroEditLoader } from "./hero-edit-loader";
import { HeroSlideApiError } from "@/features/hero-slides/api/client";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HeroEditLoader", () => {
  it("queries the requested detail instead of loading the full collection", async () => {
    const slide = { id: 17, title: "تابستان" };
    getSlideMock.mockResolvedValue(slide);
    useQueryMock.mockReturnValue({
      data: slide,
      error: null,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<HeroEditLoader id={17} />);

    expect(screen.getByText("ویرایش تابستان")).toBeInTheDocument();
    const options = useQueryMock.mock.calls[0]?.[0];
    expect(options.queryKey).toEqual(["admin", "hero-slides", 17]);
    expect(
      options.retry(0, new HeroSlideApiError(404, "NOT_FOUND", "missing")),
    ).toBe(false);
    expect(
      options.retry(0, new HeroSlideApiError(500, "INTERNAL", "failed")),
    ).toBe(true);
    expect(
      options.retry(3, new HeroSlideApiError(500, "INTERNAL", "failed")),
    ).toBe(false);
    await expect(options.queryFn()).resolves.toEqual(slide);
    expect(getSlideMock).toHaveBeenCalledWith(17);
  });
});
