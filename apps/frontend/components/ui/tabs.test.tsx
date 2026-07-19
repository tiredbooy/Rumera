// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Tabs, TabsList, TabsTrigger } from "./tabs"

afterEach(cleanup)

describe("Tabs responsive overflow", () => {
  it("keeps a wide horizontal tab list inside its container", () => {
    render(
      <Tabs defaultValue="one">
        <TabsList aria-label="بخش‌ها" className="w-full">
          {Array.from({ length: 6 }, (_, index) => (
            <TabsTrigger key={index} value={index === 0 ? "one" : String(index)}>
              بخش {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>,
    )

    const tablist = screen.getByRole("tablist", { name: "بخش‌ها" })

    expect(tablist.parentElement).toHaveClass("min-w-0")
    expect(tablist).toHaveClass(
      "w-full",
      "max-w-full",
      "overflow-x-auto",
      "overscroll-x-contain",
    )
  })
})
