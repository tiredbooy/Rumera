import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  getInventory: vi.fn(),
  listMovements: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  view: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/features/admin/inventory/components/inventory-variant-view", () => ({
  InventoryVariantView: mocks.view,
}));
vi.mock("@/features/inventory/api", () => ({
  getVariantInventory: mocks.getInventory,
  listInventoryMovements: mocks.listMovements,
}));
vi.mock("@/lib/api/error-semantics", () => ({
  isApiNotFoundError: () => false,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminInventoryVariantPage from "./page";

const inventory = {
  id: 4,
  product_variant_id: 14,
  product_id: 3,
  product_title: "محصول آزمایشی",
  unit_price: "125000",
  stock_on_hand: 10,
  committed_stock: 2,
  available_stock: 8,
  reorder_point: 4,
  reorder_quantity: 20,
  updated_at: "2026-08-01T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInventory.mockResolvedValue(inventory);
});

describe("admin inventory variant route", () => {
  it("normalizes an out-of-range page even when the ledger is empty", async () => {
    mocks.listMovements.mockResolvedValue({
      results: [],
      pagination: {
        page: 2,
        limit: 12,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: true,
      },
    });

    await expect(
      AdminInventoryVariantPage({
        params: Promise.resolve({ variantID: "14" }),
        searchParams: Promise.resolve({ movement_page: "2" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/inventory/14");
    expect(mocks.view).not.toHaveBeenCalled();
  });

  it("loads a bounded movement page and forwards write capability", async () => {
    const movements = {
      results: [],
      pagination: {
        page: 1,
        limit: 12,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    };
    mocks.listMovements.mockResolvedValue(movements);

    const element = await AdminInventoryVariantPage({
      params: Promise.resolve({ variantID: "14" }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.listMovements).toHaveBeenCalledWith({
      product_variant_id: 14,
      page: 1,
      limit: 12,
      sortBy: "created_at",
      orderBy: "desc",
    });
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual(
      expect.objectContaining({
        inventory,
        movements: [],
        movementPagination: movements.pagination,
        canWrite: true,
      }),
    );
  });
});
