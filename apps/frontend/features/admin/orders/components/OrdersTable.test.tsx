// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { faNum } from "@/lib/products";
import type { OrderListItem } from "@/features/orders/types";

import { toAdminOrderListQuery } from "../order-list-params";
import { OrdersTable } from "./OrdersTable";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAdminOrders: vi.fn(),
}));

vi.mock("@/features/admin/orders/hooks", () => ({
  useAdminOrders: mocks.useAdminOrders,
}));

function order(
  id: number,
  status: OrderListItem["status"] = "pending",
): OrderListItem {
  return {
    id,
    status,
    payment_method: "wallet",
    total_amount: 1000,
    item_count: 1,
    created_at: "2026-08-16T10:00:00Z",
  };
}

function lastQuery() {
  return mocks.useAdminOrders.mock.calls.at(-1)?.[0];
}

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

    render(<OrdersTable filters={{ page: 1 }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "خطا در دریافت سفارش‌ها",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toEqual(toAdminOrderListQuery({ page: 1 }));
  });
});

describe("OrdersTable server filters", () => {
  it("asks GET /admin/orders for status, dates, and user instead of client-filtering", () => {
    mocks.useAdminOrders.mockReturnValue({
      data: {
        results: [order(1, "paid"), order(2, "pending")],
        pagination: {
          page: 1,
          limit: 50,
          total_items: 2,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });

    const filters = {
      page: 1,
      status: "paid" as const,
      userId: 7,
      paidFrom: "2026-08-01",
      paidTo: "2026-08-16",
    };
    render(<OrdersTable filters={filters} />);

    expect(lastQuery()).toEqual(toAdminOrderListQuery(filters));
    const form = screen.getByRole("form", { name: "فیلتر سفارش‌ها" });
    expect(form).toHaveAttribute("action", "/admin/orders");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByLabelText("وضعیت")).toHaveValue("paid");
    // The visible box shows Jalali; the submitted value is the hidden ISO input.
    expect(form.querySelector('input[name="paid_from"]')).toHaveValue(
      "2026-08-01",
    );
    expect(form.querySelector('input[name="paid_to"]')).toHaveValue(
      "2026-08-16",
    );
    expect(screen.getByLabelText("شناسهٔ داخلی کاربر")).toHaveValue("7");
    // Hook already scoped the request; leftover statuses on the page stay visible.
    expect(screen.getByText(`#${faNum(1)}`)).toBeInTheDocument();
    expect(screen.getByText(`#${faNum(2)}`)).toBeInTheDocument();
  });

  it("keeps page 2 on the same server filters", () => {
    mocks.useAdminOrders.mockReturnValue({
      data: {
        results: [order(40, "delivered")],
        pagination: {
          page: 1,
          limit: 50,
          total_items: 51,
          total_pages: 2,
          has_next: true,
          has_prev: false,
        },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });

    render(
      <OrdersTable
        filters={{ page: 1, status: "delivered", userId: 4 }}
      />,
    );

    const next = screen.getByRole("link", { name: /بعدی/ });
    expect(next).toHaveAttribute(
      "href",
      "/admin/orders?status=delivered&user_id=4&page=2",
    );
  });

  it("splits empty catalogue from a filtered miss", () => {
    mocks.useAdminOrders.mockReturnValue({
      data: {
        results: [],
        pagination: {
          page: 1,
          limit: 50,
          total_items: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });

    const { rerender } = render(<OrdersTable filters={{ page: 1 }} />);
    expect(screen.getByText("هنوز سفارشی ثبت نشده است")).toBeInTheDocument();

    rerender(<OrdersTable filters={{ page: 1, status: "refunded" }} />);
    expect(
      screen.getByText("سفارشی با این فیلترها یافت نشد"),
    ).toBeInTheDocument();
    expect(lastQuery()).toEqual(
      toAdminOrderListQuery({ page: 1, status: "refunded" }),
    );
  });
});

// CF-1. The list carried no buyer at all, so triaging a morning meant opening
// every order to find out who placed it.
describe("orders table buyer column", () => {
  function withBuyer(buyer: OrderListItem["buyer"]): OrderListItem {
    return { ...order(1), buyer };
  }

  function renderRows(items: OrderListItem[]) {
    mocks.useAdminOrders.mockReturnValue({
      data: { results: items, pagination: { total_pages: 1, total_items: items.length } },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });
    render(<OrdersTable filters={{ page: 1 }} />);
  }

  it("shows the buyer and links to the customer page", () => {
    renderRows([
      withBuyer({
        id: 7,
        user_id: "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        first_name: "علی",
        last_name: "رضایی",
        phone: "09120000000",
      }),
    ]);

    expect(screen.getByText("علی رضایی")).toBeInTheDocument();
    expect(screen.getByTestId("order-buyer-link")).toHaveAttribute(
      "href",
      "/admin/customers/b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    );
    // The phone is what an operator reads back on an inbound call.
    expect(screen.getByText("09120000000")).toBeInTheDocument();
  });

  it("falls back to the email when the customer has no name", () => {
    // first_name/last_name are both nullable in the schema.
    renderRows([
      withBuyer({
        id: 7,
        user_id: "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        email: "nameless@example.com",
      }),
    ]);

    expect(screen.getByText("nameless@example.com")).toBeInTheDocument();
  });

  it("never invents a customer link from the internal id alone", () => {
    renderRows([withBuyer({ id: 7, first_name: "علی" })]);

    expect(screen.getByText("علی")).toBeInTheDocument();
    expect(screen.queryByTestId("order-buyer-link")).not.toBeInTheDocument();
  });

  it("degrades to a dash when the row carries no buyer", () => {
    renderRows([order(1)]);

    expect(screen.queryByTestId("order-buyer-link")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
