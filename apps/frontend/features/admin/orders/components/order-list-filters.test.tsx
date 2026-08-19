// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

import { OrderListFilters } from "./order-list-filters";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
});

describe("OrderListFilters", () => {
  it("does not ask the operator to type a Gregorian native date", () => {
    const { container } = render(
      <OrderListFilters
        filters={{ page: 1, paidFrom: "2026-08-01", paidTo: "2026-08-09" }}
      />,
    );

    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByLabelText("از تاریخ پرداخت")).toHaveValue("1405/05/10");
    expect(screen.getByLabelText("تا تاریخ پرداخت")).toHaveValue("1405/05/18");
  });

  it("does not name an HTTP endpoint on the filter bar", () => {
    render(<OrderListFilters filters={{ page: 1 }} />);
    expect(screen.queryByText(/GET \/admin\/orders/)).not.toBeInTheDocument();
    expect(screen.getByText("همهٔ وضعیت‌ها")).toBeInTheDocument();
  });

  it("toggles a status in place — no apply button, no history entry", () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams("page=3"));
    render(<OrderListFilters filters={{ page: 3 }} />);

    expect(
      screen.queryByRole("button", { name: "اعمال فیلترها" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("وضعیت"), {
      target: { value: "shipped" },
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?status=shipped");
  });

  it("gives the deep-linked customer filter a chip of its own to leave by", () => {
    const uuid = "5b1483a7-d6e3-4804-9588-4c8a2ee60676";
    mocks.searchParams.mockReturnValue(
      new URLSearchParams(`status=paid&user_uuid=${uuid}`),
    );
    render(
      <OrderListFilters
        filters={{ page: 1, status: "paid", userUuid: uuid }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "حذف فیلتر فقط سفارش‌های این مشتری" }),
    );

    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?status=paid");
  });
});
