// @vitest-environment jsdom

import * as React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/lib/api/types";
import type { OrderListItem, OrderStatus } from "./types";

const mocks = vi.hoisted(() => ({
  listAccountOrdersClient: vi.fn(),
}));

vi.mock("./api/account-client", () => ({
  listAccountOrdersClient: mocks.listAccountOrdersClient,
  createAccountOrderClient: vi.fn(),
  getAccountOrderClient: vi.fn(),
  cancelAccountOrderClient: vi.fn(),
  payAccountOrderClient: vi.fn(),
}));

import {
  ACCOUNT_ORDER_TAB_STATUSES,
  mergeOrderListPages,
  useOrders,
  useOrdersTab,
} from "./hooks";

function order(
  id: number,
  status: OrderStatus,
  created_at: string,
): OrderListItem {
  return {
    id,
    status,
    payment_method: "wallet",
    total_amount: 50_000,
    item_count: 1,
    created_at,
  };
}

function pageOf(
  results: OrderListItem[],
  pagination: Partial<Paginated<OrderListItem>["pagination"]> = {},
): Paginated<OrderListItem> {
  return {
    results,
    pagination: {
      page: 1,
      limit: 20,
      total_items: results.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
      ...pagination,
    },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mocks.listAccountOrdersClient.mockReset();
});

describe("useOrders", () => {
  it("forwards a single status to GET /orders", async () => {
    mocks.listAccountOrdersClient.mockResolvedValue(pageOf([]));

    const { result } = renderHook(
      () => useOrders({ page: 2, status: "delivered" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.listAccountOrdersClient).toHaveBeenCalledWith({
      page: 2,
      status: "delivered",
    });
  });
});

describe("useOrdersTab", () => {
  it("omits status on the all tab", async () => {
    mocks.listAccountOrdersClient.mockResolvedValue(pageOf([]));

    const { result } = renderHook(
      () => useOrdersTab({ page: 1, statuses: ACCOUNT_ORDER_TAB_STATUSES.all }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mocks.listAccountOrdersClient).toHaveBeenCalledTimes(1);
    expect(mocks.listAccountOrdersClient).toHaveBeenCalledWith({ page: 1 });
  });

  it("fetches one server page per mapped status and merges them", async () => {
    mocks.listAccountOrdersClient.mockImplementation(
      async (query: { page?: number; status?: OrderStatus }) => {
        if (query.status === "shipped") {
          return pageOf(
            [order(2, "shipped", "2026-08-01T00:00:00Z")],
            { page: 2, total_items: 3, total_pages: 2, has_next: false },
          );
        }
        if (query.status === "out_for_delivery") {
          return pageOf(
            [order(9, "out_for_delivery", "2026-08-10T00:00:00Z")],
            { page: 2, total_items: 21, total_pages: 2, has_next: true },
          );
        }
        return pageOf([]);
      },
    );

    const { result } = renderHook(
      () =>
        useOrdersTab({
          page: 2,
          statuses: ACCOUNT_ORDER_TAB_STATUSES.shipped,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mocks.listAccountOrdersClient).toHaveBeenCalledWith({
      page: 2,
      status: "shipped",
    });
    expect(mocks.listAccountOrdersClient).toHaveBeenCalledWith({
      page: 2,
      status: "out_for_delivery",
    });
    expect(result.current.data?.results.map((item) => item.id)).toEqual([9, 2]);
    expect(result.current.data?.pagination).toMatchObject({
      page: 2,
      total_items: 24,
      total_pages: 2,
      has_next: true,
    });
    expect(result.current.isError).toBe(false);
  });

  it("treats a failed status request as error, not an empty tab", async () => {
    mocks.listAccountOrdersClient.mockRejectedValue(new Error("unavailable"));

    const { result } = renderHook(
      () =>
        useOrdersTab({
          page: 1,
          statuses: ACCOUNT_ORDER_TAB_STATUSES.delivered,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("returns an empty page when every status request succeeds with no rows", async () => {
    mocks.listAccountOrdersClient.mockResolvedValue(pageOf([]));

    const { result } = renderHook(
      () =>
        useOrdersTab({
          page: 1,
          statuses: ACCOUNT_ORDER_TAB_STATUSES.cancelled,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(result.current.data?.results).toEqual([]);
    expect(mocks.listAccountOrdersClient).toHaveBeenCalledTimes(
      ACCOUNT_ORDER_TAB_STATUSES.cancelled.length,
    );
  });
});

describe("mergeOrderListPages", () => {
  it("sums server-page totals instead of filtering one unfiltered page", () => {
    const merged = mergeOrderListPages([
      pageOf([order(1, "pending", "2026-08-02T00:00:00Z")], {
        page: 2,
        total_items: 21,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      }),
      pageOf([order(3, "paid", "2026-08-03T00:00:00Z")], {
        page: 2,
        total_items: 2,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      }),
    ]);

    expect(merged.results.map((item) => item.id)).toEqual([3, 1]);
    expect(merged.pagination).toMatchObject({
      page: 2,
      total_items: 23,
      total_pages: 2,
      has_prev: true,
      has_next: false,
    });
  });
});
