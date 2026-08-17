import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "../types";

const mocks = vi.hoisted(() => ({
  getAdminOrder: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));

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

vi.mock("@/features/orders/api/admin", () => ({
  getAdminOrder: mocks.getAdminOrder,
}));

vi.mock("./OrderActions", () => ({
  OrderActions: () => <div>عملیات سفارش</div>,
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

import { faDate } from "@/lib/utils/date";

import { OrderDetailView } from "./order-detail-view";

const BUYER_UUID = "11111111-1111-1111-1111-111111111111";

function baseOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: 1042,
    status: "paid",
    payment_method: "wallet",
    subtotal: 120_000,
    discount_amount: 0,
    shipping_cost: 15_000,
    tax_amount: 0,
    total_amount: 135_000,
    created_at: "2026-06-11T10:00:00Z",
    items: [
      {
        id: 5001,
        product_id: 88,
        variant_id: 211,
        product_title: "ویسکی آزمایشی",
        quantity: 2,
        unit_price: 60_000,
        total_price: 120_000,
      },
    ],
    ...overrides,
  };
}

async function renderDetail(order: AdminOrder) {
  mocks.getAdminOrder.mockResolvedValue(order);
  return renderToStaticMarkup(
    await OrderDetailView({ orderId: order.id, canWrite: true }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrderDetailView identity and ship-to", () => {
  it("renders buyer, ship-to, method, coupon, and payment from the GET projection", async () => {
    const markup = await renderDetail(
      baseOrder({
        payment_method: "gateway",
        user_id: 7,
        coupon_code: "WELCOME10",
        user: {
          id: 7,
          user_id: BUYER_UUID,
          first_name: "آدا",
          last_name: "لاولیس",
          email: "ada@example.com",
          phone: "09120000000",
        },
        ship_to: {
          full_name: "آدا لاولیس",
          phone_number: "09120000000",
          address_line1: "خیابان اصلی ۱",
          address_line2: "واحد ۲",
          city: "تهران",
          state_province: "تهران",
          postal_code: "12345",
          country: "IR",
        },
        shipping_method: { id: 3, name: "اکسپرس", carrier: "تیپاکس" },
        coupon: { id: 8, code: "WELCOME10" },
        payment: {
          id: 901,
          transaction_id: "abc123",
          status: "pending",
        },
      }),
    );

    expect(markup).toContain("خریدار");
    expect(markup).toContain("آدا لاولیس");
    expect(markup).toContain("ada@example.com");
    expect(markup).toContain("09120000000");
    expect(markup).toContain(`href="/admin/customers/${BUYER_UUID}"`);
    expect(markup).toContain("نشانی ارسال");
    expect(markup).toContain("خیابان اصلی ۱، واحد ۲");
    expect(markup).toContain("تهران");
    expect(markup).toContain("12345");
    expect(markup).toContain("اکسپرس · تیپاکس");
    expect(markup).toContain("WELCOME10");
    expect(markup).toContain("خلاصهٔ پرداخت");
    expect(markup).toContain("abc123");
    expect(markup).toContain('href="/admin/payments/901"');
    expect(markup).toContain("در انتظار");
    expect(markup).not.toContain("بازپرداخت");
  });

  it("falls back to address when ship_to is absent", async () => {
    const markup = await renderDetail(
      baseOrder({
        address: {
          full_name: "گیرنده از address",
          phone_number: "09350000000",
          address_line1: "بلوار آزادی",
          city: "اصفهان",
          state_province: "اصفهان",
          postal_code: "81456",
          country: "IR",
        },
      }),
    );

    expect(markup).toContain("گیرنده از address");
    expect(markup).toContain("بلوار آزادی");
    expect(markup).toContain("اصفهان");
    expect(markup).toContain("09350000000");
  });

  it("shows honest empties when identity, ship-to, method, coupon, and payment are missing", async () => {
    const markup = await renderDetail(baseOrder());

    expect(markup).toContain("خریدار");
    expect(markup).toContain("نشانی ارسال");
    expect(markup).toContain("خلاصهٔ پرداخت");
    expect(markup).toContain("تراکنش پرداختی ثبت نشده است");
    expect(markup.match(/ثبت نشده/g)?.length).toBeGreaterThanOrEqual(8);
    expect(markup).not.toContain("/admin/customers/");
    expect(markup).not.toContain("/admin/payments/");
    expect(markup).not.toContain("بازپرداخت");
    expect(markup).not.toContain("Ada Lovelace");
    expect(markup).not.toContain("خیابان");
  });

  it("does not invent a customer link from a numeric user id alone", async () => {
    const markup = await renderDetail(
      baseOrder({
        user_id: 7,
        user: { id: 7, email: "only-id@example.com" },
      }),
    );

    expect(markup).toContain("only-id@example.com");
    expect(markup).not.toContain('href="/admin/customers/');
    expect(markup).not.toContain('href="/admin/customers/7"');
  });

  it("does not add a refund control", async () => {
    const markup = await renderDetail(
      baseOrder({
        status: "paid",
        payment: { id: 3, transaction_id: "tx-3", status: "succeeded" },
      }),
    );

    expect(markup).not.toContain("بازپرداخت");
    expect(markup).not.toContain("refund");
    expect(markup).toContain("موفق");
  });
});

describe("OrderDetailView gift notes schedule", () => {
  it("renders gift, addons, notes, and scheduled delivery when present on the DTO", async () => {
    const scheduled = "2026-08-20T00:00:00Z";
    const markup = await renderDetail(
      baseOrder({
        is_gift: true,
        gift_message: "برای تو",
        gift_addons: [
          { id: "gift_wrap", label: "بسته‌بندی کادو", price: 25_000 },
          { id: "card", label: "کارت تبریک", price: 0 },
        ],
        notes: "Leave at the front desk",
        scheduled_delivery_date: scheduled,
      }),
    );

    expect(markup).toContain("هدیه و یادداشت");
    expect(markup).toContain("سفارش هدیه");
    expect(markup).toContain("بله");
    expect(markup).toContain("پیام هدیه");
    expect(markup).toContain("برای تو");
    expect(markup).toContain("بسته‌بندی و افزونه‌ها");
    expect(markup).toContain("بسته‌بندی کادو");
    expect(markup).toContain("کارت تبریک");
    expect(markup).toContain("رایگان");
    expect(markup).toContain("Leave at the front desk");
    expect(markup).toContain("تاریخ ترجیحی تحویل");
    expect(markup).toContain(faDate(scheduled));
  });

  it("omits the extras card when gift, notes, and schedule are absent", async () => {
    const markup = await renderDetail(baseOrder());

    expect(markup).not.toContain("هدیه و یادداشت");
    expect(markup).not.toContain("پیام هدیه");
    expect(markup).not.toContain("تاریخ ترجیحی تحویل");
    expect(markup).not.toContain("بسته‌بندی و افزونه‌ها");
    expect(markup).not.toContain("سفارش هدیه");
  });

  it("shows notes and schedule without inventing a gift flag", async () => {
    const scheduled = "2026-09-01T00:00:00Z";
    const markup = await renderDetail(
      baseOrder({
        notes: "زنگ نزنید",
        scheduled_delivery_date: scheduled,
      }),
    );

    expect(markup).toContain("هدیه و یادداشت");
    expect(markup).toContain("زنگ نزنید");
    expect(markup).toContain("تاریخ ترجیحی تحویل");
    expect(markup).toContain(faDate(scheduled));
    expect(markup).not.toContain("سفارش هدیه");
    expect(markup).not.toContain("پیام هدیه");
    expect(markup).not.toContain("بسته‌بندی و افزونه‌ها");
  });
});

describe("OrderDetailView money and timeline", () => {
  it("puts money, items, and timeline before the address cards", async () => {
    const markup = await renderDetail(
      baseOrder({
        paid_at: "2026-06-11T10:05:00Z",
        shipped_at: "2026-06-12T08:00:00Z",
      }),
    );

    const money = markup.indexOf("مبلغ نهایی");
    const timeline = markup.indexOf("روند سفارش");
    const items = markup.indexOf("ویسکی آزمایشی");
    const address = markup.indexOf("نشانی ارسال");
    expect(money).toBeGreaterThan(-1);
    expect(timeline).toBeGreaterThan(-1);
    expect(items).toBeGreaterThan(-1);
    expect(address).toBeGreaterThan(-1);
    expect(money).toBeLessThan(address);
    expect(timeline).toBeLessThan(address);
    expect(items).toBeLessThan(address);
    expect(markup).toContain("پرداخت‌شده");
    expect(markup).toContain("ارسال‌شده");
  });

  it("shows the order amount and paid-at on the payment card", async () => {
    const paidAt = "2026-06-11T10:05:00Z";
    const markup = await renderDetail(
      baseOrder({
        total_amount: 135_000,
        paid_at: paidAt,
        payment: { id: 901, transaction_id: "abc123", status: "succeeded" },
      }),
    );

    expect(markup).toContain("خلاصهٔ پرداخت");
    expect(markup).toContain("تاریخ پرداخت");
    expect(markup).toContain(faDate(paidAt));
    expect(markup).toContain("مبلغ");
  });
});
