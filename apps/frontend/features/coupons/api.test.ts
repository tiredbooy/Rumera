import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deactivateAdminCoupon,
  listAdminCoupons,
  updateAdminCoupon,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coupon admin API", () => {
  it("preserves false filters and reads top-level pagination", async () => {
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
      listAdminCoupons({
        page: 2,
        limit: 20,
        search: "SUM MER",
        is_active: false,
      }),
    ).resolves.toEqual(payload);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/admin/admin/coupons?");
    expect(url).toContain("search=SUM+MER");
    expect(url).toContain("is_active=false");
  });

  it("deactivates through PATCH and preserves explicit null fields", async () => {
    const coupon = {
      id: 7,
      code: "SAVE",
      discount_type: "percentage",
      discount_value: 10,
      min_order_amount: 0,
      max_uses_per_user: 1,
      is_active: false,
      starts_at: "2026-07-18T00:00:00Z",
      total_uses: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: coupon }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await deactivateAdminCoupon(7);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/admin/coupons/7",
      expect.objectContaining({ method: "PATCH", body: '{"is_active":false}' }),
    );

    await updateAdminCoupon(7, {
      max_uses: null,
      max_discount_amount: null,
      applicable_to: null,
      expires_at: null,
    });
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      max_uses: null,
      max_discount_amount: null,
      applicable_to: null,
      expires_at: null,
    });
  });
});
