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
  deactivate: vi.fn(),
  update: vi.fn(),
  ban: vi.fn(),
  unban: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/features/customers/client", () => {
  class AdminCustomerApiError extends Error {}
  return {
    AdminCustomerApiError,
    deactivateAdminUser: mocks.deactivate,
    updateAdminUser: mocks.update,
    banAdminUser: mocks.ban,
    unbanAdminUser: mocks.unban,
  };
});

import { UserAccountActions } from "./UserAccountActions";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deactivate.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue({ user_id: "user-2", is_active: true });
  mocks.ban.mockResolvedValue({ user_id: "user-2", is_banned: true });
  mocks.unban.mockResolvedValue({ user_id: "user-2", is_banned: false });
});

describe("UserAccountActions", () => {
  it("requires confirmation before issuing the soft-deactivate DELETE", async () => {
    render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive
        isBanned={false}
        isSelf={false}
        canWrite
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "غیرفعال‌کردن حساب" }));
    expect(mocks.deactivate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "غیرفعال‌کردن حساب" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تأیید غیرفعال‌سازی" }));

    await waitFor(() =>
      expect(mocks.deactivate).toHaveBeenCalledWith("user-2"),
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("reactivates an inactive account with the status PATCH", async () => {
    render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive={false}
        isBanned={false}
        isSelf={false}
        canWrite
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "فعال‌سازی دوباره" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith("user-2", {
        is_active: true,
      }),
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not expose role or status mutations for the signed-in admin", () => {
    render(
      <UserAccountActions
        userID="self"
        displayName="مدیر"
        isActive
        isBanned={false}
        isSelf
        canWrite
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(
      "نمی‌توانید نقش، وضعیت یا مسدودی حساب خودتان را تغییر دهید",
    );
    expect(
      screen.queryByRole("button", { name: "غیرفعال‌کردن حساب" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "فعال‌سازی دوباره" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "مسدود کردن حساب" }),
    ).not.toBeInTheDocument();
  });

  it("does not advertise reactivation for a banned account", () => {
    render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive
        isBanned
        isSelf={false}
        canWrite
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(
      "تغییر وضعیت فعال، مسدودی را برطرف نمی‌کند",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing without customers:write or customers:ban", () => {
    const { container } = render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive
        isBanned={false}
        isSelf={false}
        canWrite={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: "غیرفعال‌کردن حساب" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "فعال‌سازی دوباره" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "مسدود کردن حساب" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose ban from customers:write alone", () => {
    render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive
        isBanned={false}
        isSelf={false}
        canWrite
      />,
    );

    expect(
      screen.getByRole("button", { name: "غیرفعال‌کردن حساب" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "مسدود کردن حساب" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "رفع مسدودی" }),
    ).not.toBeInTheDocument();
  });

  it("requires confirmation before POSTing ban", async () => {
    render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive
        isBanned={false}
        isSelf={false}
        canWrite={false}
        canBan
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "مسدود کردن حساب" }));
    expect(mocks.ban).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "مسدود کردن حساب" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تأیید مسدودسازی" }));

    await waitFor(() => expect(mocks.ban).toHaveBeenCalledWith("user-2"));
    expect(mocks.unban).not.toHaveBeenCalled();
    expect(mocks.deactivate).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith("حساب کاربر مسدود شد.");
  });

  it("requires confirmation before POSTing unban", async () => {
    render(
      <UserAccountActions
        userID="user-2"
        displayName="مینا"
        isActive
        isBanned
        isSelf={false}
        canWrite={false}
        canBan
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "رفع مسدودی" }));
    expect(mocks.unban).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "رفع مسدودی حساب" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تأیید رفع مسدودی" }));

    await waitFor(() => expect(mocks.unban).toHaveBeenCalledWith("user-2"));
    expect(mocks.ban).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("hides self-ban even when the operator has customers:ban", () => {
    render(
      <UserAccountActions
        userID="self"
        displayName="مدیر"
        isActive
        isBanned={false}
        isSelf
        canWrite={false}
        canBan
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(
      "نمی‌توانید نقش، وضعیت یا مسدودی حساب خودتان را تغییر دهید",
    );
    expect(
      screen.queryByRole("button", { name: "مسدود کردن حساب" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "رفع مسدودی" }),
    ).not.toBeInTheDocument();
  });
});
