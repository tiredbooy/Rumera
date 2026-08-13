// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAddressMutate: vi.fn(),
}));

vi.mock("@/features/addresses/api", () => ({
  useCreateAddress: () => ({
    isPending: false,
    mutate: mocks.createAddressMutate,
  }),
}));

import { AddAddressForm } from "./add-address-form";
import { CheckoutPaymentStep } from "./checkout-payment-step";

type MutationCallbacks = {
  onError?: (error: unknown) => void;
};

const paymentProps = {
  payment: "wallet" as const,
  onPaymentChange: vi.fn(),
  couponCode: "SAVE",
  onCouponCodeChange: vi.fn(),
  onApplyCoupon: vi.fn(),
  couponPending: false,
  couponError: "کد تخفیف معتبر نیست.",
  isGift: false,
  onGiftChange: vi.fn(),
  giftMessage: "",
  onGiftMessageChange: vi.fn(),
  giftOptionIds: [] as string[],
  onToggleGiftOption: vi.fn(),
  giftSettings: null,
  hidePrice: true,
  onHidePriceChange: vi.fn(),
  deliveryDate: "",
  onDeliveryDateChange: vi.fn(),
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkout forms", () => {
  it("exposes payment choices as one named radio group", () => {
    render(<CheckoutPaymentStep {...paymentProps} />);

    expect(screen.getByRole("group", { name: "روش پرداخت" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAttribute("name", "checkout-payment");
    expect(radios[0]).toBeChecked();

    fireEvent.click(radios[1]);
    expect(paymentProps.onPaymentChange).toHaveBeenCalledWith("bank_transfer");
  });

  it("connects coupon feedback to the coupon control", () => {
    render(<CheckoutPaymentStep {...paymentProps} />);

    const coupon = screen.getByLabelText("کد تخفیف");
    expect(coupon).toHaveAttribute("aria-invalid", "true");
    expect(coupon).toHaveAttribute("aria-describedby", "coupon-error");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "coupon-error");
  });

  it("focuses and describes the first address control after a server error", () => {
    mocks.createAddressMutate.mockImplementation(
      (_input: unknown, callbacks?: MutationCallbacks) =>
        callbacks?.onError?.(new Error("failed")),
    );
    render(<AddAddressForm onCreated={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "ذخیرهٔ آدرس" });
    fireEvent.submit(submit.closest("form")!);

    const firstControl = screen.getByLabelText("نام و نام خانوادگی");
    expect(firstControl).toHaveFocus();
    expect(firstControl).toHaveAttribute(
      "aria-describedby",
      "checkout-address-error",
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "checkout-address-error",
    );
  });
});
