// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Address } from "@/features/addresses/types";
import type { Cart } from "@/features/cart/types";
import type { CouponValidation } from "@/features/coupons/types";
import type { Order, OrderStatus, PaymentMethod } from "@/features/orders/types";
import type { ShippingMethod } from "@/features/shipping/types";
import { ApiClientError } from "@/lib/api/store-client";

const mocks = vi.hoisted(() => ({
  couponMutate: vi.fn(),
  createAddressMutate: vi.fn(),
  placeOrderMutate: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useAddresses: vi.fn(),
  useCart: vi.fn(),
  useCreateAddress: vi.fn(),
  usePlaceOrder: vi.fn(),
  useShippingMethods: vi.fn(),
  useValidateCoupon: vi.fn(),
  useWallet: vi.fn(),
  recordInteractionClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/features/addresses/api", () => ({
  useAddresses: () => mocks.useAddresses(),
  useCreateAddress: () => mocks.useCreateAddress(),
}));

vi.mock("@/features/cart/api", () => ({
  useCart: () => mocks.useCart(),
}));

vi.mock("@/features/coupons/api", () => ({
  useValidateCoupon: () => mocks.useValidateCoupon(),
}));

vi.mock("@/features/orders/hooks", () => ({
  usePlaceOrder: () => mocks.usePlaceOrder(),
}));

vi.mock("@/features/shipping/api", () => ({
  useShippingMethods: (...args: unknown[]) => mocks.useShippingMethods(...args),
}));

vi.mock("@/features/settings/hooks", () => ({
  usePublicGiftSettings: () => ({
    data: null,
    isPending: false,
    isError: false,
    isFetching: false,
  }),
}));

// U-1: checkout reads the wallet balance to warn about a shortfall before submit.
vi.mock("@/features/wallet/hooks", () => ({
  useWallet: () => mocks.useWallet(),
}));

vi.mock("@/features/recommendations/client", () => ({
  recordInteractionClient: (...args: unknown[]) =>
    mocks.recordInteractionClient(...args),
}));

import { CheckoutFlow } from "./checkout-flow";

const addresses: Address[] = [
  {
    id: 1,
    full_name: "گیرنده اول",
    address_line1: "خیابان اول",
    city: "تهران",
    postal_code: "1111111111",
    country: "IR",
    is_default: false,
  },
  {
    id: 2,
    full_name: "گیرنده پیش‌فرض",
    address_line1: "خیابان دوم",
    city: "تهران",
    postal_code: "2222222222",
    country: "IR",
    is_default: true,
  },
];

const shippingMethods: ShippingMethod[] = [
  {
    id: 10,
    name: "ارسال استاندارد",
    rate_type: "flat_rate",
    base_rate: 50,
    is_active: true,
    estimated_cost: 50,
  },
];

const cart: Cart = {
  id: 1,
  items: [
    {
      id: 1,
      product_id: 1,
      product_title: "محصول آزمایشی",
      variant_id: 11,
      current_price: 1_000,
      price_changed: false,
      quantity: 1,
      line_total: 1_000,
    },
  ],
  summary: {
    total_items: 1,
    unique_items: 1,
    subtotal: 1_000,
    discount_total: 0,
  },
};

const validCoupon = {
  coupon: {
    id: 1,
    code: "SAVE",
    discount_type: "free_shipping",
    discount_value: 0,
    min_order_amount: 0,
    max_uses_per_user: 1,
    is_active: true,
    starts_at: "2026-01-01T00:00:00Z",
    total_uses: 0,
    is_exhausted: false,
  },
  discount_amount: 100,
  free_shipping: true,
  is_valid: true,
} as CouponValidation;

type CouponCallbacks = {
  onSuccess?: (result: CouponValidation) => void;
  onError?: (error: unknown) => void;
};

type OrderCallbacks = {
  onSuccess?: (order: Order) => void;
  onError?: (error: unknown) => void;
};

function placedOrder(
  status: OrderStatus,
  payment_method: PaymentMethod = "wallet",
): Order {
  return {
    id: 42,
    status,
    payment_method,
    subtotal: 1_000,
    discount_amount: 0,
    shipping_cost: 50,
    tax_amount: 0,
    total_amount: 1_050,
    created_at: "2026-01-01T00:00:00Z",
    items: [
      {
        id: 1,
        product_id: 1,
        variant_id: 11,
        product_title: "محصول آزمایشی",
        quantity: 1,
        unit_price: 1_000,
        total_price: 1_000,
      },
    ],
  };
}

