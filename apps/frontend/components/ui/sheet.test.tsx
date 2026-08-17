// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Sheet, SheetContent, SheetTitle } from "./sheet"

afterEach(cleanup)

describe("Sheet close (PR-090h)", () => {
  it("uses logical end-4 and accessible name بستن", () => {
    render(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>عنوان</SheetTitle>
        </SheetContent>
      </Sheet>,
    )

    const close = screen.getByRole("button", { name: "بستن" })
    expect(close.className).toContain("end-4")
    expect(close.className).not.toContain("right-4")
  })
})
