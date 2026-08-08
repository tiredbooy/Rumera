// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductImage } from "@/features/catalog/products/types";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

import { ProductGallery } from "./product-gallery";

const images: ProductImage[] = [
  {
    id: 1,
    image_url: "/first.jpg",
    alt_text: "تصویر اول",
    sort_order: 0,
    is_primary: true,
  },
  {
    id: 2,
    image_url: "/second.jpg",
    alt_text: "تصویر دوم",
    sort_order: 1,
    is_primary: false,
  },
  {
    id: 3,
    image_url: "/third.jpg",
    alt_text: "   ",
    sort_order: 2,
    is_primary: false,
  },
];

afterEach(cleanup);

describe("ProductGallery keyboard interaction", () => {
  it("names and positions previous/next controls for RTL sequence direction", () => {
    render(
      <ProductGallery
        images={images}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />,
    );

    const frame = screen.getByRole("group", { name: "محصول نمونه" });
    expect(frame.className).toContain("focus-visible:ring-3");
    const next = screen.getByRole("button", { name: "تصویر بعدی" });
    const previous = screen.getByRole("button", { name: "تصویر قبلی" });
    expect(next).toHaveClass("size-11", "opacity-90");
    expect(next.className).toMatch(/end-3|end-4/);
    expect(previous).toHaveClass("size-11", "opacity-90");
    expect(previous.className).toMatch(/start-3|start-4/);
    expect(previous.className).toContain("focus-visible:ring-3");
    // Clean frame: no cellar-glow backdrop on the media stage.
    expect(frame.className).not.toContain("cellar-glow");

    fireEvent.click(next);
    expect(screen.getByRole("img", { name: "تصویر دوم" })).toBeInTheDocument();
    fireEvent.click(next);
    expect(
      screen.getByRole("img", { name: "محصول نمونه" }),
    ).toBeInTheDocument();
    fireEvent.click(previous);
    expect(screen.getByRole("img", { name: "تصویر دوم" })).toBeInTheDocument();
  });

  it("uses RTL arrow direction on the frame", () => {
    render(
      <ProductGallery
        images={images}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />,
    );

    const frame = screen.getByRole("group", { name: "محصول نمونه" });
    frame.focus();
    fireEvent.keyDown(frame, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: "تصویر دوم" })).toBeInTheDocument();
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "تصویر اول" })).toBeInTheDocument();
  });

  it("roves thumbnail focus with RTL arrows and Home/End", () => {
    render(
      <ProductGallery
        images={images}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />,
    );

    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowLeft" });
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radios[1], { key: "End" });
    expect(radios[2]).toHaveFocus();
    expect(radios[2]).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radios[2], { key: "Home" });
    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  it("falls back to the product title for blank image alt text", () => {
    render(
      <ProductGallery
        images={images}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "تصویر بعدی" }));
    fireEvent.click(screen.getByRole("button", { name: "تصویر بعدی" }));
    expect(
      screen.getByRole("img", { name: "محصول نمونه" }),
    ).toBeInTheDocument();
  });

  it("clamps the active index when a rerender removes images", () => {
    const { rerender } = render(
      <ProductGallery
        images={images}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "تصویر بعدی" }));
    fireEvent.click(screen.getByRole("button", { name: "تصویر بعدی" }));
    rerender(
      <ProductGallery
        images={images.slice(0, 2)}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />,
    );

    expect(screen.getByRole("img", { name: "تصویر دوم" })).toBeInTheDocument();
  });
});
