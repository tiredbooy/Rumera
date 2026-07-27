import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listActiveHeroSlides } from "./server";

describe("public hero slide API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps an intentional empty response empty and bypasses stale caches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listActiveHeroSlides()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/hero-slides"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("uses editorial fallback slides only when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const slides = await listActiveHeroSlides();
    expect(slides.length).toBeGreaterThan(0);
    expect(slides[0]?.id).toBeLessThan(0);
  });
});
