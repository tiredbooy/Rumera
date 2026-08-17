// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/catalog/categories/types";

const mocks = vi.hoisted(() => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/categories/client", () => ({
  CategoryApiError: class CategoryApiError extends Error {},
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
}));

vi.mock("./category-image-input", () => ({
  CategoryImageInput: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (url: string) => void;
    disabled?: boolean;
  }) => (
    <input
      aria-label="تصویر دسته‌بندی"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import { CategoryForm } from "./CategoryForm";

const category: Category = {
  id: 11,
  title: "ویسکی",
  slug: "whisky",
  is_featured: false,
  display_order: 0,
};

function renderForm(canWrite: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CategoryForm
        mode="edit"
        category={category}
        tree={[]}
        submitLabel="ذخیرهٔ تغییرات"
        canWrite={canWrite}
      />
    </QueryClientProvider>,
  );
}

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
});

describe("CategoryForm write gate", () => {
  it("does not submit when canWrite is false", () => {
    renderForm(false);

    expect(
      screen.getByText(/فقط مشاهده — ذخیره و بارگذاری تصویر/),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("category-submit"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("category-title"), {
      target: { value: "ویسکی اصلاح‌شده" },
    });
    fireEvent.submit(document.querySelector("form")!);

    expect(mocks.updateCategory).not.toHaveBeenCalled();
    expect(mocks.createCategory).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("keeps the save action when the operator can write", () => {
    renderForm(true);

    expect(
      screen.queryByText(/فقط مشاهده — ذخیره و بارگذاری تصویر/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("category-submit")).toBeInTheDocument();
  });
});
