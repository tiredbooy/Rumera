import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getLiveAccount } from "./live-account";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getLiveAccount", () => {
  it("returns the live backend role instead of trusting a session snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              user_id: "4b7bd014-6850-44f8-83bb-66bf1766d194",
              email: "admin@example.com",
              role: "admin",
              created_at: "2026-07-28T10:00:00Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(getLiveAccount("access-token")).resolves.toMatchObject({
      status: "active",
      profile: { role: "admin" },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/me"),
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
        cache: "no-store",
      }),
    );
  });

  it.each([401, 403])("treats status %s as revoked", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status })),
    );
    await expect(getLiveAccount("access-token")).resolves.toEqual({
      status: "revoked",
    });
  });

  it("fails closed when the response is unavailable or malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { role: "support" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(getLiveAccount("access-token")).resolves.toEqual({
      status: "unavailable",
    });
  });
});
