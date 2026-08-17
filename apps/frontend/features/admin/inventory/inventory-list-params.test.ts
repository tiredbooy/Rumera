import { describe, expect, it } from "vitest";

import {
  ADMIN_INVENTORY_SEARCH_MAX_LENGTH,
  hasAdminInventoryListFilters,
  inventoryPageHref,
  parseAdminInventoryListParams,
} from "./inventory-list-params";

describe("parseAdminInventoryListParams", () => {
  it("defaults to page 1 with no search or low-stock filter", () => {
    expect(parseAdminInventoryListParams({})).toEqual({
      query: "",
      page: 1,
      lowStock: false,
    });
  });

  it("prefers q over search and trims the query", () => {
    expect(
      parseAdminInventoryListParams({ q: "  whisky ", search: "wine" }),
    ).toMatchObject({ query: "whisky" });
    expect(parseAdminInventoryListParams({ search: "  wine  " })).toMatchObject({
      query: "wine",
    });
  });

  it("caps the query length", () => {
    const long = "a".repeat(ADMIN_INVENTORY_SEARCH_MAX_LENGTH + 20);
    expect(parseAdminInventoryListParams({ q: long }).query).toHaveLength(
      ADMIN_INVENTORY_SEARCH_MAX_LENGTH,
    );
  });

  it("falls back to page 1 for invalid pages", () => {
    expect(parseAdminInventoryListParams({ page: "0" }).page).toBe(1);
    expect(parseAdminInventoryListParams({ page: "foo" }).page).toBe(1);
    expect(parseAdminInventoryListParams({ page: ["3"] }).page).toBe(3);
  });

  it("treats only true/1 as the low_stock filter", () => {
    expect(parseAdminInventoryListParams({ low_stock: "true" }).lowStock).toBe(
      true,
    );
    expect(parseAdminInventoryListParams({ low_stock: "1" }).lowStock).toBe(
      true,
    );
    expect(parseAdminInventoryListParams({ low_stock: "false" }).lowStock).toBe(
      false,
    );
    expect(parseAdminInventoryListParams({ low_stock: "all" }).lowStock).toBe(
      false,
    );
  });
});

describe("inventoryPageHref", () => {
  it("omits page 1 and unset filters", () => {
    expect(
      inventoryPageHref({ query: "", page: 1, lowStock: false }, 1),
    ).toBe("/admin/inventory");
  });

  it("preserves search and low_stock across pages", () => {
    const filters = { query: "wine", page: 2, lowStock: true };

    expect(inventoryPageHref(filters, 1)).toBe(
      "/admin/inventory?q=wine&low_stock=true",
    );
    expect(inventoryPageHref(filters, 3)).toBe(
      "/admin/inventory?q=wine&low_stock=true&page=3",
    );
  });
});

describe("hasAdminInventoryListFilters", () => {
  it("treats query and low_stock as filters, not the page number", () => {
    expect(
      hasAdminInventoryListFilters({ query: "", page: 2, lowStock: false }),
    ).toBe(false);
    expect(
      hasAdminInventoryListFilters({ query: "x", page: 1, lowStock: false }),
    ).toBe(true);
    expect(
      hasAdminInventoryListFilters({ query: "", page: 1, lowStock: true }),
    ).toBe(true);
  });
});