function successfulQuery<T>(data: T) {
  return {
    data,
    isPending: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}

function goToPayment() {
  fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
  fireEvent.click(screen.getByRole("radio", { name: /ارسال استاندارد/ }));
  fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
}

function goToReviewAndSubmit() {
  goToPayment();
  fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
  fireEvent.click(screen.getAllByRole("button", { name: /ثبت و پرداخت/ })[0]);
}

function fillAddressForm() {
  fireEvent.change(screen.getByLabelText("نام و نام خانوادگی"), {
    target: { value: "گیرنده جدید" },
  });
  fireEvent.change(screen.getByLabelText("نشانی"), {
    target: { value: "خیابان سوم" },
  });
  fireEvent.change(screen.getByLabelText("استان"), {
    target: { value: "تهران" },
  });
  fireEvent.change(screen.getByLabelText("شهر"), {
    target: { value: "تهران" },
  });
  fireEvent.change(screen.getByLabelText("کد پستی"), {
    target: { value: "3333333333" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ آدرس" }));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCart.mockReturnValue(successfulQuery(cart));
  mocks.useAddresses.mockReturnValue(successfulQuery(addresses));
  mocks.useShippingMethods.mockReturnValue(successfulQuery(shippingMethods));
  // Default: balance unknown, so the shortfall warning stays out of the way of
  // every test that is not about it.
  mocks.useWallet.mockReturnValue(successfulQuery(undefined));
  mocks.useValidateCoupon.mockReturnValue({
    isPending: false,
    mutate: mocks.couponMutate,
  });
  mocks.usePlaceOrder.mockReturnValue({
    isPending: false,
    mutate: mocks.placeOrderMutate,
  });
  mocks.useCreateAddress.mockReturnValue({
    isPending: false,
    mutate: mocks.createAddressMutate,
  });
  mocks.recordInteractionClient.mockResolvedValue(undefined);
});

describe("checkout state logic", () => {
  it("quotes shipping with country when the address province is a display name", () => {
    mocks.useAddresses.mockReturnValue(
      successfulQuery([{ ...addresses[1], state_province: "تهران" }]),
    );
    render(<CheckoutFlow />);

    expect(mocks.useShippingMethods).toHaveBeenCalledWith(
      "IR",
      0,
      cart.summary.subtotal,
      true,
    );
  });

  it("quotes shipping with the province when it is an IR- region code", () => {
    mocks.useAddresses.mockReturnValue(
      successfulQuery([{ ...addresses[1], state_province: "ir-teh" }]),
    );
    render(<CheckoutFlow />);

    expect(mocks.useShippingMethods).toHaveBeenCalledWith(
      "IR-TEH",
      0,
      cart.summary.subtotal,
      true,
    );
  });

  it("derives the initial selection from the default address without a render update", () => {
    render(<CheckoutFlow />);

    expect(
      screen.getByRole("radio", { name: /گیرنده پیش‌فرض/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /گیرنده اول/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("group", { name: "انتخاب آدرس تحویل" }),
    ).toBeInTheDocument();
  });

  it("exposes address and shipping choices as named radio groups", () => {
    render(<CheckoutFlow />);

    expect(
      screen.getByRole("group", { name: "انتخاب آدرس تحویل" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));

    expect(
      screen.getByRole("group", { name: "انتخاب روش ارسال" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /ارسال استاندارد/ }),
    ).not.toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /ارسال استاندارد/ }));
    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));

    expect(
      screen.getByRole("group", { name: "روش پرداخت" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /کیف پول رومرا/ }),
    ).toBeChecked();
  });

  // U-1. Wallet is the preselected method, so an empty wallet used to be
  // discovered only as a 409 at submit, after the whole checkout was filled in.
  function reachPaymentStep() {
    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
    fireEvent.click(screen.getByRole("radio", { name: /ارسال استاندارد/ }));
    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
  }

  it("warns before submit when the wallet cannot cover the order", () => {
    mocks.useWallet.mockReturnValue(successfulQuery({ balance: "1000" }));
    render(<CheckoutFlow />);
    reachPaymentStep();

    expect(screen.getByTestId("checkout-wallet-balance")).toBeInTheDocument();
    expect(screen.getByTestId("checkout-wallet-shortfall")).toBeInTheDocument();
    expect(screen.getByTestId("checkout-wallet-topup-cta")).toHaveAttribute(
      "href",
      "/account/wallet",
    );
  });

  it("shows the balance without a shortfall warning when the wallet covers it", () => {
    mocks.useWallet.mockReturnValue(
      successfulQuery({ balance: "999999999" }),
    );
    render(<CheckoutFlow />);
    reachPaymentStep();

    expect(screen.getByTestId("checkout-wallet-balance")).toBeInTheDocument();
    expect(
      screen.queryByTestId("checkout-wallet-shortfall"),
    ).not.toBeInTheDocument();
  });

  it("says nothing about the wallet when the balance is unknown", () => {
    // Guest, or the wallet request failed. Never guess a shortfall.
    mocks.useWallet.mockReturnValue(successfulQuery(undefined));
    render(<CheckoutFlow />);
    reachPaymentStep();

    expect(
      screen.queryByTestId("checkout-wallet-balance"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("checkout-wallet-shortfall"),
    ).not.toBeInTheDocument();
  });

  it.each([
    { existing: [] as Address[], expectedDefault: true },
    { existing: addresses, expectedDefault: false },
  ])(
    "creates an address with is_default=$expectedDefault for the current address list",
    ({ existing, expectedDefault }) => {
      mocks.useAddresses.mockReturnValue(successfulQuery(existing));
      render(<CheckoutFlow />);

      fireEvent.click(screen.getByRole("button", { name: "آدرس جدید" }));
      fillAddressForm();

      expect(mocks.createAddressMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_default: expectedDefault,
          country: "IR",
          state_province: "تهران",
        }),
        expect.any(Object),
      );
    },
  );

  it("renders failed address and shipping reads as retryable errors, not empty data", () => {
    const addressRefetch = vi.fn();
    mocks.useAddresses.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      isSuccess: false,
      refetch: addressRefetch,
    });

    const { rerender } = render(<CheckoutFlow />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "دریافت آدرس‌ها انجام نشد",
    );
    expect(
      screen.queryByText(/هنوز آدرسی ثبت نشده است/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(addressRefetch).toHaveBeenCalledTimes(1);

    const shippingRefetch = vi.fn();
    mocks.useAddresses.mockReturnValue(successfulQuery(addresses));
    mocks.useShippingMethods.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: shippingRefetch,
    });
    rerender(<CheckoutFlow />);
    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "دریافت روش‌های ارسال انجام نشد",
    );
    expect(
      screen.queryByText("روش ارسالی برای منطقهٔ شما یافت نشد."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(shippingRefetch).toHaveBeenCalledTimes(1);
  });

  it("invalidates a coupon when the cart subtotal changes", () => {
    mocks.couponMutate.mockImplementation(
      (_input: unknown, callbacks?: CouponCallbacks) =>
        callbacks?.onSuccess?.(validCoupon),
    );
    const { rerender } = render(<CheckoutFlow />);
    goToPayment();

    fireEvent.change(screen.getByLabelText("کد تخفیف"), {
      target: { value: "SAVE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /اعمال/ }));
    expect(screen.getByText(/تخفیف اعمال‌شده/)).toBeInTheDocument();

    mocks.useCart.mockReturnValue(
      successfulQuery({
        ...cart,
        summary: { ...cart.summary, subtotal: 1_200 },
      }),
    );
    rerender(<CheckoutFlow />);

    expect(screen.queryByText(/تخفیف اعمال‌شده/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/مبلغ سبد تغییر کرده است/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: /ثبت و پرداخت/ })[0],
    );
    expect(mocks.placeOrderMutate).toHaveBeenCalledWith(
      expect.not.objectContaining({ coupon_code: expect.anything() }),
      expect.any(Object),
    );
  });

  it("discards coupon validation as soon as the entered code changes", () => {
    mocks.couponMutate.mockImplementation(
      (_input: unknown, callbacks?: CouponCallbacks) =>
        callbacks?.onSuccess?.(validCoupon),
    );
    render(<CheckoutFlow />);
    goToPayment();

    const input = screen.getByLabelText("کد تخفیف");
    fireEvent.change(input, { target: { value: "SAVE" } });
    fireEvent.click(screen.getByRole("button", { name: /اعمال/ }));
    expect(screen.getByText(/تخفیف اعمال‌شده/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "OTHER" } });
    expect(screen.queryByText(/تخفیف اعمال‌شده/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "SAVE" } });
    expect(screen.queryByText(/تخفیف اعمال‌شده/)).not.toBeInTheDocument();
  });

  it("keeps order submission failures visible beside the retry action", () => {
    const scrollIntoView = vi.fn();
    const previousScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    mocks.placeOrderMutate.mockImplementation(
      (_input: unknown, callbacks?: OrderCallbacks) =>
        callbacks?.onError?.(
          new ApiClientError(409, "OUT_OF_STOCK", "out of stock"),
        ),
    );
    render(<CheckoutFlow />);
    goToPayment();
    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
    try {
      const submit = screen.getAllByRole("button", { name: /ثبت و پرداخت/ })[0];
      fireEvent.click(submit);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("موجودی کافی نیست");
      expect(
        alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(scrollIntoView).toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith("موجودی کافی نیست", {
        description: "تعداد را کم کنید یا کالا را از سبد حذف کنید.",
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = previousScroll;
    }
  });

  it("links to Cellar Club without inventing unpaid earn amounts", () => {
    render(<CheckoutFlow />);
    goToPayment();

    const rewards = screen.getByRole("link", { name: "مشاهدهٔ باشگاه مشتریان" });
    expect(rewards).toHaveAttribute("href", "/account/rewards");
    expect(screen.getByText(/پس از/)).toHaveTextContent("تأیید پرداخت");
    expect(screen.getByText(/ثبت سفارش به‌تنهایی امتیاز نمی‌دهد/)).toBeInTheDocument();

    const paymentStep = screen.getByRole("heading", {
      name: "باشگاه مشتریان",
    }).closest("section");
    expect(paymentStep).toBeTruthy();
    expect(paymentStep).not.toHaveTextContent(/[0-9۰-۹]+\s*امتیاز/);
    expect(paymentStep).not.toHaveTextContent(/امتیاز می‌گیرید|امتیاز دریافت/);
  });

  it.each([
    "paid",
    "processing",
    "ready_to_ship",
    "shipped",
    "out_for_delivery",
    "delivered",
  ] as const)(
    "records purchase recs when place-order returns paid-like status %s",
    async (status) => {
      mocks.placeOrderMutate.mockImplementation(
        (_input: unknown, callbacks?: OrderCallbacks) =>
          callbacks?.onSuccess?.(placedOrder(status)),
      );
      render(<CheckoutFlow />);
      goToReviewAndSubmit();

      await waitFor(() => {
        expect(mocks.recordInteractionClient).toHaveBeenCalledWith({
          product_id: 1,
          interaction_type: "purchase",
          source: "checkout",
          metadata: { order_id: 42 },
        });
      });
      expect(mocks.routerPush).toHaveBeenCalledWith(
        "/checkout/confirmation/42",
      );
    },
  );

  it("does not record purchase recs for pending bank_transfer", async () => {
    mocks.placeOrderMutate.mockImplementation(
      (_input: unknown, callbacks?: OrderCallbacks) =>
        callbacks?.onSuccess?.(placedOrder("pending", "bank_transfer")),
    );
    render(<CheckoutFlow />);
    goToReviewAndSubmit();

    expect(mocks.routerPush).toHaveBeenCalledWith(
      "/checkout/confirmation/42",
    );
    await Promise.resolve();
    expect(mocks.recordInteractionClient).not.toHaveBeenCalled();
  });

  it.each(["payment_failed", "cancelled"] as const)(
    "does not record purchase recs when place-order returns unpaid status %s",
    async (status) => {
      mocks.placeOrderMutate.mockImplementation(
        (_input: unknown, callbacks?: OrderCallbacks) =>
          callbacks?.onSuccess?.(placedOrder(status)),
      );
      render(<CheckoutFlow />);
      goToReviewAndSubmit();

      expect(mocks.routerPush).toHaveBeenCalledWith(
        "/checkout/confirmation/42",
      );
      await Promise.resolve();
      expect(mocks.recordInteractionClient).not.toHaveBeenCalled();
    },
  );
});
