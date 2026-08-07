import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  deleteProduct: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateAfterAdminMutation: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/apply-admin-revalidation", () => ({
  revalidateAfterAdminMutation: mocks.revalidateAfterAdminMutation,
}));
vi.mock("@/features/admin/products/api/server", () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: mocks.deleteProduct,
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
  replaceVariantOptions: vi.fn(),
}));

import { deleteProduct } from "./product";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteProduct", () => {
  it("explains that products with audit history must be deactivated", async () => {
    mocks.deleteProduct.mockRejectedValue(
      new ApiError(
        409,
        "PRODUCT_HAS_HISTORY",
        "product has inventory or order history",
      ),
    );

    await expect(deleteProduct(37)).resolves.toEqual({
      ok: false,
      code: "PRODUCT_HAS_HISTORY",
      message:
        "این محصول سابقهٔ انبار یا سفارش دارد و حذف دائمی آن ممکن نیست. برای پنهان‌کردن آن، محصول را غیرفعال کنید.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
