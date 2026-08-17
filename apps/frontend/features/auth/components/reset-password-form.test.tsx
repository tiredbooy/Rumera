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
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/features/auth/api/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/api/client")
  >("@/features/auth/api/client");
  return {
    ...actual,
    validateResetToken: mocks.validateResetToken,
    resetPassword: mocks.resetPassword,
  };
});

import {
  RESET_LINK_INVALID,
  RESET_LINK_SERVER_ERROR,
  ResetPasswordForm,
} from "./reset-password-form";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateResetToken.mockResolvedValue({ valid: true });
  mocks.resetPassword.mockResolvedValue(undefined);
});

describe("ResetPasswordForm token check", () => {
  it("does not call validate for an empty token and keeps submit unavailable", () => {
    render(<ResetPasswordForm token="" />);

    expect(mocks.validateResetToken).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(RESET_LINK_INVALID);
    expect(
      screen.queryByRole("button", { name: "ذخیرهٔ گذرواژه" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "درخواست لینک جدید" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("validates the token on load and only then enables submit", async () => {
    render(<ResetPasswordForm token="good-token" />);

    expect(mocks.validateResetToken).toHaveBeenCalledWith("good-token");
    expect(screen.getByRole("status")).toHaveTextContent(
      "در حال بررسی لینک بازیابی…",
    );
    expect(
      screen.queryByRole("button", { name: "ذخیرهٔ گذرواژه" }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("button", { name: "ذخیرهٔ گذرواژه" }),
    ).toBeEnabled();
  });

  it("uses one invalid/expired message and does not offer submit", async () => {
    mocks.validateResetToken.mockResolvedValue({ valid: false });

    render(<ResetPasswordForm token="used-or-expired" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      RESET_LINK_INVALID,
    );
    expect(
      screen.queryByRole("button", { name: "ذخیرهٔ گذرواژه" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "درخواست لینک جدید" }),
    ).toBeInTheDocument();
  });

  it("does not pretend the token is invalid when validation cannot reach the server", async () => {
    mocks.validateResetToken.mockRejectedValue(new Error("network"));

    render(<ResetPasswordForm token="maybe-valid" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(RESET_LINK_SERVER_ERROR);
    expect(alert).not.toHaveTextContent(RESET_LINK_INVALID);
    expect(
      screen.getByRole("button", { name: "ذخیرهٔ گذرواژه" }),
    ).toBeDisabled();
  });

  it("submits a new password after the token is confirmed", async () => {
    render(<ResetPasswordForm token="good-token" />);
    await screen.findByRole("button", { name: "ذخیرهٔ گذرواژه" });

    fireEvent.change(screen.getByLabelText("گذرواژهٔ جدید"), {
      target: { value: "new-secret-1" },
    });
    fireEvent.change(screen.getByLabelText("تکرار گذرواژه"), {
      target: { value: "new-secret-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ گذرواژه" }));

    await waitFor(() => {
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        token: "good-token",
        new_password: "new-secret-1",
      });
    });
    expect(mocks.push).toHaveBeenCalledWith("/login");
  });

  it("maps a late reset failure to the same invalid/expired copy", async () => {
    mocks.resetPassword.mockRejectedValue(new Error("gone"));

    render(<ResetPasswordForm token="good-token" />);
    await screen.findByRole("button", { name: "ذخیرهٔ گذرواژه" });

    fireEvent.change(screen.getByLabelText("گذرواژهٔ جدید"), {
      target: { value: "new-secret-1" },
    });
    fireEvent.change(screen.getByLabelText("تکرار گذرواژه"), {
      target: { value: "new-secret-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ گذرواژه" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(RESET_LINK_INVALID);
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
