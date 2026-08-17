// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Order, OrderStatus, PaymentMethod } from "@/features/orders/types";

const mocks = vi.hoisted(() => ({
  useOrder: vi.fn(),
  useCancelOrder: vi.fn(),
  usePayOrder: vi.fn(),
  cancelMutate: vi.fn(),
  payMutate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
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

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

vi.mock("@/features/cart/api", () => ({
  useBulkAddCartItems: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/orders/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/features/orders/hooks")>(
    "@/features/orders/hooks",
  );
  return {
    ...actual,
    useOrder: mocks.useOrder,
    useCancelOrder: mocks.useCancelOrder,
    usePayOrder: mocks.usePayOrder,
  };
});

import { OrderDetail } from "./OrderDetail";

function order(
  overrides: Partial<Order> & {
    status?: OrderStatus;
    payment_method?: PaymentMethod;
  } = {},
): Order {
  return {
    id: 42,
    status: "pending",
    payment_method: "gateway",
    subtotal: 100_000,
    discount_amount: 0,
    shipping_cost: 0,
    tax_amount: 0,
    total_amount: 100_000,
    created_at: "2026-08-16T00:00:00Z",
    items: [
      {
        id: 1,
        product_id: 9,
        variant_id: 9,
        product_title: "ویسکی آزمایشی",
        quantity: 1,
        unit_price: 100_000,
        total_price: 100_000,
      },
    ],
    ...overrides,
  };
}

function stubOrder(data: Order) {
  mocks.useOrder.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mocks.useOrder.mockReset();
  mocks.useCancelOrder.mockReset();
  mocks.usePayOrder.mockReset();
  mocks.cancelMutate.mockReset();
  mocks.payMutate.mockReset();
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.message.mockReset();
  mocks.useCancelOrder.mockReturnValue({
    mutate: mocks.cancelMutate,
    isPending: false,
  });
  mocks.usePayOrder.mockReturnValue({
    mutate: mocks.payMutate,
    isPending: false,
  });
});

describe("OrderDetail cancel confirm + pay CTA (PR-033b)", () => {
  it("does not cancel until the confirm dialog is accepted", () => {
    stubOrder(order({ status: "pending" }));
    render(<OrderDetail id={42} />);

    fireEvent.click(screen.getByTestId("order-cancel-trigger"));
    expect(mocks.cancelMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("لغو سفارش؟")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(mocks.cancelMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("order-cancel-trigger"));
    fireEvent.click(screen.getByTestId("order-cancel-confirm"));
    expect(mocks.cancelMutate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows پرداخت مجدد and POSTs /pay for payment_failed gateway orders", () => {
    stubOrder(order({ status: "payment_failed", payment_method: "card" }));
    render(<OrderDetail id={42} />);

    fireEvent.click(screen.getByRole("button", { name: /پرداخت مجدد/ }));
    expect(mocks.payMutate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("redirects only when POST /pay returns a non-empty payment_url", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    stubOrder(order({ status: "pending", payment_method: "gateway" }));
    mocks.payMutate.mockImplementation((_id, opts) => {
      opts?.onSuccess?.(
        order({
          payment_url: "https://pay.example.com/start?transaction_id=abc",
        }),
      );
    });
    render(<OrderDetail id={42} />);

    fireEvent.click(screen.getByTestId("order-pay-cta"));
    expect(assign).toHaveBeenCalledWith(
      "https://pay.example.com/start?transaction_id=abc",
    );
    vi.unstubAllGlobals();
  });

  it("does not invent a pay URL when the API omits payment_url", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    stubOrder(order({ status: "pending", payment_method: "bank_transfer" }));
    mocks.payMutate.mockImplementation((_id, opts) => {
      opts?.onSuccess?.(
        order({
          payment_method: "bank_transfer",
          transaction_id: "tx-offline",
          payment_url: "   ",
        }),
      );
    });
    render(<OrderDetail id={42} />);

    fireEvent.click(screen.getByRole("button", { name: /ادامه پرداخت/ }));
    expect(assign).not.toHaveBeenCalled();
    expect(mocks.toast.message).toHaveBeenCalledWith(
      "لینک درگاه برنگشت",
      expect.objectContaining({
        description: expect.stringMatching(/لینکی ساخته نشد/),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("hides the pay CTA on wallet unpaid orders and does not POST /pay", () => {
    stubOrder(order({ status: "pending", payment_method: "wallet" }));
    render(<OrderDetail id={42} />);

    expect(screen.queryByTestId("order-pay-cta")).not.toBeInTheDocument();
    expect(screen.getByTestId("order-wallet-pay-note")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /پرداخت مجدد/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ادامه پرداخت/ })).not.toBeInTheDocument();
  });

  it("hides pay and cancel on paid-like orders", () => {
    stubOrder(order({ status: "paid", payment_method: "gateway" }));
    render(<OrderDetail id={42} />);

    expect(screen.queryByTestId("order-pay-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-cancel-trigger")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /سفارش مجدد/ })).toBeInTheDocument();
  });
});
