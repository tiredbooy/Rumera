import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  getRecommendationOpsStats: vi.fn(),
  getTrending: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/features/recommendations/admin-api", () => ({
  getRecommendationOpsStats: mocks.getRecommendationOpsStats,
  getTrending: mocks.getTrending,
}));

import AdminRecommendationsPage from "./page";

const stats = {
  window_days: 30,
  interaction_total: 12,
  unique_users: 4,
  profiles_total: 3,
  interactions_by_type: { view: 12 },
  generated_at: "2026-08-16T00:00:00Z",
};

const trendingItem = {
  product_id: 7,
  title: "شراب تست",
  min_price: 250000,
  max_price: 250000,
  score: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ role: "admin" });
  mocks.getRecommendationOpsStats.mockResolvedValue(stats);
  mocks.getTrending.mockResolvedValue([trendingItem]);
});

describe("admin recommendations page", () => {
  it("requires analytics:read", async () => {
    await AdminRecommendationsPage();
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.ANALYTICS_READ,
    );
    expect(mocks.getTrending).toHaveBeenCalledWith({ limit: 5 });
  });

  it("renders live trending products", async () => {
    const html = renderToStaticMarkup(await AdminRecommendationsPage());

    expect(html).toContain("شراب تست");
    expect(html).not.toContain("trending خالی است");
    expect(html).not.toContain("بارگذاری Trending ناموفق بود");
  });

  it("shows empty catalog copy when trending is a successful empty list", async () => {
    mocks.getTrending.mockResolvedValue([]);

    const html = renderToStaticMarkup(await AdminRecommendationsPage());

    expect(html).toContain("trending خالی است (کاتالوگ سرد).");
    expect(html).not.toContain("بارگذاری Trending ناموفق بود");
    expect(html).not.toContain("API در دسترس نیست");
    expect(html).not.toContain('role="alert"');
  });

  it("shows error UI when trending fetch fails — not the empty catalog copy", async () => {
    mocks.getTrending.mockRejectedValue(new Error("offline"));

    const html = renderToStaticMarkup(await AdminRecommendationsPage());

    expect(html).toContain('role="alert"');
    expect(html).toContain("بارگذاری Trending ناموفق بود");
    expect(html).toContain("نمونهٔ محصولات ترند از سرور دریافت نشد.");
    expect(html).toContain("تلاش دوباره");
    expect(html).not.toContain("trending خالی است");
    expect(html).not.toContain("شراب تست");
  });

  it("still renders stats when only trending fails", async () => {
    mocks.getTrending.mockRejectedValue(new Error("offline"));

    const html = renderToStaticMarkup(await AdminRecommendationsPage());

    expect(html).toContain("تعامل‌ها");
    expect(html).toContain("بارگذاری Trending ناموفق بود");
    expect(html).not.toContain("trending خالی است");
  });

  it.each([401, 403] as const)(
    "rethrows %s so auth/forbidden stay outside the retry card",
    async (status) => {
      const error = new ApiError(status, "FORBIDDEN", "no access");
      mocks.getTrending.mockRejectedValue(error);

      await expect(AdminRecommendationsPage()).rejects.toBe(error);
    },
  );
});
