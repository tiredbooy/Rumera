import { describe, expect, it } from "vitest";

import { ADMIN_NAV, ACCOUNT_NAV, filterNav } from "./nav";
import { PERMISSIONS } from "./permissions";

function hrefs(permissions: (typeof PERMISSIONS)[keyof typeof PERMISSIONS][]) {
  return filterNav(ADMIN_NAV, { permissions }).flatMap((group) =>
    group.items.map((item) => item.href),
  );
}

describe("admin module navigation", () => {
  it("exposes every completed module only with its capability", () => {
    const modulePermissions = [
      PERMISSIONS.TAGS_MANAGE,
      PERMISSIONS.PRODUCTS_WRITE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.COUPONS_MANAGE,
      PERMISSIONS.SHIPPING_MANAGE,
      PERMISSIONS.GIFT_CARDS_ISSUE,
      PERMISSIONS.JOURNAL_READ,
    ];

    expect(hrefs(modulePermissions)).toEqual(
      expect.arrayContaining([
        "/admin/tags",
        "/admin/options",
        "/admin/payments",
        "/admin/coupons",
        "/admin/shipping",
        "/admin/gift-cards",
        "/admin/journal",
      ]),
    );

    const withoutCapabilities = hrefs([]);
    for (const path of [
      "/admin/tags",
      "/admin/options",
      "/admin/payments",
      "/admin/coupons",
      "/admin/shipping",
      "/admin/gift-cards",
      "/admin/journal",
    ]) {
      expect(withoutCapabilities).not.toContain(path);
    }
  });

  it("organizes admin links into job-based groups", () => {
    const titles = ADMIN_NAV.map((group) => group.title).filter(Boolean);
    expect(titles).toEqual([
      "کاتالوگ",
      "موجودی و سفارش",
      "مشتریان",
      "فروش و لجستیک",
      "محتوا",
      "بینش و پایش",
      "سیستم",
    ]);
    const insights = ADMIN_NAV.find((g) => g.title === "بینش و پایش");
    expect(insights?.items.map((i) => i.href)).toEqual(
      expect.arrayContaining([
        "/admin/analytics",
        "/admin/recommendations",
        "/admin/monitoring",
      ]),
    );

    const catalogue = ADMIN_NAV.find((g) => g.title === "کاتالوگ");
    expect(catalogue?.items.map((i) => i.href)).toEqual([
      "/admin/products",
      "/admin/categories",
      "/admin/brands",
      "/admin/tags",
      "/admin/options",
    ]);

    // Drop empty groups when the operator lacks inventory + orders.
    const onlyTags = filterNav(ADMIN_NAV, {
      permissions: [PERMISSIONS.TAGS_MANAGE],
    });
    expect(onlyTags.some((g) => g.title === "موجودی و سفارش")).toBe(false);
    expect(onlyTags.some((g) => g.title === "کاتالوگ")).toBe(true);
  });

  it("groups account links without permission gates", () => {
    const titles = ACCOUNT_NAV.map((g) => g.title);
    expect(titles).toEqual(["نمای کلی", "حساب و آدرس", "تجربه و وفاداری"]);
    const filtered = filterNav(ACCOUNT_NAV, { permissions: [] });
    expect(filtered).toHaveLength(3);
  });
});

