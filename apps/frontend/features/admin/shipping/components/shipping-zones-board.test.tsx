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
  usePathname: () => "/admin/shipping",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/features/shipping/api", () => {
  class ShippingApiError extends Error {}
  return {
    ShippingApiError,
    useAdminShippingZones: (query: unknown) => {
      mocks.listQuery(query);
      return mocks.query();
    },
    useUpdateAdminShippingZone: () => ({
      mutateAsync: mocks.update,
      isPending: false,
      variables: undefined,
    }),
    useDeleteAdminShippingZone: () => ({
      mutateAsync: mocks.remove,
      isPending: false,
      variables: undefined,
    }),
  };
});

import { ShippingZonesBoard } from "./shipping-zones-board";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
  mocks.update.mockResolvedValue({ id: 9, is_active: false });
});

describe("ShippingZonesBoard", () => {
  it("shows a retryable error without fabricated zones", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      data: undefined,
      refetch: mocks.refetch,
    });
    render(<ShippingZonesBoard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "بارگذاری مناطق ارسال ناموفق بود",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("labels cached zones as stale when a refresh fails", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 9,
            name: "Tehran",
            region_codes: ["IR-TEH"],
            is_active: true,
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

    render(<ShippingZonesBoard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد",
    );
    expect(screen.getAllByRole("link", { name: "Tehran" })[0]).toBeVisible();
  });

  it("sanitizes URL filters before querying the backend", () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("page=2junk&status=archived&sort=unknown"),
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

    render(<ShippingZonesBoard />);

    expect(mocks.listQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        sortBy: "created_at",
        orderBy: "desc",
      }),
    );
    expect(mocks.listQuery.mock.calls[0]?.[0]).not.toHaveProperty("is_active");
  });

  it("renders real detail actions and awaits activation changes", async () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 9,
            name: "Tehran",
            region_codes: ["IR-TEH"],
            is_active: true,
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
    render(<ShippingZonesBoard />);

    expect(screen.getAllByRole("link", { name: "Tehran" })[0]).toHaveAttribute(
      "href",
      "/admin/shipping/9",
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "غیرفعال کردن منطقهٔ Tehran",
      })[0],
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        id: 9,
        input: { is_active: false },
      }),
    );
  });
});
