// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  shippingKeys,
  useDeleteAdminShippingZone,
  useUpdateAdminShippingMethod,
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
  const remove = vi.spyOn(queryClient, "removeQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, remove, wrapper };
}

describe("shipping mutation cache handling", () => {
  it("invalidates every query affected by a method update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: 7,
              shipping_zone_id: 3,
              name: "Standard",
              rate_type: "flat_rate",
              base_rate: 10,
              is_active: false,
              estimated_cost: 0,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUpdateAdminShippingMethod(3), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({ id: 7, input: { is_active: false } }),
    );

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: shippingKeys.methodDetail(7),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: shippingKeys.zoneMethods(3),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: shippingKeys.zoneDetail(3),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: shippingKeys.availableRoot(),
    });
  });

  it("removes cascaded zone caches and invalidates lists after deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const { invalidate, remove, wrapper } = setup();
    const { result } = renderHook(() => useDeleteAdminShippingZone(), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(3));

    expect(remove).toHaveBeenCalledWith({
      queryKey: shippingKeys.zoneDetail(3),
      exact: true,
    });
    expect(remove).toHaveBeenCalledWith({
      queryKey: shippingKeys.zoneMethods(3),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: shippingKeys.zoneLists(),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: shippingKeys.methodDetails(),
    });
  });
});
