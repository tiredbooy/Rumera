import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));

import {
  adjustVariantStock,
  getVariantInventory,
  listAllInventory,
  listInventoryMovements,
  updateVariantReorderThreshold,
} from "./api";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiFetch.mockResolvedValue(undefined);
});

describe("inventory API", () => {
  it("uses the dedicated variant and bounded movement contracts", async () => {
    await getVariantInventory(14);
    await listInventoryMovements({
      product_variant_id: 14,
      page: 2,
      limit: 12,
      sortBy: "created_at",
      orderBy: "desc",
    });

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/admin/inventory/variants/14",
    );
    const movementPath = String(mocks.apiFetch.mock.calls[1]?.[0]);
    expect(movementPath).toContain("/admin/inventory/movements?");
    expect(movementPath).toContain("product_variant_id=14");
    expect(movementPath).toContain("page=2");
    expect(movementPath).toContain("limit=12");
    expect(movementPath).toContain("sortBy=created_at");
    expect(movementPath).toContain("orderBy=desc");
  });

  it("walks inventory pages with immutable ID ordering", async () => {
    mocks.apiFetch.mockResolvedValue({
      results: [],
      pagination: {
        page: 1,
        limit: 100,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    await listAllInventory();

    const path = String(mocks.apiFetch.mock.calls[0]?.[0]);
    expect(path).toContain("sortBy=id");
    expect(path).toContain("orderBy=asc");
  });

  it("sends exact stock adjustment and threshold payloads", async () => {
    await adjustVariantStock(14, {
      quantity: -3,
      type: "adjustment",
      note: "cycle count",
    });
    await updateVariantReorderThreshold(14, {
      reorder_point: 7,
      reorder_quantity: 30,
    });

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/admin/inventory/variants/14/adjust",
      {
        method: "POST",
        body: JSON.stringify({
          quantity: -3,
          type: "adjustment",
          note: "cycle count",
        }),
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/admin/inventory/variants/14/reorder",
      {
        method: "PATCH",
        body: JSON.stringify({ reorder_point: 7, reorder_quantity: 30 }),
      },
    );
  });
});
