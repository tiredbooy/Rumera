// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "./button"

afterEach(cleanup)

describe("Button touch targets", () => {
  it("enforces a 44px minimum target on coarse pointers", () => {
    render(
      <Button size="icon-xs" aria-label="عملیات">
        x
      </Button>
    )

    const button = screen.getByRole("button", { name: "عملیات" })
    expect(button.className).toContain("[@media(any-pointer:coarse)]:min-h-11")
    expect(button.className).toContain("[@media(any-pointer:coarse)]:min-w-11")
  })
})
