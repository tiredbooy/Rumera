import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdminHeroSlide, reorderHeroSlides } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hero slide admin API", () => {
  it("loads one admin slide through the detail endpoint", async () => {
    const slide = {
      id: 17,
      title: "اسلاید",
      image_url: null,
      mobile_image_url: null,
      image_alt: null,
      eyebrow: null,
      subtitle: null,
      badge: null,
      cta_label: null,
      cta_href: null,
      secondary_cta_label: null,
      secondary_cta_href: null,
      theme: "dark",
      sort_order: 0,
      is_active: false,
      starts_at: null,
      ends_at: null,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: slide }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAdminHeroSlide(17)).resolves.toEqual(slide);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/hero-slides/17",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("submits one complete reorder permutation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await reorderHeroSlides([9, 4, 12]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/hero-slides/order",
      expect.objectContaining({ method: "PUT", body: '{"ids":[9,4,12]}' }),
    );
  });
});
