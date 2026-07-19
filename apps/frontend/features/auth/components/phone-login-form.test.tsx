// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  requestOtp: vi.fn(),
  signIn: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}))

vi.mock("@/features/auth/api/client", () => ({
  AuthClientError: class AuthClientError extends Error {
    status = 400
  },
  requestOtp: mocks.requestOtp,
}))

import { PhoneLoginForm } from "./phone-login-form"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  mocks.requestOtp.mockResolvedValue(undefined)
})

describe("PhoneLoginForm responsive OTP", () => {
  it("fits all six code cells within the available form width", async () => {
    const { container } = render(<PhoneLoginForm callbackUrl="/account" />)

    fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), {
      target: { value: "09123456789" },
    })
    fireEvent.click(screen.getByRole("button", { name: "ارسال کد تأیید" }))

    await screen.findByRole("heading", { name: "تأیید شماره" })

    const group = container.querySelector<HTMLElement>(
      '[data-slot="input-otp-group"]',
    )
    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]')

    expect(group).toHaveClass(
      "grid",
      "w-full",
      "max-w-[328px]",
      "grid-cols-6",
    )
    expect(slots).toHaveLength(6)
    slots.forEach((slot) => {
      expect(slot).toHaveClass("w-full", "min-w-0", "max-w-12")
    })
  })
})
