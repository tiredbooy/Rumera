// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutPaymentStep } from "./checkout-payment-step";

const paymentProps = {
  payment: "wallet" as const,
  onPaymentChange: vi.fn(),
  couponCode: "",
  onCouponCodeChange: vi.fn(),
  onApplyCoupon: vi.fn(),
  couponPending: false,
  isGift: false,
  onGiftChange: vi.fn(),
  giftMessage: "",
  onGiftMessageChange: vi.fn(),
  giftOptionIds: [] as string[],
  onToggleGiftOption: vi.fn(),
  giftSettings: null,
  hidePrice: false,
  onHidePriceChange: vi.fn(),
  deliveryDate: "",
  onDeliveryDateChange: vi.fn(),
};

afterEach(cleanup);

describe("checkout payment step copy (PR-030d)", () => {
  it("says bank transfer is offline and waits for staff, without inventing an IBAN", () => {
    render(<CheckoutPaymentStep {...paymentProps} />);

    const bank = screen.getByRole("radio", { name: /کارت به کارت/ });
    expect(bank).toBeInTheDocument();
    expect(bank).toHaveAccessibleName(/بیرون از سایت/);
    expect(bank).toHaveAccessibleName(/در انتظار/);
    expect(bank).toHaveAccessibleName(/کارکنان/);
    expect(bank).toHaveAccessibleName(/شبا|حساب/);

    const markup = document.body.textContent ?? "";
    expect(markup).not.toMatch(/IR\d{2}/);
    expect(markup).not.toMatch(/\d{10,}/);
    expect(markup).not.toMatch(/پرداخت آنی|پرداخت فوری|همین حالا پرداخت/);
    expect(markup).not.toMatch(/تأیید شده است|تأیید شد|پرداخت‌شده است/);
  });

  it("uses the Jalali delivery date field when gift mode is on", () => {
    render(
      <CheckoutPaymentStep
        {...paymentProps}
        isGift
        giftSettings={{
          enabled: true,
          messageEnabled: true,
          messageMaxLength: 200,
          hidePriceEnabled: false,
          options: [],
        }}
      />,
    );

    expect(screen.getByLabelText(/تاریخ ترجیحی تحویل/)).toHaveAttribute(
      "placeholder",
      "۱۴۰۴/۰۵/۱۸ ۱۴:۳۰",
    );
    expect(document.querySelector("input[type='date']")).toBeNull();
  });

  it("does not describe wallet as an operator-wait rail", () => {
    render(<CheckoutPaymentStep {...paymentProps} />);

    const wallet = screen.getByRole("radio", { name: /کیف پول رومرا/ });
    expect(wallet).toBeInTheDocument();
    expect(wallet).not.toHaveAccessibleName(/در انتظار/);
    expect(wallet).not.toHaveAccessibleName(/کارکنان/);
    expect(wallet).not.toHaveAccessibleName(/بیرون از سایت/);
  });
});
