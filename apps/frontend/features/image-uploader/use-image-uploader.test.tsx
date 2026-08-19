// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  addProductImageURLMock,
  uploadProductImageMock,
  deleteProductImageMock,
  reorderProductImagesMock,
  setPrimaryImageMock,
  updateImageAltMock,
  uploadStandaloneImageMock,
  releaseUploadMock,
} = vi.hoisted(() => ({
  addProductImageURLMock: vi.fn(),
  uploadProductImageMock: vi.fn(),
  deleteProductImageMock: vi.fn(),
  reorderProductImagesMock: vi.fn(),
  setPrimaryImageMock: vi.fn(),
  updateImageAltMock: vi.fn(),
  uploadStandaloneImageMock: vi.fn(),
  releaseUploadMock: vi.fn(),
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

vi.mock("./client", () => ({
  uploadImage: uploadStandaloneImageMock,
  releaseUpload: releaseUploadMock,
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
  uploadStandaloneImageMock.mockResolvedValue({
    url: "/media/uploads/prepared.webp",
    key: "uploads/prepared.webp",
    width: 1200,
    height: 800,
  });
  releaseUploadMock.mockResolvedValue(undefined);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:prepared"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
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

  it("keeps edit-mode gallery changes local until aggregate preparation", async () => {
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
        deferred: true,
      }),
    );

    act(() => {
      result.current.addURL("https://images.example/second.webp");
      result.current.setAlt(result.current.slots[0], "Deferred alt");
    });
    let prepared: Awaited<ReturnType<typeof result.current.prepare>> = [];
    await act(async () => {
      prepared = await result.current.prepare();
    });

    expect(prepared).toEqual([
      { id: 91, alt_text: "Deferred alt", is_primary: true },
      {
        image_url: "https://images.example/second.webp",
        alt_text: null,
        is_primary: false,
      },
    ]);
    expect(addProductImageURLMock).not.toHaveBeenCalled();
    expect(updateImageAltMock).not.toHaveBeenCalled();
    expect(reorderProductImagesMock).not.toHaveBeenCalled();
  });

  it("promotes a replacement when the deferred primary is removed", async () => {
    const images = [
      {
        id: 91,
        image_url: "/media/products/12/primary.webp",
        alt_text: "Primary",
        sort_order: 0,
        is_primary: true,
      },
      {
        id: 92,
        image_url: "/media/products/12/second.webp",
        alt_text: "Second",
        sort_order: 1,
        is_primary: false,
      },
    ];
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: 12 },
        initialImages: images,
        deferred: true,
      }),
    );

    act(() => result.current.removeSlot(result.current.slots[0]));
    let prepared: Awaited<ReturnType<typeof result.current.prepare>> = [];
    await act(async () => {
      prepared = await result.current.prepare();
    });

    expect(prepared).toEqual([
      { id: 92, alt_text: "Second", is_primary: true },
    ]);
    expect(deleteProductImageMock).not.toHaveBeenCalled();
    expect(setPrimaryImageMock).not.toHaveBeenCalled();
  });

  // PE-2's rebase has to survive PE-8's single-cover rule: the colleague's
  // rows arrive with their own `is_primary`, and exactly one slot — the first —
  // may keep it afterwards.
  it("rebases onto a colleague's revision with one cover left standing", async () => {
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: 12 },
        initialImages: [
          {
            id: 91,
            image_url: "/media/products/12/mine.webp",
            alt_text: "مال من",
            sort_order: 0,
            is_primary: true,
          },
          {
            id: 92,
            image_url: "/media/products/12/second.webp",
            alt_text: "دوم",
            sort_order: 1,
            is_primary: false,
          },
        ],
        deferred: true,
      }),
    );

    act(() => {
      result.current.addURL("https://images.example/staged.webp");
    });

    let outcome = { dropped: 0, adopted: 0 };
    act(() => {
      // The colleague deleted 91 and added 93 as their primary.
      outcome = result.current.rebase([
        {
          id: 93,
          image_url: "/media/products/12/theirs.webp",
          alt_text: "مال همکار",
          sort_order: 0,
          is_primary: true,
        },
        {
          id: 92,
          image_url: "/media/products/12/second.webp",
          alt_text: "دوم",
          sort_order: 1,
          is_primary: false,
        },
      ]);
    });

    expect(outcome).toEqual({ dropped: 1, adopted: 1 });
    let prepared: Awaited<ReturnType<typeof result.current.prepare>> = [];
    await act(async () => {
      prepared = await result.current.prepare();
    });
    expect(prepared.map((image) => image.is_primary)).toEqual([
      true,
      false,
      false,
    ]);
    // Staged work is kept, the colleague's row is adopted, and the surviving
    // local order decides the cover.
    expect(prepared).toEqual([
      { id: 92, alt_text: "دوم", is_primary: true },
      {
        image_url: "https://images.example/staged.webp",
        alt_text: null,
        is_primary: false,
      },
      { id: 93, alt_text: "مال همکار", is_primary: false },
    ]);
  });

  it("uploads a staged file once across aggregate retries", async () => {
    const { result, unmount } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: null },
        initialImages: [],
        deferred: true,
      }),
    );
    const file = new File(["image"], "bottle.webp", { type: "image/webp" });
    act(() => result.current.addFiles([file]));

    let first: Awaited<ReturnType<typeof result.current.prepare>> = [];
    let second: Awaited<ReturnType<typeof result.current.prepare>> = [];
    await act(async () => {
      first = await result.current.prepare();
      second = await result.current.prepare();
    });

    expect(first).toEqual([
      {
        storage_key: "uploads/prepared.webp",
        alt_text: null,
        is_primary: true,
      },
    ]);
    expect(second).toEqual(first);
    expect(uploadStandaloneImageMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.commit([
        {
          id: 100,
          image_url: "/media/uploads/prepared.webp",
          storage_key: "uploads/prepared.webp",
          sort_order: 0,
          is_primary: true,
        },
      ]);
    });
    unmount();
    expect(releaseUploadMock).not.toHaveBeenCalled();
  });

  it("releases a rejected prepared upload and re-uploads on the next attempt", async () => {
    uploadStandaloneImageMock
      .mockResolvedValueOnce({
        url: "/media/uploads/rejected.webp",
        key: "uploads/rejected.webp",
        width: 1200,
        height: 800,
      })
      .mockResolvedValueOnce({
        url: "/media/uploads/reprepared.webp",
        key: "uploads/reprepared.webp",
        width: 1200,
        height: 800,
      });
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: null },
        initialImages: [],
        deferred: true,
      }),
    );
    act(() =>
      result.current.addFiles([
        new File(["image"], "retry.webp", { type: "image/webp" }),
      ]),
    );

    await act(async () => {
      await result.current.prepare();
    });
    act(() => result.current.discardPrepared());
    await waitFor(() =>
      expect(releaseUploadMock).toHaveBeenCalledWith("uploads/rejected.webp"),
    );

    let reprepared: Awaited<ReturnType<typeof result.current.prepare>> = [];
    await act(async () => {
      reprepared = await result.current.prepare();
    });

    expect(reprepared).toEqual([
      {
        storage_key: "uploads/reprepared.webp",
        alt_text: null,
        is_primary: true,
      },
    ]);
    expect(uploadStandaloneImageMock).toHaveBeenCalledTimes(2);
  });

  it("retries a transient deferred upload failure on the next prepare", async () => {
    uploadStandaloneImageMock
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({
        url: "/media/uploads/retried.webp",
        key: "uploads/retried.webp",
        width: 800,
        height: 600,
      });
    const { result } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: null },
        initialImages: [],
        deferred: true,
      }),
    );
    act(() =>
      result.current.addFiles([
        new File(["image"], "retry.webp", { type: "image/webp" }),
      ]),
    );

    await act(async () => {
      await expect(result.current.prepare()).rejects.toThrow(
        "network unavailable",
      );
    });
    expect(result.current.validate()).toBeNull();

    let prepared: Awaited<ReturnType<typeof result.current.prepare>> = [];
    await act(async () => {
      prepared = await result.current.prepare();
    });
    expect(prepared).toEqual([
      {
        storage_key: "uploads/retried.webp",
        alt_text: null,
        is_primary: true,
      },
    ]);
    expect(uploadStandaloneImageMock).toHaveBeenCalledTimes(2);
  });

  it("releases an upload that finishes after the uploader unmounts", async () => {
    let finishUpload: ((upload: unknown) => void) | undefined;
    uploadStandaloneImageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: null },
        initialImages: [],
        deferred: true,
      }),
    );
    act(() =>
      result.current.addFiles([
        new File(["image"], "late.webp", { type: "image/webp" }),
      ]),
    );

    let preparation: ReturnType<typeof result.current.prepare> | undefined;
    act(() => {
      preparation = result.current.prepare();
    });
    unmount();
    finishUpload?.({
      url: "/media/uploads/late.webp",
      key: "uploads/late.webp",
      width: 800,
      height: 600,
    });

    await expect(preparation).rejects.toThrow("بارگذاری لغو شد");
    expect(releaseUploadMock).toHaveBeenCalledWith("uploads/late.webp");
  });

  it("preserves prepared uploads when an ambiguous save is recoverable", async () => {
    const { result, unmount } = renderHook(() =>
      useImageUploader({
        owner: { ownerType: "products", role: "gallery", ownerId: null },
        initialImages: [],
        deferred: true,
      }),
    );
    act(() =>
      result.current.addFiles([
        new File(["image"], "recoverable.webp", { type: "image/webp" }),
      ]),
    );
    await act(async () => {
      await result.current.prepare();
    });
    act(() => result.current.preservePrepared(true));

    unmount();

    expect(releaseUploadMock).not.toHaveBeenCalled();
  });

  it("reports deferred gallery changes and clears dirty state after commit", async () => {
    const onDirtyChange = vi.fn();
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
        deferred: true,
        onDirtyChange,
      }),
    );
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));

    act(() => result.current.setAlt(result.current.slots[0], "New alt"));
    expect(result.current.isDirty).toBe(true);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    act(() =>
      result.current.commit([
        {
          ...image,
          alt_text: "New alt",
        },
      ]),
    );
    expect(result.current.isDirty).toBe(false);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });
});
