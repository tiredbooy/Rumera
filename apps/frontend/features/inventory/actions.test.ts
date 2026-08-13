import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  adjust: vi.fn(),
  revalidatePath: vi.fn(),
  updateReorder: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./api", () => ({
  adjustVariantStock: mocks.adjust,
  updateVariantReorderThreshold: mocks.updateReorder,
}));

import {
  adjustVariantStockAction,
  updateVariantReorderAction,
} from "./actions";

const inventory = {
  id: 4,
  product_variant_id: 14,
  product_id: 3,
  product_title: "محصول آزمایشی",
  unit_price: "125000",
  missing_weight: false,
  stock_on_hand: 10,
  committed_stock: 2,
  available_stock: 8,
  reorder_point: 4,
  reorder_quantity: 20,
  updated_at: "2026-08-01T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inventory actions", () => {
  it("returns serializable API errors with field details", async () => {
    mocks.adjust.mockRejectedValue(
      new ApiError(422, "VALIDATION_ERROR", "invalid", {
        quantity: ["quantity is invalid"],
      }),
    );

    await expect(
      adjustVariantStockAction({
        variantID: 14,
        input: { quantity: -3, type: "adjustment" },
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "invalid",
        fields: { quantity: ["quantity is invalid"] },
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns confirmed thresholds and revalidates every inventory surface", async () => {
    mocks.updateReorder.mockResolvedValue({
      ...inventory,
      reorder_point: 7,
      reorder_quantity: 30,
    });

    await expect(
      updateVariantReorderAction({
        variantID: 14,
        input: { reorder_point: 7, reorder_quantity: 30 },
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { reorder_point: 7, reorder_quantity: 30 },
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin",
      "/admin/inventory",
      "/admin/inventory/14",
    ]);
  });
});
