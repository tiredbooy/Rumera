// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/features/customers/client", () => {
  class AdminCustomerApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
      public readonly fields?: Record<string, string[]>,
    ) {
      super(message);
      this.name = "AdminCustomerApiError";
    }
  }

  return {
    AdminCustomerApiError,
    createAdminUser: mocks.create,
  };
});

import { AdminCustomerApiError } from "@/features/customers/client";
import { UserCreateForm } from "./UserCreateForm";

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
  mocks.create.mockResolvedValue({
    user_id: "created-user",
    email: "mina@example.com",
  });
});

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("ایمیل"), {
    target: { value: " mina@example.com " },
  });
  fireEvent.change(screen.getByLabelText("گذرواژه"), {
    target: { value: "secure-pass" },
  });
}

describe("UserCreateForm", () => {
  it("submits a normalized snake_case payload and exposes pending state", async () => {
    let resolveCreate:
      | ((value: { user_id: string; email: string }) => void)
      | null = null;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<UserCreateForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("نام"), {
      target: { value: "  مینا  " },
    });
    fireEvent.change(screen.getByLabelText("تلفن"), {
      target: { value: "۰۹۱۲۳۴۵۶۷۸۹" },
    });
    fireEvent.change(screen.getByLabelText("تاریخ تولد"), {
      target: { value: "1995-02-03" },
    });
    fireEvent.change(screen.getByLabelText("جنسیت"), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText("نقش کاربر"), {
      target: { value: "vendor" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ساخت کاربر" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith({
      email: "mina@example.com",
      password: "secure-pass",
      first_name: "مینا",
      phone: "09123456789",
      birth_date: "1995-02-03T00:00:00Z",
      gender: "female",
      role: "vendor",
      is_active: true,
    });
    expect(screen.getByRole("button", { name: "در حال ساخت…" })).toBeDisabled();

    await act(async () => {
      resolveCreate?.({ user_id: "created-user", email: "mina@example.com" });
    });
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/admin/customers/created-user"),
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("maps backend field errors inline and focuses the first invalid field", async () => {
    mocks.create.mockRejectedValue(
      new AdminCustomerApiError(422, "VALIDATION_ERROR", "invalid input", {
        email: ["این ایمیل قبلاً ثبت شده است."],
        phone: ["شمارهٔ تلفن معتبر نیست."],
      }),
    );
    render(<UserCreateForm />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "ساخت کاربر" }));

    expect(
      await screen.findByText("این ایمیل قبلاً ثبت شده است."),
    ).toBeInTheDocument();
    expect(screen.getByText("شمارهٔ تلفن معتبر نیست.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("ایمیل")).toHaveFocus());
  });

  it("focuses the first client-invalid field and does not call the backend", async () => {
    render(<UserCreateForm />);

    fireEvent.click(screen.getByRole("button", { name: "ساخت کاربر" }));

    expect(await screen.findByText("ایمیل را وارد کنید")).toBeInTheDocument();
    expect(screen.getByLabelText("ایمیل")).toHaveFocus();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
