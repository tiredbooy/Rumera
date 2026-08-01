import { describe, expect, it } from "vitest";

import { ADMIN_NAV, filterNav } from "./nav";
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
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.COUPONS_MANAGE,
      PERMISSIONS.SHIPPING_MANAGE,
      PERMISSIONS.GIFT_CARDS_ISSUE,
      PERMISSIONS.JOURNAL_READ,
    ];

    expect(hrefs(modulePermissions)).toEqual(
      expect.arrayContaining([
        "/admin/tags",
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
      "/admin/payments",
      "/admin/coupons",
      "/admin/shipping",
      "/admin/gift-cards",
      "/admin/journal",
    ]) {
      expect(withoutCapabilities).not.toContain(path);
    }
  });
});
