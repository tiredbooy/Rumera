// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { releaseUploadMock, uploadImageMock, uploadOwnerImageMock } = vi.hoisted(
  () => ({
    releaseUploadMock: vi.fn(),
    uploadImageMock: vi.fn(),
    uploadOwnerImageMock: vi.fn(),
  }),
);

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

vi.mock("@/features/image-uploader/client", () => ({
  releaseUpload: releaseUploadMock,
  uploadImage: uploadImageMock,
  uploadOwnerImage: uploadOwnerImageMock,
}));

import { ImageInput } from "./ImageInput";
import type { ImageUploaderHandle, UploadedImage } from "./types";

afterEach(cleanup);

beforeEach(() => {
  releaseUploadMock.mockReset();
  releaseUploadMock.mockResolvedValue(undefined);
  uploadImageMock.mockReset();
  uploadOwnerImageMock.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:owner-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("ImageInput controls", () => {
  it("provides a visible 44px preview removal target", () => {
    const onChange = vi.fn();
    render(
      <ImageInput
        id="hero-image"
        value="/media/hero.webp"
        onChange={onChange}
        owner={{ ownerType: "hero-slides", role: "desktop", ownerId: 4 }}
      />,
    );

    const remove = screen.getByRole("button", { name: "حذف تصویر" });
    expect(remove).toHaveClass("size-11");
    expect(remove.className).toContain("focus-visible:ring-3");

    fireEvent.click(remove);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("stages owner media and attaches it only when the parent flushes", async () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    const onChange = vi.fn();
    const onStagedChange = vi.fn();
    uploadOwnerImageMock.mockResolvedValue({
      url: "/media/recipes/9/cover-owner.webp",
      key: "recipes/9/cover-owner.webp",
      width: 1200,
      height: 900,
    });
    render(
      <ImageInput
        ref={ref}
        id="recipe-cover"
        value=""
        onChange={onChange}
        onStagedChange={onStagedChange}
        altValue="  ظرف آماده سرو  "
        owner={{ ownerType: "recipes", role: "cover" }}
      />,
    );

    const file = new File(["image"], "cover.webp", { type: "image/webp" });
    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: { files: [file] },
    });

    expect(uploadOwnerImageMock).not.toHaveBeenCalled();
    expect(ref.current?.hasStaged).toBe(true);
    expect(onStagedChange).toHaveBeenCalledWith(true);
    expect(screen.getByText(/cover\.webp/)).toBeInTheDocument();

    await act(async () => {
      await ref.current?.flush(9);
    });

    expect(uploadOwnerImageMock).toHaveBeenCalledWith(
      file,
      { ownerType: "recipes", ownerId: 9, role: "cover" },
      { altText: "  ظرف آماده سرو  ", signal: expect.any(AbortSignal) },
      expect.any(Function),
    );
    expect(onChange).toHaveBeenCalledWith("/media/recipes/9/cover-owner.webp");
    expect(onStagedChange).toHaveBeenLastCalledWith(false);
    expect(ref.current?.hasStaged).toBe(false);
  });

  it("keeps category uploads on the legacy immediate endpoint", async () => {
    uploadImageMock.mockResolvedValue({
      url: "/media/categories/category.webp",
      key: "categories/category.webp",
      width: 800,
      height: 800,
    });
    const onChange = vi.fn();
    render(
      <ImageInput
        id="category-image"
        value=""
        onChange={onChange}
        legacyFolder="categories"
      />,
    );

    const file = new File(["image"], "category.webp", {
      type: "image/webp",
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
        target: { files: [file] },
      });
    });

    expect(uploadImageMock).toHaveBeenCalledWith(
      file,
      { folder: "categories", signal: expect.any(AbortSignal) },
      expect.any(Function),
    );
    expect(onChange).toHaveBeenCalledWith("/media/categories/category.webp");
  });

  it("releases a cancelled standalone upload", async () => {
    uploadImageMock.mockResolvedValue({
      url: "/media/categories/cancelled.webp",
      key: "categories/cancelled.webp",
      width: 800,
      height: 800,
    });
    const onChange = vi.fn();
    function StandaloneHarness() {
      const [value, setValue] = React.useState("");
      return (
        <ImageInput
          id="category-image"
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          legacyFolder="categories"
        />
      );
    }
    render(<StandaloneHarness />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
        target: {
          files: [new File(["image"], "category.webp", { type: "image/webp" })],
        },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "حذف تصویر" }));

    expect(releaseUploadMock).toHaveBeenCalledWith("categories/cancelled.webp");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("rejects unsafe URL schemes before the parent can save", () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    render(
      <ImageInput
        ref={ref}
        id="hero-image"
        value="javascript:alert(1)"
        onChange={vi.fn()}
        owner={{ ownerType: "hero-slides", role: "desktop", ownerId: 4 }}
      />,
    );

    expect(ref.current?.validate()).toMatch(/HTTP/);
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("clears an invalid URL when a valid owner file replaces it", () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    const onChange = vi.fn();
    render(
      <ImageInput
        ref={ref}
        id="hero-image"
        value="javascript:alert(1)"
        onChange={onChange}
        owner={{ ownerType: "hero-slides", role: "desktop", ownerId: 4 }}
      />,
    );

    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: {
        files: [new File(["image"], "hero.webp", { type: "image/webp" })],
      },
    });

    expect(onChange).toHaveBeenCalledWith("");
    expect(ref.current?.validate()).toBeNull();
  });

  it("keeps a rejected file selection as a blocking validation error", () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    render(
      <ImageInput
        ref={ref}
        id="recipe-cover"
        value=""
        onChange={vi.fn()}
        owner={{ ownerType: "recipes", role: "cover", ownerId: 9 }}
      />,
    );

    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: {
        files: [new File(["text"], "cover.txt", { type: "text/plain" })],
      },
    });

    expect(ref.current?.validate()).toMatch(/فرمت/);
    expect(screen.getByRole("alert")).toHaveTextContent(/فرمت/);
  });

  it("clears a rejected selection when the persisted image is removed", () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    const onChange = vi.fn();
    render(
      <ImageInput
        ref={ref}
        id="recipe-cover"
        value="/images/current.webp"
        onChange={onChange}
        owner={{ ownerType: "recipes", role: "cover", ownerId: 9 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: {
        files: [new File(["text"], "cover.txt", { type: "text/plain" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "حذف تصویر" }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(ref.current?.validate()).toBeNull();
  });

  it("does not send an invalid typed URL to an external live preview", () => {
    const onPreviewChange = vi.fn();
    render(
      <ImageInput
        id="hero-image"
        value=""
        onChange={vi.fn()}
        onPreviewChange={onPreviewChange}
        owner={{ ownerType: "hero-slides", role: "desktop", ownerId: 4 }}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "h" },
    });

    expect(onPreviewChange).toHaveBeenLastCalledWith("");
  });

  it("cancels a staged replacement without clearing the existing URL", () => {
    const onChange = vi.fn();
    const onPreviewChange = vi.fn();
    render(
      <ImageInput
        id="recipe-cover"
        value="/images/current.webp"
        onChange={onChange}
        onPreviewChange={onPreviewChange}
        owner={{ ownerType: "recipes", role: "cover", ownerId: 9 }}
      />,
    );

    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: {
        files: [new File(["image"], "new.webp", { type: "image/webp" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "لغو جایگزینی تصویر" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onPreviewChange).toHaveBeenLastCalledWith("/images/current.webp");
  });

  it("deduplicates concurrent flushes for the same staged file", async () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    uploadOwnerImageMock.mockResolvedValue({
      url: "/media/journal/7/cover-owner.webp",
      key: "journal/7/cover-owner.webp",
      width: 1200,
      height: 800,
    });
    render(
      <ImageInput
        ref={ref}
        id="journal-cover"
        value=""
        onChange={vi.fn()}
        owner={{ ownerType: "journal", role: "cover" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: {
        files: [new File(["image"], "cover.webp", { type: "image/webp" })],
      },
    });

    await act(async () => {
      await Promise.all([ref.current?.flush(7), ref.current?.flush(7)]);
    });

    expect(uploadOwnerImageMock).toHaveBeenCalledTimes(1);
  });

  it("uses custom file constraints consistently at selection and flush", async () => {
    const ref = React.createRef<ImageUploaderHandle<UploadedImage | null>>();
    uploadOwnerImageMock.mockResolvedValue({
      url: "/media/journal/7/cover-owner.gif",
      key: "journal/7/cover-owner.gif",
      width: 640,
      height: 480,
    });
    render(
      <ImageInput
        ref={ref}
        id="journal-cover"
        value=""
        accept={["image/gif"]}
        onChange={vi.fn()}
        owner={{ ownerType: "journal", role: "cover" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("انتخاب فایل تصویر"), {
      target: {
        files: [new File(["gif"], "cover.gif", { type: "image/gif" })],
      },
    });

    expect(ref.current?.validate()).toBeNull();
    await act(async () => {
      await ref.current?.flush(7);
    });
    expect(uploadOwnerImageMock).toHaveBeenCalledTimes(1);
  });
});
