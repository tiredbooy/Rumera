// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  listQuery: vi.fn(),
  deactivate: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/coupons",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/features/coupons/api", () => ({
  CouponApiError: class CouponApiError extends Error {},
  useAdminCoupons: (query: unknown) => {
    mocks.listQuery(query);
    return mocks.query();
  },
  useDeactivateAdminCoupon: () => ({
    mutateAsync: mocks.deactivate,
    isPending: false,
    error: null,
    variables: undefined,
  }),
}));

import { CouponsBoard } from "./coupons-board";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
});

describe("CouponsBoard", () => {
  it("shows a retryable error without plausible rows", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      data: undefined,
      refetch: mocks.refetch,
    });
    render(<CouponsBoard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "بارگذاری کدهای تخفیف ناموفق بود",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("renders real edit links and disables deactivation for inactive rows", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 9,
            code: "OLD",
            discount_type: "percentage",
            discount_value: 10,
            min_order_amount: 0,
            max_uses_per_user: 1,
            is_active: false,
            starts_at: "2026-01-01T00:00:00Z",
            total_uses: 3,
            max_uses: 10,
            is_exhausted: false,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });
    render(<CouponsBoard />);

    expect(screen.getByRole("link", { name: "OLD" })).toHaveAttribute(
      "href",
      "/admin/coupons/9",
    );
    expect(
      screen.getByRole("button", { name: "غیرفعال کردن OLD" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("columnheader", { name: /مصرف/ }),
    ).toBeInTheDocument();
  });

  it("ignores invalid URL filters before querying the backend", () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("page=2junk&status=expired&type=bogus"),
    );
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [],
        pagination: {
          page: 1,
          limit: 20,
          total_items: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });

    render(<CouponsBoard />);

    expect(mocks.listQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        discount_type: undefined,
      }),
    );
    expect(mocks.listQuery.mock.calls[0]?.[0]).not.toHaveProperty(
      "active_only",
    );
    expect(mocks.listQuery.mock.calls[0]?.[0]).not.toHaveProperty("is_active");
  });

  it("recovers an empty out-of-range page to the last valid page", async () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams("page=99"));
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [],
        pagination: {
          page: 99,
          limit: 20,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_prev: true,
        },
      },
    });

    render(<CouponsBoard />);

    expect(
      screen.getByText("در حال بازگشت به آخرین صفحه…"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/admin/coupons"),
    );
  });
});
