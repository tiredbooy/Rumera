// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  couponKeys,
  useDeactivateAdminCoupon,
  useUpdateAdminCoupon,
} from "./api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, wrapper };
}

function mockCouponResponse() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 7,
            code: "SAVE",
            discount_type: "percentage",
            discount_value: 10,
            min_order_amount: 0,
            max_uses_per_user: 1,
            is_active: false,
            starts_at: "2026-07-18T00:00:00Z",
            total_uses: 0,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

describe("coupon admin mutation cache handling", () => {
  it("invalidates update detail and list caches instead of storing stale usage", async () => {
    mockCouponResponse();
    const { queryClient, invalidate, wrapper } = setup();
    queryClient.setQueryData(couponKeys.detail(7), { total_uses: 12 });
    const { result } = renderHook(() => useUpdateAdminCoupon(7), { wrapper });

    await act(() => result.current.mutateAsync({ is_active: false }));

    expect(queryClient.getQueryData(couponKeys.detail(7))).toEqual({
      total_uses: 12,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: couponKeys.detail(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: couponKeys.lists() });
  });

  it("invalidates deactivated coupon detail and list caches", async () => {
    mockCouponResponse();
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDeactivateAdminCoupon(), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(7));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: couponKeys.detail(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: couponKeys.lists() });
  });
});
