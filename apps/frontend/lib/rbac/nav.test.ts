import { describe, expect, it } from "vitest";

import { Package } from "lucide-react";

import {
  ADMIN_NAV,
  ACCOUNT_NAV,
  applyNavBadges,
  filterNav,
  groupBadgeTotal,
  isAccordionGroup,
} from "./nav";
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
      "امروز",
      "کار روزانه",
      "کاتالوگ",
      "مشتریان",
      "بازاریابی و محتوا",
      "پیکربندی",
    ]);
    const daily = ADMIN_NAV.find((g) => g.title === "کار روزانه");
    expect(daily?.items.map((i) => i.href)).toEqual([
      "/admin/orders",
      "/admin/payments",
      "/admin/reviews",
      "/admin/inventory",
    ]);

    const setup = ADMIN_NAV.find((g) => g.title === "پیکربندی");
    expect(setup && isAccordionGroup(setup)).toBe(true);
    expect(setup?.defaultCollapsed).toBe(true);
    expect(setup?.items.map((i) => i.href)).toEqual(
      expect.arrayContaining([
        "/admin/shipping",
        "/admin/analytics",
        "/admin/recommendations",
        "/admin/monitoring",
        "/admin/roles",
        "/admin/settings",
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

    // Drop empty groups when the operator lacks daily-work + catalogue write.
    const onlyTags = filterNav(ADMIN_NAV, {
      permissions: [PERMISSIONS.TAGS_MANAGE],
    });
    expect(onlyTags.some((g) => g.title === "کار روزانه")).toBe(false);
    expect(onlyTags.some((g) => g.title === "کاتالوگ")).toBe(true);
  });

  it("applies pending counts onto matching items and skips zero or failed", () => {
    const [daily] = applyNavBadges(
      [
        {
          title: "کار روزانه",
          items: [
            { label: "سفارش‌ها", href: "/admin/orders", icon: Package },
            { label: "دیدگاه‌ها", href: "/admin/reviews", icon: Package },
            { label: "موجودی", href: "/admin/inventory", icon: Package },
          ],
        },
      ],
      {
        "/admin/orders": 4,
        "/admin/reviews": 0,
        "/admin/inventory": null,
      },
    );
    expect(daily.items[0].badge).toBe(4);
    expect(daily.items[1].badge).toBeUndefined();
    expect(daily.items[2].badge).toBeUndefined();
    expect(groupBadgeTotal(daily)).toBe(4);
  });

  it("treats a one-item group as a link and multi-item groups as accordions", () => {
    const today = ADMIN_NAV.find((g) => g.id === "today");
    const daily = ADMIN_NAV.find((g) => g.id === "daily");
    expect(today && isAccordionGroup(today)).toBe(false);
    expect(daily && isAccordionGroup(daily)).toBe(true);
  });

  it("groups account links without permission gates", () => {
    const titles = ACCOUNT_NAV.map((g) => g.title);
    expect(titles).toEqual(["نمای کلی", "حساب و آدرس", "تجربه و وفاداری"]);
    const filtered = filterNav(ACCOUNT_NAV, { permissions: [] });
    expect(filtered).toHaveLength(3);
  });
});

