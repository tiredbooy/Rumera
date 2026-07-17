// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

import { LoginForm } from "./login-form";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue({ error: "CredentialsSignin" });
});

describe("auth form errors", () => {
  it("describes invalid controls and focuses the first affected field", async () => {
    render(<LoginForm callbackUrl="/account" />);
    const email = screen.getByLabelText("ایمیل");
    const password = screen.getByLabelText("گذرواژه");

    fireEvent.change(email, { target: { value: "user@example.com" } });
    fireEvent.change(password, { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "ورود" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-describedby", "login-error");
    expect(password).toHaveAttribute("aria-describedby", "login-error");
  });
});
