// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";
import type { Cart, CartItem } from "@/features/cart/types";

const mocks = vi.hoisted(() => ({
  useCart: vi.fn(),
  useAddCartItem: vi.fn(),
  useUpdateCartItem: vi.fn(),
  useRemoveCartItem: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

vi.mock("@/features/cart/api", () => ({
  useCart: () => mocks.useCart(),
  useAddCartItem: () => mocks.useAddCartItem(),
  useUpdateCartItem: () => mocks.useUpdateCartItem(),
  useRemoveCartItem: () => mocks.useRemoveCartItem(),
}));

import { CartLines } from "./cart-lines";

const cart: Cart = {
  id: 1,
  items: [
    {
      id: 11,
      product_id: 1,
      product_title: "بطری آزمایشی",
      variant_id: 101,
      current_price: 100,
      price_changed: false,
      quantity: 2,
      line_total: 200,
      image_url: "/bottle.jpg",
    },
  ],
  summary: {
    total_items: 2,
    unique_items: 1,
    subtotal: 200,
    discount_total: 0,
  },
};

function idleMutation() {
  return {
    isError: false,
    isPending: false,
    error: null,
    variables: undefined,
    reset: vi.fn(),
    mutate: vi.fn(),
  };
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCart.mockReturnValue({
    data: cart,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  mocks.useAddCartItem.mockReturnValue(idleMutation());
  mocks.useUpdateCartItem.mockReturnValue(idleMutation());
  mocks.useRemoveCartItem.mockReturnValue(idleMutation());
});

describe("CartLines mutation errors", () => {
  it("shows the mapped stock error when a quantity update is rejected", () => {
    mocks.useUpdateCartItem.mockReturnValue({
      ...idleMutation(),
      isError: true,
      error: new ApiClientError(409, "OUT_OF_STOCK", "x"),
    });

    render(<CartLines />);

    expect(screen.getByRole("alert")).toHaveTextContent("موجودی کافی نیست");
    expect(
      screen.queryByText("به‌روزرسانی تعداد انجام نشد."),
    ).not.toBeInTheDocument();
  });

  it("shows the mapped unavailable error when a remove is rejected", () => {
    mocks.useRemoveCartItem.mockReturnValue({
      ...idleMutation(),
      isError: true,
      error: new ApiClientError(409, "PRODUCT_UNAVAILABLE", "x"),
    });

    render(<CartLines />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "این گزینه فعلاً قابل خرید نیست",
    );
    expect(
      screen.queryByText("حذف کالا از سبد انجام نشد."),
    ).not.toBeInTheDocument();
  });
});

const secondItem: CartItem = {
  id: 12,
  product_id: 2,
  product_title: "بطری دوم",
  variant_id: 202,
  current_price: 80,
  price_changed: false,
  quantity: 1,
  line_total: 80,
  image_url: "/bottle-2.jpg",
};

function twoItemCart(): Cart {
  return {
    ...cart,
    items: [cart.items[0]!, secondItem],
    summary: {
      total_items: 3,
      unique_items: 2,
      subtotal: 280,
      discount_total: 0,
    },
  };
}

describe("CartLines per-line busy", () => {
  it("only disables the line whose quantity mutation is pending", () => {
    mocks.useCart.mockReturnValue({
      data: twoItemCart(),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.useUpdateCartItem.mockReturnValue({
      ...idleMutation(),
      isPending: true,
      variables: { itemId: 11, quantity: 3 },
    });

    render(<CartLines />);

    const plusButtons = screen.getAllByRole("button", { name: "افزایش تعداد" });
    const removeFirst = screen.getByRole("button", { name: "حذف بطری آزمایشی" });
    const removeSecond = screen.getByRole("button", { name: "حذف بطری دوم" });

    expect(plusButtons[0]).toBeDisabled();
    expect(plusButtons[1]).toBeEnabled();
    expect(removeFirst).toBeDisabled();
    expect(removeSecond).toBeEnabled();
    expect(screen.getByText("بطری آزمایشی").closest("li")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("بطری دوم").closest("li")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("only disables the line being removed", () => {
    mocks.useCart.mockReturnValue({
      data: twoItemCart(),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.useRemoveCartItem.mockReturnValue({
      ...idleMutation(),
      isPending: true,
      variables: 12,
    });

    render(<CartLines />);

    expect(screen.getByRole("button", { name: "حذف بطری آزمایشی" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "حذف بطری دوم" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "افزایش تعداد" })[0]).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "افزایش تعداد" })[1]).toBeDisabled();
  });
});

describe("CartLines remove undo", () => {
  it("toasts remove with undo that re-adds the snapshot", () => {
    const removeMutate = vi.fn();
    const addMutate = vi.fn();
    mocks.useRemoveCartItem.mockReturnValue({
      ...idleMutation(),
      mutate: removeMutate,
    });
    mocks.useAddCartItem.mockReturnValue({
      ...idleMutation(),
      mutate: addMutate,
    });

    render(<CartLines />);
    fireEvent.click(screen.getByRole("button", { name: "حذف بطری آزمایشی" }));

    expect(removeMutate).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    removeMutate.mock.calls[0]?.[1].onSuccess();

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "از سبد خرید حذف شد",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "بازگردانی",
          onClick: expect.any(Function),
        }),
      }),
    );

    mocks.toastSuccess.mock.calls[0]?.[1].action.onClick();

    expect(addMutate).toHaveBeenCalledWith(
      { product_variant_id: 101, quantity: 2 },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("surfaces stock codes when undo re-add is rejected", () => {
    const removeMutate = vi.fn();
    const addMutate = vi.fn();
    mocks.useRemoveCartItem.mockReturnValue({
      ...idleMutation(),
      mutate: removeMutate,
    });
    mocks.useAddCartItem.mockReturnValue({
      ...idleMutation(),
      mutate: addMutate,
    });

    render(<CartLines />);
    fireEvent.click(screen.getByRole("button", { name: "حذف بطری آزمایشی" }));
    removeMutate.mock.calls[0]?.[1].onSuccess();
    mocks.toastSuccess.mock.calls[0]?.[1].action.onClick();

    addMutate.mock.calls[0]?.[1].onError(
      new ApiClientError(409, "OUT_OF_STOCK", "x"),
    );

    expect(mocks.toastError).toHaveBeenCalledWith("موجودی کافی نیست");
  });
});
