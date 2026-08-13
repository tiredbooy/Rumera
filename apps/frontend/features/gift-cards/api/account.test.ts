import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listMyGiftCards,
  purchaseGiftCard,
  redeemGiftCard,
} from "./account";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gift-card account client (PH-042b)", () => {
  it("posts purchase with Idempotency-Key", async () => {
    const intent = {
      payment_id: 9,
      transaction_id: "gbuy-abc",
      amount: "100000.00",
      currency: "IRT",
      status: "pending",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: intent }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      purchaseGiftCard({ amount: 100_000 }, "idem-purchase-1"),
    ).resolves.toEqual(intent);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/gift-cards/purchase",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-purchase-1",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ amount: 100_000 }),
      }),
    );
  });

  it("lists mine and redeems with Idempotency-Key", async () => {
    const cards = [
      {
        code: "AAAA-BBBB-CCCC-DDDD",
        initial_amount: "50000",
        status: "active",
        purchase_txid: "gbuy-1",
        created_at: "2026-08-12T00:00:00Z",
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: cards }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { amount: "50000" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listMyGiftCards()).resolves.toEqual(cards);
    await expect(
      redeemGiftCard({ code: "AAAA-BBBB-CCCC-DDDD" }, "idem-redeem-1"),
    ).resolves.toEqual({ amount: "50000" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/store/gift-cards/mine");
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/store/gift-cards/redeem",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-redeem-1",
        }),
        body: JSON.stringify({ code: "AAAA-BBBB-CCCC-DDDD" }),
      }),
    ]);
  });
});
