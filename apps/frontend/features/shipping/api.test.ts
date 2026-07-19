import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteAdminShippingMethod,
  getAvailableShippingMethods,
  listShippingZones,
  updateAdminShippingMethod,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shipping API", () => {
  it("uses the public paginated contract and preserves false filters", async () => {
    const payload = {
      results: [],
      pagination: {
        page: 2,
        limit: 20,
        total_items: 21,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listShippingZones({
        page: 2,
        limit: 20,
        search: "North Area",
        is_active: false,
      }),
    ).resolves.toEqual(payload);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/store/shipping/zones?");
    expect(url).toContain("search=North+Area");
    expect(url).toContain("is_active=false");
  });

  it("submits subtotal for calculated quotes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAvailableShippingMethods({
      region: "IR-TEH",
      weight: 2.5,
      subtotal: 100,
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("region=IR-TEH");
    expect(url).toContain("weight=2.5");
    expect(url).toContain("subtotal=100");
  });

  it("preserves explicit null method rules and handles 204 deletion", async () => {
    const method = {
      id: 7,
      shipping_zone_id: 3,
      name: "Standard",
      rate_type: "flat_rate",
      base_rate: 10,
      is_active: true,
      estimated_cost: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: method }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateAdminShippingMethod(7, {
      carrier: null,
      free_above_amount: null,
      max_weight_kg: null,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/admin/shipping/methods/7",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          carrier: null,
          free_above_amount: null,
          max_weight_kg: null,
        }),
      }),
    );

    await expect(deleteAdminShippingMethod(7)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/admin/shipping/methods/7",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
