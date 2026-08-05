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

vi.mock("@/features/admin/analytics/components/DataTable", () => ({
  DataTable: ({
    rows,
    columns,
  }: {
    rows: Array<{ id: number; title: string }>;
    columns: Array<{
      id: string;
      cell: (row: { id: number; title: string }) => unknown;
    }>;
  }) => {
    const actions = columns.find((c) => c.id === "actions");
    return (
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <span>{row.title}</span>
            {actions?.cell(row) as never}
          </li>
        ))}
      </ul>
    );
  },
}));

import { ProductsTable } from "./ProductsTable";

const product = {
  id: 12,
  title: "ویسکی تست",
  brand: "Test",
  min_price: "1000",
  max_price: "1000",
  is_active: true,
  slug: "test-whisky",
} as never;

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteProduct.mockResolvedValue({ ok: true });
});

describe("ProductsTable", () => {
  it("does not offer a sample duplicate control", () => {
    render(<ProductsTable products={[product]} canWrite />);
    expect(screen.queryByText("تکثیر")).not.toBeInTheDocument();
    expect(screen.getByText("حذف")).toBeInTheDocument();
  });

  it("requires confirmation and calls the real delete action", async () => {
    render(<ProductsTable products={[product]} canWrite />);
    fireEvent.click(screen.getByText("حذف"));

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
    fireEvent.click(screen.getByText("حذف"));
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
