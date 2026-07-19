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
  update: vi.fn(),
  remove: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/shipping/3",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/features/shipping/api", () => {
  class ShippingApiError extends Error {}
  return {
    ShippingApiError,
    useAdminShippingMethods: (_zoneID: number, query: unknown) => {
      mocks.listQuery(query);
      return mocks.query();
    },
    useUpdateAdminShippingMethod: () => ({
      mutateAsync: mocks.update,
      isPending: false,
      variables: undefined,
    }),
    useDeleteAdminShippingMethod: () => ({
      mutateAsync: mocks.remove,
      isPending: false,
      variables: undefined,
    }),
  };
});

import { ShippingMethodsPanel } from "./shipping-methods-panel";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
  mocks.update.mockResolvedValue({ id: 8, is_active: false });
});

describe("ShippingMethodsPanel", () => {
  it("renders backend rules and performs a real activation update", async () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 8,
            name: "Weight",
            carrier: "Post",
            rate_type: "per_kg",
            base_rate: 2.5,
            free_above_amount: 100,
            min_delivery_days: 2,
            max_delivery_days: 5,
            max_weight_kg: 10,
            is_active: true,
            estimated_cost: 0,
          },
        ],
        pagination: {
          page: 1,
          limit: 12,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });
    render(<ShippingMethodsPanel zoneID={3} />);

    expect(screen.getAllByRole("link", { name: "Weight" })[0]).toHaveAttribute(
      "href",
      "/admin/shipping/3/methods/8",
    );
    expect(screen.getAllByText(/کیلوگرم/).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "غیرفعال کردن روش Weight",
      })[0],
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        id: 8,
        input: { is_active: false },
      }),
    );
  });

  it("keeps an invalid rate filter out of the backend query", () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("methods_page=bad&rate_type=mystery"),
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
          limit: 12,
          total_items: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });

    render(<ShippingMethodsPanel zoneID={3} />);
    expect(mocks.listQuery).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, rate_type: undefined }),
    );
  });

  it("labels cached methods as stale when a refresh fails", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 8,
            name: "Weight",
            carrier: null,
            rate_type: "per_kg",
            base_rate: 2.5,
            free_above_amount: null,
            min_delivery_days: null,
            max_delivery_days: null,
            max_weight_kg: null,
            is_active: true,
          },
        ],
        pagination: {
          page: 1,
          limit: 12,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });

    render(<ShippingMethodsPanel zoneID={3} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد",
    );
    expect(screen.getAllByRole("link", { name: "Weight" })[0]).toBeVisible();
  });
});
