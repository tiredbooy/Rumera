// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  addProductImageURLMock,
  uploadProductImageMock,
  deleteProductImageMock,
  reorderProductImagesMock,
  setPrimaryImageMock,
  updateImageAltMock,
} = vi.hoisted(() => ({
  addProductImageURLMock: vi.fn(),
  uploadProductImageMock: vi.fn(),
  deleteProductImageMock: vi.fn(),
  reorderProductImagesMock: vi.fn(),
  setPrimaryImageMock: vi.fn(),
  updateImageAltMock: vi.fn(),
}));

vi.mock("../admin/products/api/client", () => ({
  addProductImageURL: addProductImageURLMock,
  uploadProductImage: uploadProductImageMock,
}));

vi.mock("../admin/products/actions/images", () => ({
  deleteProductImage: deleteProductImageMock,
  reorderProductImages: reorderProductImagesMock,
  setPrimaryImage: setPrimaryImageMock,
  updateImageAlt: updateImageAltMock,
}));

import { useImageUploader } from "./use-image-uploader";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  addProductImageURLMock.mockResolvedValue({
    id: 81,
    image_url: "https://images.example/product.webp",
    alt_text: null,
    sort_order: 0,
    is_primary: true,
  });
  setPrimaryImageMock.mockResolvedValue(undefined);
  reorderProductImagesMock.mockResolvedValue(undefined);
});

describe("useImageUploader URL sources", () => {
  it("stages an external URL until the product owner exists", async () => {
    const { result } = renderHook(() =>
      useImageUploader({ productId: null, initialImages: [] }),
    );

    act(() => {
      expect(result.current.addURL("https://images.example/product.webp")).toBe(
        true,
      );
    });
    expect(result.current.hasStaged).toBe(true);
    expect(addProductImageURLMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flush(12);
    });

    expect(addProductImageURLMock).toHaveBeenCalledWith(
      12,
      "https://images.example/product.webp",
      { altText: undefined, isPrimary: true },
    );
    expect(setPrimaryImageMock).toHaveBeenCalledWith(12, 81);
    expect(result.current.hasStaged).toBe(false);
  });
});
