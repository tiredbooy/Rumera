// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAdminOrders: vi.fn(),
}));

vi.mock("@/features/admin/orders/hooks", () => ({
  useAdminOrders: mocks.useAdminOrders,
}));

import { OrdersTable } from "./OrdersTable";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OrdersTable failure state", () => {
  it("hides order rows and retries the failed query", () => {
    mocks.useAdminOrders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });

    render(<OrdersTable />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "خطا در دریافت سفارش‌ها",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
