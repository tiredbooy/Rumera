import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  LoginTabs: vi.fn(() => null),
  RegisterForm: vi.fn(() => null),
  ResetPasswordForm: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));
vi.mock("@/features/auth/components/login-tabs", () => ({
  LoginTabs: mocks.LoginTabs,
}));
vi.mock("@/features/auth/components/register-form", () => ({
  RegisterForm: mocks.RegisterForm,
}));
vi.mock("@/features/auth/components/reset-password-form", () => ({
  ResetPasswordForm: mocks.ResetPasswordForm,
}));

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth pages bounce signed-in users", () => {
  it("redirects /login to a safe callbackUrl", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "/products" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/products");
    expect(mocks.LoginTabs).not.toHaveBeenCalled();
  });

  it("rejects an open-redirect callback on /login", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({
          callbackUrl: "https://evil.example/phish",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/account");
  });

  it("shows /login when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const ui = await LoginPage({ searchParams: Promise.resolve({}) });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(ui).toEqual(
      expect.objectContaining({
        type: mocks.LoginTabs,
        props: { callbackUrl: "/account" },
      }),
    );
  });

  it("does not bounce a dead refresh session on /login", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      error: "RefreshAccessTokenError",
    });

    const ui = await LoginPage({
      searchParams: Promise.resolve({ callbackUrl: "/account" }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(ui).toEqual(
      expect.objectContaining({
        type: mocks.LoginTabs,
        props: { callbackUrl: "/account" },
      }),
    );
  });

  it("redirects /register when a session already exists", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });

    await expect(
      RegisterPage({
        searchParams: Promise.resolve({ callbackUrl: "/account/orders" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/account/orders");
    expect(mocks.RegisterForm).not.toHaveBeenCalled();
  });

  it("shows /register for anonymous visitors", async () => {
    mocks.getSession.mockResolvedValue(null);

    const ui = await RegisterPage({ searchParams: Promise.resolve({}) });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(ui).toEqual(
      expect.objectContaining({
        type: mocks.RegisterForm,
        props: { callbackUrl: "/account" },
      }),
    );
  });
});

describe("reset-password page", () => {
  it("trims and forwards the reset token to the form", async () => {
    const ui = await ResetPasswordPage({
      searchParams: Promise.resolve({ token: " abc " }),
    });

    expect(ui).toEqual(
      expect.objectContaining({
        type: mocks.ResetPasswordForm,
        props: { token: "abc" },
      }),
    );
  });
});
