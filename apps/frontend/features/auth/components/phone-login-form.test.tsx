// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  requestOtp: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}));

vi.mock("@/features/auth/api/client", () => ({
  AuthClientError: class AuthClientError extends Error {
    constructor(
      public status = 400,
      public code = "UNKNOWN",
      message = "error",
    ) {
      super(message);
      this.name = "AuthClientError";
    }
  },
  requestOtp: mocks.requestOtp,
}));

import { PhoneLoginForm } from "./phone-login-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  document.elementFromPoint = () => null;
  mocks.requestOtp.mockResolvedValue(undefined);
});

describe("PhoneLoginForm responsive OTP", () => {
  it("fits all six code cells within the available form width", async () => {
    const { container, unmount } = render(
      <PhoneLoginForm callbackUrl="/account" />,
    );

    fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), {
      target: { value: "09123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ارسال کد تأیید" }));

    await screen.findByRole("heading", { name: "تأیید شماره" });

    const group = container.querySelector<HTMLElement>(
      '[data-slot="input-otp-group"]',
    );
    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');

    expect(group).toHaveClass("grid", "w-full", "max-w-[328px]", "grid-cols-6");
    expect(slots).toHaveLength(6);
    slots.forEach((slot) => {
      expect(slot).toHaveClass("w-full", "min-w-0", "max-w-12");
    });

    // input-otp schedules 0/10/50ms password-manager probes. Let them settle
    // before JSDOM removes `window`, otherwise the suite can pass assertions but
    // still terminate with an unhandled React state update.
    unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 75)));
  });
});

describe("PhoneLoginForm sign-in errors", () => {
  async function reachCodeStep() {
    const view = render(<PhoneLoginForm callbackUrl="/account" />);
    fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), {
      target: { value: "09123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ارسال کد تأیید" }));
    await screen.findByRole("heading", { name: "تأیید شماره" });
    return view;
  }

  it.each([
    [
      "RateLimited",
      "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
    ],
    ["AuthServiceError", "ارتباط با سرور برقرار نشد."],
    [
      "Inactive",
      "این حساب غیرفعال است. در صورت نیاز با پشتیبانی تماس بگیرید.",
    ],
    ["credentials", "کد واردشده نادرست یا منقضی شده است."],
  ] as const)("maps OTP %s to distinct Persian copy", async (code, copy) => {
    const { unmount } = await reachCodeStep();
    mocks.signIn.mockResolvedValue({
      error: "CredentialsSignin",
      code,
    });
    fireEvent.change(screen.getByLabelText("کد تأیید"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ورود" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 75)));
  });

  it("keeps request-OTP 429 distinct from an invalid phone number", async () => {
    const { AuthClientError } = await import("@/features/auth/api/client");
    mocks.requestOtp.mockRejectedValueOnce(
      new AuthClientError(429, "TOO_MANY_REQUESTS", "slow down"),
    );
    render(<PhoneLoginForm callbackUrl="/account" />);
    fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), {
      target: { value: "09123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ارسال کد تأیید" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
    );
  });
});
