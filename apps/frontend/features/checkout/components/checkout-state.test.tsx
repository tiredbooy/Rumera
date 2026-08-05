// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Address } from "@/features/addresses/types";
import type { Cart } from "@/features/cart/types";
import type { CouponValidation } from "@/features/coupons/types";
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
  useShippingMethods: () => mocks.useShippingMethods(),
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
  onError?: (error: unknown) => void;
};

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

function fillAddressForm() {
  fireEvent.change(screen.getByLabelText("نام و نام خانوادگی"), {
    target: { value: "گیرنده جدید" },
  });
  fireEvent.change(screen.getByLabelText("نشانی"), {
    target: { value: "خیابان سوم" },
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
});

describe("checkout state logic", () => {
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
        expect.objectContaining({ is_default: expectedDefault }),
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
    mocks.placeOrderMutate.mockImplementation(
      (_input: unknown, callbacks?: OrderCallbacks) =>
        callbacks?.onError?.(
          new ApiClientError(409, "OUT_OF_STOCK", "out of stock"),
        ),
    );
    render(<CheckoutFlow />);
    goToPayment();
    fireEvent.click(screen.getByRole("button", { name: /ادامه/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: /ثبت و پرداخت/ })[0],
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "موجودی برخی اقلام کافی نیست",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("موجودی برخی اقلام کافی نیست"),
    );
  });
});
