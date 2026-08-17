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

import type { AdminUser } from "@/features/customers/types";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
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
  class AdminCustomerApiError extends Error {}
  return {
    AdminCustomerApiError,
    updateAdminUser: mocks.update,
  };
});

import { UserEditForm } from "./UserEditForm";

const user: AdminUser = {
  user_id: "user-2",
  first_name: "مینا",
  last_name: "رحیمی",
  email: "mina@example.com",
  phone: "09123456789",
  national_code: "1234567890",
  birth_date: "1995-02-03T00:00:00Z",
  gender: "female",
  role: "vendor",
  is_active: false,
  is_banned: false,
  created_at: "2026-07-20T08:00:00Z",
  updated_at: "2026-07-21T08:00:00Z",
};

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
  mocks.update.mockResolvedValue({
    ...user,
    first_name: undefined,
    phone: undefined,
    national_code: undefined,
    birth_date: undefined,
  });
});

describe("UserEditForm", () => {
  it("sends only dirty null clears without replaying stale access fields", async () => {
    render(<UserEditForm user={user} isSelf={false} />);
    fireEvent.change(screen.getByLabelText("نام"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("تلفن"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("کد ملی"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("تاریخ تولد"), {
      target: { value: "" },
    });
    fireEvent.blur(screen.getByLabelText("تاریخ تولد"));

    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith("user-2", {
      first_name: null,
      phone: null,
      national_code: null,
      birth_date: null,
    });
  });

  it("sends the status field only for an intentional reactivation", async () => {
    render(<UserEditForm user={user} isSelf={false} />);

    fireEvent.click(screen.getByLabelText("وضعیت فعال‌بودن حساب کاربر"));
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith("user-2", { is_active: true });
  });

  it("locks role and status and omits both fields from self-edits", async () => {
    render(<UserEditForm user={{ ...user, is_active: true }} isSelf />);

    expect(screen.getByLabelText("نقش کاربر")).toBeDisabled();
    expect(screen.getByLabelText("وضعیت فعال‌بودن حساب کاربر")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("نام"), {
      target: { value: "مینای جدید" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("role");
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("is_active");
  });

  it("locks editable controls while a save is in flight", async () => {
    let resolveUpdate: ((value: AdminUser) => void) | undefined;
    mocks.update.mockReturnValue(
      new Promise<AdminUser>((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    render(<UserEditForm user={user} isSelf={false} />);
    fireEvent.change(screen.getByLabelText("نام"), {
      target: { value: "مینای جدید" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("نام")).toBeDisabled();
    expect(screen.getByLabelText("نقش کاربر")).toBeDisabled();
    expect(screen.getByLabelText("وضعیت فعال‌بودن حساب کاربر")).toBeDisabled();

    await act(async () =>
      resolveUpdate?.({ ...user, first_name: "مینای جدید" }),
    );
  });
});
