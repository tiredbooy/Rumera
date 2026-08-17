// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  push: vi.fn(),
  searchParams: vi.fn(),
  useAdminReviews: vi.fn(),
  useModerateReview: vi.fn(),
  listQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/reviews",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/features/reviews/hooks", () => ({
  useAdminReviews: (query: unknown) => {
    mocks.listQuery(query);
    return mocks.useAdminReviews();
  },
  useModerateReview: mocks.useModerateReview,
}));

import type { AdminReview } from "@/features/reviews/types";

import { ReviewsQueue } from "./ReviewsQueue";

function sampleReview(
  overrides: Partial<AdminReview> & {
    product_title?: string | null;
    product_slug?: string | null;
  } = {},
): AdminReview {
  return {
    id: 12,
    title: "عالی",
    content: "نرم و دودی.",
    rating: 5,
    user_id: 42,
    user_full_name: "سارا احمدی",
    product_id: 7,
    like_count: 0,
    images: [],
    dislike_count: 0,
    verified_purchase: false,
    status: "pending",
    created_at: "2026-06-11T10:00:00Z",
    updated_at: "2026-06-11T10:00:00Z",
    ...overrides,
  };
}

function mockQueue(results: AdminReview[]) {
  mocks.useAdminReviews.mockReturnValue({
    data: {
      results,
      pagination: {
        page: 1,
        limit: 20,
        total_items: results.length,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: mocks.refetch,
  });
  mocks.useModerateReview.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.searchParams.mockReturnValue(new URLSearchParams());
});

describe("ReviewsQueue failure state", () => {
  it("hides review rows and retries the failed query", () => {
    mocks.useAdminReviews.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    mocks.useModerateReview.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });

    render(<ReviewsQueue canModerate />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "خطا در دریافت دیدگاه‌ها",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewsQueue product label", () => {
  it("shows product title instead of only the product id", () => {
    mockQueue([sampleReview({ product_title: "بطری شیراز" })]);

    render(<ReviewsQueue canModerate />);

    const product = screen.getByRole("link", { name: "بطری شیراز" });
    expect(product).toHaveAttribute("href", "/admin/products/7");
    expect(screen.queryByText("محصول #۷")).not.toBeInTheDocument();
  });

  it("falls back to slug when title is missing", () => {
    mockQueue([sampleReview({ product_slug: "shiraz-bottle" })]);

    render(<ReviewsQueue canModerate />);

    expect(
      screen.getByRole("link", { name: "shiraz-bottle" }),
    ).toHaveAttribute("href", "/admin/products/7");
    expect(screen.queryByText("محصول #۷")).not.toBeInTheDocument();
  });

  it("falls back to the product id when title and slug are missing", () => {
    mockQueue([sampleReview()]);

    render(<ReviewsQueue canModerate />);

    expect(screen.getByRole("link", { name: "محصول #۷" })).toHaveAttribute(
      "href",
      "/admin/products/7",
    );
  });

  it("reads status and page from the URL and writes tab changes back", () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("status=pending&page=2"),
    );
    mockQueue([sampleReview()]);

    render(<ReviewsQueue canModerate />);

    expect(mocks.listQuery).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, status: "pending" }),
    );

    expect(screen.getByRole("tab", { name: "تأییدشده" })).toHaveAttribute(
      "href",
      "/admin/reviews?status=approved",
    );
  });
});
