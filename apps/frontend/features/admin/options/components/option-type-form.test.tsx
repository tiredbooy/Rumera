// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductOptionGroup } from "@/features/admin/products/types";

const mocks = vi.hoisted(() => ({
  createType: vi.fn(),
  updateType: vi.fn(),
  createValue: vi.fn(),
  deleteValue: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/options/api", () => ({
  OptionApiError: class OptionApiError extends Error {},
  useCreateOptionType: () => ({
    mutateAsync: mocks.createType,
    isPending: false,
  }),
  useUpdateOptionType: () => ({
    mutateAsync: mocks.updateType,
    isPending: false,
  }),
  useCreateOptionValue: () => ({
    mutateAsync: mocks.createValue,
    isPending: false,
  }),
  useDeleteOptionValue: () => ({
    mutateAsync: mocks.deleteValue,
    isPending: false,
  }),
}));

import { OptionTypeForm } from "./option-type-form";

const option: ProductOptionGroup = {
  id: 3,
  title: "volume",
  display_name: "حجم",
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  values: [
    {
      id: 7,
      option_type_id: 3,
      value: "۷۵۰ml",
      sort_order: 0,
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
    },
  ],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OptionTypeForm write gate", () => {
  it("does not submit when canWrite is false", () => {
    render(
      <OptionTypeForm mode="edit" option={option} canWrite={false} />,
    );

    expect(
      screen.getByText(/فقط مشاهده — ذخیره و حذف مقدار/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ذخیره" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /حذف ۷۵۰ml/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /افزودن مقدار/ }),
    ).not.toBeInTheDocument();

    fireEvent.submit(document.querySelector("form")!);

    expect(mocks.updateType).not.toHaveBeenCalled();
    expect(mocks.createType).not.toHaveBeenCalled();
    expect(mocks.createValue).not.toHaveBeenCalled();
    expect(mocks.deleteValue).not.toHaveBeenCalled();
  });

  it("names the option value and waits for confirm before deleting", async () => {
    mocks.deleteValue.mockResolvedValue(undefined);
    render(<OptionTypeForm mode="edit" option={option} canWrite />);

    fireEvent.click(screen.getByRole("button", { name: "حذف ۷۵۰ml" }));
    expect(mocks.deleteValue).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("حذف مقدار؟");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("۷۵۰ml");

    fireEvent.click(screen.getByRole("button", { name: "حذف مقدار" }));
    await waitFor(() => expect(mocks.deleteValue).toHaveBeenCalledWith(7));
  });

  it("stops warning about unsaved changes once the edit is saved", async () => {
    mocks.updateType.mockResolvedValue(undefined);
    render(<OptionTypeForm mode="edit" option={option} canWrite />);

    fireEvent.change(screen.getByLabelText("نام نمایشی (فارسی)"), {
      target: { value: "حجم بطری" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    await waitFor(() => expect(mocks.updateType).toHaveBeenCalled());

    // The form saves in place; the guard must not treat saved work as unsaved.
    fireEvent.click(screen.getByRole("link", { name: "بازگشت" }));
    expect(screen.queryByText("تغییرات ذخیره نشده‌اند")).toBeNull();
  });
});
