// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}));

import { LoginForm, signInErrorMessage } from "./login-form";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signInErrorMessage", () => {
  const fallback = "ایمیل یا گذرواژه نادرست است.";

  it("keeps wrong-credentials copy for the default Auth.js codes", () => {
    expect(
      signInErrorMessage({ error: "CredentialsSignin", code: "credentials" }, fallback),
    ).toBe(fallback);
    expect(
      signInErrorMessage({ error: "CredentialsSignin" }, fallback),
    ).toBe(fallback);
  });

  it("does not map rate-limit or server failures to wrong password", () => {
    expect(
      signInErrorMessage(
        { error: "CredentialsSignin", code: "RateLimited" },
        fallback,
      ),
    ).toBe("تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.");
    expect(
      signInErrorMessage(
        { error: "CredentialsSignin", code: "AuthServiceError" },
        fallback,
      ),
    ).toBe("ارتباط با سرور برقرار نشد.");
    expect(
      signInErrorMessage(
        { error: "CredentialsSignin", code: "Inactive" },
        fallback,
      ),
    ).toBe("این حساب غیرفعال است. در صورت نیاز با پشتیبانی تماس بگیرید.");
    expect(signInErrorMessage(null, fallback)).toBe(
      "ارتباط با سرور برقرار نشد.",
    );
  });
});

describe("LoginForm", () => {
  async function submitLogin() {
    render(<LoginForm callbackUrl="/account" />);
    fireEvent.change(screen.getByLabelText("ایمیل"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("گذرواژه"), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ورود" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    return screen.getByRole("alert");
  }

  it("shows distinct Persian copy for rate-limit, inactive, and server errors", async () => {
    mocks.signIn.mockResolvedValue({
      error: "CredentialsSignin",
      code: "RateLimited",
    });
    expect(await submitLogin()).toHaveTextContent(
      "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
    );
    cleanup();

    mocks.signIn.mockResolvedValue({
      error: "CredentialsSignin",
      code: "Inactive",
    });
    expect(await submitLogin()).toHaveTextContent(
      "این حساب غیرفعال است. در صورت نیاز با پشتیبانی تماس بگیرید.",
    );
    cleanup();

    mocks.signIn.mockResolvedValue({
      error: "CredentialsSignin",
      code: "AuthServiceError",
    });
    expect(await submitLogin()).toHaveTextContent(
      "ارتباط با سرور برقرار نشد.",
    );
    cleanup();

    mocks.signIn.mockResolvedValue({
      error: "CredentialsSignin",
      code: "credentials",
    });
    expect(await submitLogin()).toHaveTextContent(
      "ایمیل یا گذرواژه نادرست است.",
    );
  });

  it("navigates after a successful sign-in", async () => {
    mocks.signIn.mockResolvedValue({ ok: true, url: "/account" });
    render(<LoginForm callbackUrl="/products" />);
    fireEvent.change(screen.getByLabelText("ایمیل"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("گذرواژه"), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ورود" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/products"));
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
