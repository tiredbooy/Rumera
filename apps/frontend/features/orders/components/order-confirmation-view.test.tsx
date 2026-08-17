import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Order, OrderStatus, PaymentMethod } from "@/features/orders/types";

const mocks = vi.hoisted(() => ({
  getAccountOrder: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
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

vi.mock("@/features/orders/api/account", () => ({
  getAccountOrder: mocks.getAccountOrder,
}));

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, _code?: string, message?: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { OrderConfirmationView } from "./order-confirmation-view";

function order(
  status: OrderStatus,
  paymentMethod: PaymentMethod = "wallet",
): Order {
  return {
    id: 42,
    status,
    payment_method: paymentMethod,
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
  };
}

async function renderConfirmation(
  status: OrderStatus,
  paymentMethod: PaymentMethod = "wallet",
) {
  mocks.getAccountOrder.mockResolvedValue(order(status, paymentMethod));
  return renderToStaticMarkup(await OrderConfirmationView({ id: "42" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrderConfirmationView", () => {
  it("does not claim a pending order is confirmed or paid", async () => {
    const markup = await renderConfirmation("pending");

    expect(markup).not.toContain("سفارش تأیید شد");
    expect(markup).not.toContain("سپاس از خرید شما");
    expect(markup).toContain("سفارش ثبت شد");
    expect(markup).toContain("در انتظار پرداخت");
  });

  it("does not imply a wallet pending order is already paid or debited", async () => {
    const markup = await renderConfirmation("pending", "wallet");

    expect(markup).not.toMatch(/paid/i);
    expect(markup).not.toMatch(/charged/i);
    expect(markup).not.toContain("تسویه");
    expect(markup).not.toContain("برداشت شد");
    expect(markup).not.toContain("پرداخت‌شده");
    expect(markup).toContain("هنوز پرداخت نشده است");
    expect(markup).toContain("انتخاب کیف پول به‌معنای انجام پرداخت نیست");
    expect(markup).toContain("اگر موجودی کافی نبوده");
  });

  it("does not celebrate a failed payment", async () => {
    const markup = await renderConfirmation("payment_failed");

    expect(markup).not.toContain("سفارش تأیید شد");
    expect(markup).not.toContain("سپاس از خرید شما");
    expect(markup).toContain("سفارش ثبت شد");
    expect(markup).toContain("پرداخت ناموفق");
    expect(markup).toContain("مبلغی برداشت نشده است");
  });

  it("treats wallet payment_failed as unsuccessful and not charged", async () => {
    const markup = await renderConfirmation("payment_failed", "wallet");

    expect(markup).not.toContain("سفارش تأیید شد");
    expect(markup).not.toContain("سپاس از خرید شما");
    expect(markup).not.toContain("برداشت شد");
    expect(markup).toContain("پرداخت از کیف پول انجام نشد");
    expect(markup).toContain("مبلغی برداشت نشده است");
    expect(markup).toContain("بازگردانده شده است");
  });

  it("keeps celebratory copy for paid-like orders", async () => {
    const markup = await renderConfirmation("paid");

    expect(markup).toContain("سفارش تأیید شد");
    expect(markup).toContain("سپاس از خرید شما");
  });

  it("may say the wallet was charged once the order is paid-like", async () => {
    const markup = await renderConfirmation("paid", "wallet");

    expect(markup).toContain("سفارش تأیید شد");
    expect(markup).toContain("مبلغ از کیف پول برداشت شد");
  });
});
