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
  deleteProduct: vi.fn(),
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

vi.mock("@/features/admin/products/actions/product", () => ({
  deleteProduct: mocks.deleteProduct,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  DropdownMenuTrigger: ({ children }: { children: unknown }) => (
    <div>{children as never}</div>
  ),
  DropdownMenuContent: ({ children }: { children: unknown }) => (
    <div>{children as never}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: unknown;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children as never}
    </button>
  ),
  DropdownMenuSeparator: () => null,
}));

import type { ProductListItem } from "@/features/catalog/products/types";

import { ProductsTable } from "./ProductsTable";

const product: ProductListItem = {
  id: 12,
  title: "ویسکی تست",
  brand: "Test",
  min_price: 1000,
  max_price: 1000,
  is_active: true,
  slug: "test-whisky",
  weight: 1,
  image_response: null,
  active_variant_count: 1,
  available_variant_count: 1,
  available_stock: 0,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteProduct.mockResolvedValue({ ok: true });
});

describe("ProductsTable", () => {
  it("offers a duplicate control that seeds the create form", () => {
    render(<ProductsTable products={[product]} canWrite />);
    const duplicates = screen.getAllByRole("link", { name: /تکثیر/ });
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0]).toHaveAttribute(
      "href",
      "/admin/products/new?from=12",
    );
  });

  it("renders the thumbnail, stock and variant count already on the payload", () => {
    render(
      <ProductsTable
        products={[
          {
            ...product,
            available_stock: 24,
            active_variant_count: 3,
            image_response: {
              id: 1,
              image_url: "/media/whisky.jpg",
              sort_order: 0,
              is_primary: true,
            },
          },
        ]}
        canWrite
      />,
    );

    expect(
      document.querySelectorAll('img[src="/media/whisky.jpg"]').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("۲۴").length).toBeGreaterThan(0);
    expect(screen.getAllByText("۳ تنوع").length).toBeGreaterThan(0);
  });

  it("does not present client search as the catalogue", () => {
    render(<ProductsTable products={[product]} canWrite />);
    expect(
      screen.queryByPlaceholderText("جستجوی محصول یا برند…"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("وزن ارسال")).not.toBeInTheDocument();
  });

  it("scopes the missing-weight banner to the current page", () => {
    render(
      <ProductsTable
        products={[{ ...product, weight: undefined }]}
        canWrite
      />,
    );
    expect(
      screen.getByRole("status"),
    ).toHaveTextContent("در این صفحه");
    expect(screen.getByRole("status")).toHaveTextContent(
      "فقط ردیف‌های همین صفحه",
    );
  });

  it("hides delete and duplicate without PRODUCTS_WRITE", () => {
    render(<ProductsTable products={[product]} canWrite={false} />);
    expect(screen.queryByText("حذف")).not.toBeInTheDocument();
    expect(screen.queryByText("تکثیر")).not.toBeInTheDocument();
    expect(screen.getAllByText("ویرایش").length).toBeGreaterThan(0);
  });

  it("requires confirmation and calls the real delete action", async () => {
    render(<ProductsTable products={[product]} canWrite />);
    fireEvent.click(screen.getAllByText("حذف")[0]!);

    expect(mocks.deleteProduct).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "حذف محصول" }));

    await waitFor(() =>
      expect(mocks.deleteProduct).toHaveBeenCalledWith(12),
    );
    expect(mocks.success).toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("surfaces delete failures without closing the dialog", async () => {
    mocks.deleteProduct.mockResolvedValue({
      ok: false,
      message: "اجازهٔ حذف این محصول را ندارید.",
    });

    render(<ProductsTable products={[product]} canWrite />);
    fireEvent.click(screen.getAllByText("حذف")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "حذف محصول" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "اجازهٔ حذف این محصول را ندارید.",
      ),
    );
    expect(mocks.error).toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
