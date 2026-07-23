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
  updateImageAltMock.mockImplementation(
    async (_productId: number, imageId: number, altText: string) => ({
      id: imageId,
      image_url: "/media/products/12/gallery.webp",
      alt_text: altText || undefined,
      sort_order: 0,
      is_primary: true,
    }),
  );
});

describe("useImageUploader URL sources", () => {
  it("stages an external URL until the product owner exists", async () => {
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: null },
        initialImages: [],
      }),
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

  it("flushes a focused alt edit without requiring blur", async () => {
    const image = {
      id: 91,
      image_url: "/media/products/12/gallery.webp",
      alt_text: "Old alt",
      sort_order: 0,
      is_primary: true,
    };
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: 12 },
        initialImages: [image],
      }),
    );

    act(() => result.current.setAlt(result.current.slots[0], "New alt"));
    await act(async () => result.current.flush());

    expect(updateImageAltMock).toHaveBeenCalledWith(12, 91, "New alt");
    expect(result.current.slots[0].alt).toBe("New alt");
  });

  it("rejects overlong product alt text before persistence", () => {
    const image = {
      id: 91,
      image_url: "/media/products/12/gallery.webp",
      alt_text: "",
      sort_order: 0,
      is_primary: true,
    };
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: 12 },
        initialImages: [image],
      }),
    );

    act(() => result.current.setAlt(result.current.slots[0], "x".repeat(256)));

    expect(result.current.validate()).toMatch(/۲۵۵/);
    expect(updateImageAltMock).not.toHaveBeenCalled();
  });
});
