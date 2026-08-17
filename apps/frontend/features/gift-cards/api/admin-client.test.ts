import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGiftCardsClient,
  GiftCardApiError,
  listAdminGiftCardsClient,
  voidAdminGiftCardClient,
} from "./admin-client";

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

  it("reads the top-level {results, pagination} ledger envelope", async () => {
    const payload = {
      results: [
        {
          id: 12,
          code: "ABCD-EFGH-JKLM-NPQR",
          initial_amount: "500000",
          status: "active",
          created_at: "2026-08-16T10:00:00Z",
        },
      ],
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
      listAdminGiftCardsClient({
        page: 2,
        limit: 20,
        status: "active",
        search: "ABCD",
        sortBy: "created_at",
        orderBy: "desc",
      }),
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/gift-cards?page=2&limit=20&status=active&search=ABCD&sortBy=created_at&orderBy=desc",
    );
  });

  it("voids by numeric id and surfaces INVALID_STATE without inventing success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_STATE",
            message: "gift card is not active",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await voidAdminGiftCardClient(12).catch(
      (reason: unknown) => reason,
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/admin/gift-cards/12/void", {
      method: "POST",
    });
    expect(error).toBeInstanceOf(GiftCardApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "INVALID_STATE",
      message: "gift card is not active",
    });
  });

  it("returns the voided row from the {data} envelope", async () => {
    const card = {
      id: 12,
      code: "ABCD-EFGH-JKLM-NPQR",
      initial_amount: "500000",
      status: "disabled",
      created_at: "2026-08-16T10:00:00Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: card }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(voidAdminGiftCardClient(12)).resolves.toEqual(card);
  });
});
