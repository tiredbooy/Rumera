import { afterEach, describe, expect, it, vi } from "vitest";

import { createGiftCardsClient, GiftCardApiError } from "./admin-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gift-card admin client", () => {
  it("submits the exact batch request through the admin BFF", async () => {
    const cards = [
      {
        code: "ABCD-EFGH-JKLM-NPQR",
        initial_amount: "125000.5",
        status: "active",
        created_at: "2026-07-29T12:00:00Z",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: cards }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGiftCardsClient({ amount: "125000.50", count: 1 }),
    ).resolves.toEqual(cards);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/admin/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "125000.50", count: 1 }),
    });
  });

  it("preserves backend field errors for accessible form feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "invalid fields",
              fields: { count: ["count must be at most 500"] },
            },
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await createGiftCardsClient({ amount: "10", count: 501 }).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(GiftCardApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      fields: { count: ["count must be at most 500"] },
    });
  });
});
