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

const { uploadImageMock, uploadOwnerImageMock } = vi.hoisted(() => ({
  uploadImageMock: vi.fn(),
  uploadOwnerImageMock: vi.fn(),
}));

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

vi.mock("@/features/admin/uploads/client", () => ({
  uploadImage: uploadImageMock,
  uploadOwnerImage: uploadOwnerImageMock,
}));

import { FlexibleImageInput } from "./flexible-image-input";
import type { FlexibleImageInputHandle } from "../types";

afterEach(cleanup);

beforeEach(() => {
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

describe("FlexibleImageInput controls", () => {
  it("provides a visible 44px preview removal target", () => {
    const onChange = vi.fn();
    render(
      <FlexibleImageInput
        id="hero-image"
        value="/media/hero.webp"
        onChange={onChange}
      />,
    );

    const remove = screen.getByRole("button", { name: "حذف تصویر" });
    expect(remove).toHaveClass("size-11");
    expect(remove.className).toContain("focus-visible:ring-3");

    fireEvent.click(remove);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("stages owner media and attaches it only when the parent flushes", async () => {
    const ref = React.createRef<FlexibleImageInputHandle>();
    const onChange = vi.fn();
    const onStagedChange = vi.fn();
    uploadOwnerImageMock.mockResolvedValue({
      url: "/media/recipes/9/cover-owner.webp",
      key: "recipes/9/cover-owner.webp",
      width: 1200,
      height: 900,
    });
    render(
      <FlexibleImageInput
        ref={ref}
        id="recipe-cover"
        value=""
        onChange={onChange}
        onStagedChange={onStagedChange}
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
      <FlexibleImageInput
        id="category-image"
        value=""
        onChange={onChange}
        folder="categories"
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
      { folder: "categories" },
      expect.any(Function),
    );
    expect(onChange).toHaveBeenCalledWith("/media/categories/category.webp");
  });
});
