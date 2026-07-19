// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tagKeys, useCreateTag, useDeleteTag, useUpdateTag } from "./api";

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

function mockTagResponse(status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      status === 204
        ? new Response(null, { status })
        : new Response(
            JSON.stringify({
              data: {
                id: 7,
                title: "هدیه",
                slug: "gift",
                created_at: "2026-07-19T00:00:00Z",
                updated_at: "2026-07-19T00:00:00Z",
              },
            }),
            { status, headers: { "Content-Type": "application/json" } },
          ),
    ),
  );
}

describe("tag mutation cache handling", () => {
  it("refetches lists and product-form options after create", async () => {
    mockTagResponse(201);
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateTag(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ title: "هدیه", slug: "gift" }),
    );

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.options() });
  });

  it("invalidates detail, lists, and product-form options after update", async () => {
    mockTagResponse();
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUpdateTag(7), { wrapper });

    await act(() => result.current.mutateAsync({ title: "هدیه" }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.detail(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.options() });
  });

  it("removes deleted detail and refetches lists and product-form options", async () => {
    mockTagResponse(204);
    const { invalidate, remove, wrapper } = setup();
    const { result } = renderHook(() => useDeleteTag(), { wrapper });

    await act(() => result.current.mutateAsync(7));

    expect(remove).toHaveBeenCalledWith({ queryKey: tagKeys.detail(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.options() });
  });
});
