import { afterEach, describe, expect, it, vi } from "vitest";

import { Package, Users } from "lucide-react";

import {
  COMMAND_SEARCH_LIMIT,
  COMMAND_ACTIONS,
  couponHref,
  customerHref,
  customersSearchHref,
  flattenNavItems,
  inventoryHref,
  journalHref,
  matchCommandActions,
  matchNavItems,
  normalizeCommandQuery,
  orderHref,
  parseCustomerPhoneQuery,
  parseOrderIdQuery,
  productHref,
  productsSearchHref,
  recipeHref,
  searchAdminCustomers,
  searchAdminInventory,
  searchAdminProducts,
} from "./admin-command-search";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { NavGroup } from "@/lib/rbac/nav";

afterEach(() => {
  vi.unstubAllGlobals();
});

const groups: NavGroup[] = [
  {
    title: "کاتالوگ",
    items: [
      { label: "محصولات", href: "/admin/products", icon: Package },
      { label: "کاربران", href: "/admin/customers", icon: Users },
    ],
  },
];

describe("admin command search helpers", () => {
  it("normalizes whitespace and matches nav by Persian label or href", () => {
    expect(normalizeCommandQuery("  ویسکی   تک  ")).toBe("ویسکی تک");
    const items = flattenNavItems(groups);
    expect(matchNavItems(items, "").map((item) => item.href)).toEqual([
      "/admin/products",
      "/admin/customers",
    ]);
    expect(matchNavItems(items, "کاربر").map((item) => item.href)).toEqual([
      "/admin/customers",
    ]);
    expect(matchNavItems(items, "products").map((item) => item.href)).toEqual([
      "/admin/products",
    ]);
  });

  it("only treats a short positive integer as an order jump", () => {
    expect(parseOrderIdQuery("42")).toBe(42);
    expect(parseOrderIdQuery("۱۴۲")).toBe(142);
    expect(parseOrderIdQuery("  7  ")).toBe(7);
    expect(parseOrderIdQuery("0")).toBeNull();
    expect(parseOrderIdQuery("12a")).toBeNull();
    expect(parseOrderIdQuery("سفارش 12")).toBeNull();
    expect(parseOrderIdQuery("09121234567")).toBeNull();
    expect(parseOrderIdQuery("۹۱۲۱۲۳۴۵۶۷")).toBeNull();
  });

  it("classifies Iranian mobiles as customer-phone queries", () => {
    expect(parseCustomerPhoneQuery("09121234567")).toBe("09121234567");
    expect(parseCustomerPhoneQuery("۹۱۲۱۲۳۴۵۶۷")).toBe("9121234567");
    expect(parseCustomerPhoneQuery("۱۴۲")).toBeNull();
    expect(parseCustomerPhoneQuery("42")).toBeNull();
  });

  it("builds board and detail hrefs without inventing order search", () => {
    expect(productsSearchHref("wine")).toBe("/admin/products?q=wine");
    expect(customersSearchHref("مینا")).toBe(
      `/admin/customers?q=${encodeURIComponent("مینا")}`,
    );
    expect(productHref(9)).toBe("/admin/products/9");
    expect(customerHref("user/1")).toBe("/admin/customers/user%2F1");
    expect(orderHref(18)).toBe("/admin/orders/18");
    expect(inventoryHref(44)).toBe("/admin/inventory/44");
    expect(couponHref(8)).toBe("/admin/coupons/8");
    expect(journalHref(3)).toBe("/admin/journal/3");
    expect(recipeHref(11)).toBe("/admin/recipes/11");
    expect(productsSearchHref("  ")).toBe("/admin/products");
  });

  it("filters command actions by permission and query", () => {
    const writeOnly = new Set([PERMISSIONS.PRODUCTS_WRITE]);
    expect(
      matchCommandActions(COMMAND_ACTIONS, "", writeOnly).map((item) => item.id),
    ).toEqual(["new-product"]);
    expect(
      matchCommandActions(COMMAND_ACTIONS, "تخفیف", new Set([PERMISSIONS.COUPONS_MANAGE])).map(
        (item) => item.id,
      ),
    ).toEqual(["new-coupon"]);
    expect(
      matchCommandActions(COMMAND_ACTIONS, "محصول", new Set([PERMISSIONS.COUPONS_MANAGE])),
    ).toEqual([]);
    expect(
      matchCommandActions(
        COMMAND_ACTIONS,
        "هدیه",
        new Set([PERMISSIONS.GIFT_CARDS_ISSUE]),
      ),
    ).toEqual([
      expect.objectContaining({
        id: "issue-gift-card",
        href: "/admin/gift-cards/new",
      }),
    ]);
  });
});

describe("admin command search APIs", () => {
  it("queries admin product and user list search, not a fake index", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/admin/products")) {
        return Promise.resolve({
          ok: true,
          statusText: "OK",
          json: () =>
            Promise.resolve({
              results: [{ id: 3, title: "Malt" }],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: () =>
          Promise.resolve({
            data: {
              results: [{ user_id: "u1", full_name: "مینا", email: "m@x.com" }],
            },
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchAdminProducts("malt")).resolves.toEqual([
      { id: 3, title: "Malt" },
    ]);
    await expect(searchAdminCustomers("مینا")).resolves.toEqual([
      { user_id: "u1", full_name: "مینا", email: "m@x.com" },
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/admin/products?search=malt&limit=${COMMAND_SEARCH_LIMIT}`,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/admin/users?search=${encodeURIComponent("مینا")}&limit=${COMMAND_SEARCH_LIMIT}`,
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          results: [{ product_variant_id: 9, product_title: "Malt", sku: "SKU-9" }],
        }),
    });
    await expect(searchAdminInventory("SKU-9")).resolves.toEqual([
      { product_variant_id: 9, product_title: "Malt", sku: "SKU-9" },
    ]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/admin/admin/inventory?search=SKU-9&limit=${COMMAND_SEARCH_LIMIT}`,
    );
  });

  it("surfaces a failed list search instead of an empty catalogue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: () =>
          Promise.resolve({
            error: { code: "UPSTREAM_UNAVAILABLE", message: "down" },
          }),
      }),
    );

    await expect(searchAdminProducts("x")).rejects.toMatchObject({
      name: "CommandSearchError",
      status: 502,
      message: "down",
    });
  });
});
