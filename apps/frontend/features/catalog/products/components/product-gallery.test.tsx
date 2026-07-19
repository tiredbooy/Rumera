// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ProductImage } from "@/features/catalog/products/types"

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}))

import { ProductGallery } from "./product-gallery"

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
]

afterEach(cleanup)

describe("ProductGallery keyboard interaction", () => {
  it("advances from the focused frame and exposes visible 44px controls", () => {
    render(
      <ProductGallery
        images={images}
        title="محصول نمونه"
        fallback={<span>بدون تصویر</span>}
      />
    )

    const frame = screen.getByRole("group", { name: "محصول نمونه" })
    expect(frame.className).toContain("focus-visible:ring-3")
    frame.focus()
    expect(frame).toHaveFocus()
    fireEvent.keyDown(frame, { key: "ArrowLeft" })

    expect(screen.getByRole("img", { name: "تصویر دوم" })).toBeInTheDocument()
    const previous = screen.getByRole("button", { name: "تصویر قبلی" })
    expect(previous).toHaveClass("size-11")
    expect(previous.className).toContain("focus-visible:ring-3")
  })
})
