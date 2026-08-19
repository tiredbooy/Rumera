// @vitest-environment jsdom

import * as React from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAdminOrdersClient: vi.fn(),
}));

vi.mock("@/features/orders/api/admin-client", () => ({
  listAdminOrdersClient: mocks.listAdminOrdersClient,
  refundAdminOrderClient: vi.fn(),
  updateAdminOrderStatusClient: vi.fn(),
}));

import {
  ADMIN_ORDERS_POLL,
  ADMIN_ORDERS_POLL_MS,
  useAdminOrders,
} from "./hooks";

afterEach(() => {
  cleanup();
});

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe("useAdminOrders", () => {
  it("polls the visible tab every 20 seconds and not in the background", () => {
    expect(ADMIN_ORDERS_POLL_MS).toBe(20_000);

    mocks.listAdminOrdersClient.mockResolvedValue({
      results: [],
      pagination: {
        page: 1,
        limit: 20,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      },
    });

    const { Wrapper } = wrapper();
    renderHook(() => useAdminOrders({ page: 1 }), { wrapper: Wrapper });

    expect(ADMIN_ORDERS_POLL).toEqual({
      refetchInterval: ADMIN_ORDERS_POLL_MS,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    });
  });
});
