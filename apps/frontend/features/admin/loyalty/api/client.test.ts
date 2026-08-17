import { afterEach, describe, expect, it, vi } from "vitest";

import { adjustLoyaltyPoints, LoyaltyApiError } from "./client";

const userID = "8b5948a0-d150-4c78-86cd-d16e63da940d";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adjustLoyaltyPoints", () => {
  it("POSTs delta, note, and Idempotency-Key through the admin BFF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { user_id: userID, delta: 50, replayed: false },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await adjustLoyaltyPoints(userID, {
      delta: 50,
      note: "goodwill",
      idempotencyKey: "key-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/admin/users/${userID}/loyalty/adjust`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "key-1",
        }),
      }),
    );
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    ) as { delta: number; note: string; idempotency_key: string };
    expect(body).toEqual({
      delta: 50,
      note: "goodwill",
      idempotency_key: "key-1",
    });
  });

  it("throws LoyaltyApiError with the server code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({
          error: { code: "INSUFFICIENT_POINTS", message: "not enough" },
        }),
      }),
    );

    await expect(
      adjustLoyaltyPoints(userID, { delta: -10, idempotencyKey: "k" }),
    ).rejects.toMatchObject({
      name: "LoyaltyApiError",
      status: 409,
      code: "INSUFFICIENT_POINTS",
    });
    await expect(
      adjustLoyaltyPoints(userID, { delta: -10, idempotencyKey: "k" }),
    ).rejects.toBeInstanceOf(LoyaltyApiError);
  });
});
