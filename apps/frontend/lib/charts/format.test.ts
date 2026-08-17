import { describe, expect, it } from "vitest"

import { faMoneyTick, faNum, faTick, faToman } from "./format"

describe("chart format helpers", () => {
  it("formats count ticks with Persian digits", () => {
    expect(faTick(0)).toBe(faNum(0))
    expect(faTick(42)).toBe(faNum(42))
    expect(faTick(1_234)).toBe(faNum(1_234))
  })

  it("formats toman millions with م shorthand", () => {
    expect(faMoneyTick(0)).toBe(`${faNum(0)}م`)
    expect(faMoneyTick(18_000_000)).toBe(`${faNum(18)}م`)
    expect(faMoneyTick(18_400_000)).toBe(`${faNum(18)}م`)
    expect(faMoneyTick(18_600_000)).toBe(`${faNum(19)}م`)
  })

  it("formats full toman tooltip labels", () => {
    expect(faToman(18_900_000)).toBe(`${faNum(18_900_000)} تومان`)
  })
})
