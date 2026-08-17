// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/lib/api/types";
import { faNum } from "@/lib/products";
import {
  ACCOUNT_ORDER_TAB_STATUSES,
  type AccountOrdersTabQuery,
} from "@/features/orders/hooks";
import type { OrderListItem, OrderStatus } from "@/features/orders/types";

const mocks = vi.hoisted(() => ({
  useOrdersTab: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/orders/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/features/orders/hooks")>(
    "@/features/orders/hooks",
  );
  return {
    ...actual,
    useOrdersTab: mocks.useOrdersTab,
  };
});

import { OrdersList } from "./OrdersList";

function order(
  id: number,
  status: OrderStatus,
  created_at = "2026-08-16T00:00:00Z",
): OrderListItem {
  return {
    id,
    status,
    payment_method: "wallet",
    total_amount: 100_000,
    item_count: 1,
    created_at,
  };
}

function pageOf(
  results: OrderListItem[],
  pagination: Partial<Paginated<OrderListItem>["pagination"]> = {},
): Paginated<OrderListItem> {
  return {
    results,
    pagination: {
      page: 1,
      limit: 20,
      total_items: results.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
      ...pagination,
    },
  };
}

function mockTab(
  overrides: {
    data?: Paginated<OrderListItem> | undefined;
    isLoading?: boolean;
    isError?: boolean;
    isFetching?: boolean;
    refetch?: () => void;
  } = {},
) {
  mocks.useOrdersTab.mockReturnValue({
    data: pageOf([]),
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

function lastQuery(): AccountOrdersTabQuery {
  return mocks.useOrdersTab.mock.calls.at(-1)?.[0] as AccountOrdersTabQuery;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mocks.useOrdersTab.mockReset();
  mockTab();
});

describe("OrdersList tabs", () => {
  it("asks GET /orders for the tab's statuses instead of client-filtering", () => {
    mockTab({
      data: pageOf([order(1, "pending"), order(2, "delivered")]),
    });

    render(<OrdersList />);

    expect(lastQuery()).toEqual({
      page: 1,
      statuses: ACCOUNT_ORDER_TAB_STATUSES.all,
    });
    expect(screen.getByText(`سفارش #${faNum(1)}`)).toBeInTheDocument();
    expect(screen.getByText(`سفارش #${faNum(2)}`)).toBeInTheDocument();

    cleanup();
    mockTab({
      data: pageOf([order(1, "pending"), order(2, "delivered")]),
    });
    render(<OrdersList initialTab="delivered" />);

    expect(lastQuery()).toEqual({
      page: 1,
      statuses: ACCOUNT_ORDER_TAB_STATUSES.delivered,
    });
    // Hook already scoped the page; the list must not drop leftover statuses.
    expect(screen.getByText(`سفارش #${faNum(1)}`)).toBeInTheDocument();
    expect(screen.getByText(`سفارش #${faNum(2)}`)).toBeInTheDocument();
  });

  it("requests every mapped status for a multi-status tab", () => {
    render(<OrdersList initialTab="processing" />);

    expect(lastQuery()).toEqual({
      page: 1,
      statuses: ACCOUNT_ORDER_TAB_STATUSES.processing,
    });
  });

  it("keeps page 2 on the same status filter", () => {
    mockTab({
      data: pageOf([order(40, "delivered")], {
        page: 1,
        total_items: 25,
        total_pages: 2,
        has_next: true,
        has_prev: false,
      }),
    });

    render(<OrdersList initialTab="delivered" />);
    fireEvent.click(screen.getByRole("button", { name: /بعدی/ }));

    expect(lastQuery()).toEqual({
      page: 2,
      statuses: ACCOUNT_ORDER_TAB_STATUSES.delivered,
    });
  });

  it("shows retry on error and does not use the empty-orders copy", () => {
    const refetch = vi.fn();
    mockTab({ data: undefined, isError: true, refetch });

    render(<OrdersList />);

    expect(screen.getByText("خطا در دریافت سفارش‌ها.")).toBeInTheDocument();
    expect(
      screen.queryByText("هنوز سفارشی ثبت نکرده‌اید"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("سفارشی در این وضعیت نیست"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("distinguishes an empty tab from an empty account", () => {
    render(<OrdersList />);
    expect(screen.getByText("هنوز سفارشی ثبت نکرده‌اید")).toBeInTheDocument();

    cleanup();
    mockTab();
    render(<OrdersList initialTab="delivered" />);
    expect(screen.getByText("سفارشی در این وضعیت نیست")).toBeInTheDocument();
    expect(
      screen.queryByText("هنوز سفارشی ثبت نکرده‌اید"),
    ).not.toBeInTheDocument();
  });
});
