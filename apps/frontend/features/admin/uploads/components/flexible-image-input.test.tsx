// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

vi.mock("@/features/admin/uploads/client", () => ({
  uploadImage: vi.fn(),
}));

import { FlexibleImageInput } from "./flexible-image-input";

afterEach(cleanup);

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
});
