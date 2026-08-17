// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "./dialog"

afterEach(cleanup)

describe("Dialog close (PR-090h)", () => {
  it("uses logical end-4 and accessible name بستن", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>عنوان</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

    const close = screen.getByRole("button", { name: "بستن" })
    expect(close.className).toContain("end-4")
    expect(close.className).not.toContain("right-4")
  })

  it("labels the footer close button بستن", () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false} aria-describedby={undefined}>
          <DialogTitle>عنوان</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole("button", { name: "بستن" })).toBeInTheDocument()
  })
})
