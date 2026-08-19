// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { releaseUploadMock } = vi.hoisted(() => ({
  releaseUploadMock: vi.fn(),
}));

vi.mock("../admin/products/api/client", () => ({
  addProductImageURL: vi.fn(),
  uploadProductImage: vi.fn(),
}));

vi.mock("../admin/products/actions/images", () => ({
  deleteProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
  setPrimaryImage: vi.fn(),
  updateImageAlt: vi.fn(),
}));

vi.mock("./client", () => ({
  uploadImage: vi.fn(),
  releaseUpload: releaseUploadMock,
}));

import { ImageUploader } from "./ImageUploader";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  releaseUploadMock.mockResolvedValue(undefined);
});

const images = [
  {
    id: 91,
    image_url: "/media/products/12/second.webp",
    alt_text: "دوم",
    sort_order: 1,
    is_primary: false,
  },
  {
    id: 92,
    image_url: "/media/products/12/cover.webp",
    alt_text: "کاور",
    sort_order: 2,
    is_primary: true,
  },
];

describe("ImageUploader gallery reporting", () => {
  /**
   * The prop was declared on ProductImageUploaderProps and passed by
   * ImagesSection, but ImageUploader never destructured it — so the sidebar
   * cover and the «N تصویر» summary sat on the mount-time snapshot forever.
   */
  it("reports the gallery to its owner (PE-8 dropped prop)", () => {
    const onGalleryChange = vi.fn();
    render(
      <ImageUploader
        owner={{ ownerType: "products", role: "gallery", ownerId: 12 }}
        deferred
        initialImages={images}
        onGalleryChange={onGalleryChange}
      />,
    );

    expect(onGalleryChange).toHaveBeenCalledWith({
      count: 2,
      primaryUrl: "/media/products/12/cover.webp",
    });
  });

  it("hands the cover to the next image when the gallery is reordered", () => {
    const onGalleryChange = vi.fn();
    render(
      <ImageUploader
        owner={{ ownerType: "products", role: "gallery", ownerId: 12 }}
        deferred
        initialImages={images}
        onGalleryChange={onGalleryChange}
      />,
    );

    // The primary loads first — that is the order the storefront renders.
    expect(screen.getByText("تصویر اصلی")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "انتقال تصویر 1 از 2 به جایگاه بعدی",
      }),
    );

    expect(onGalleryChange).toHaveBeenLastCalledWith({
      count: 2,
      primaryUrl: "/media/products/12/second.webp",
    });
  });
});
