// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cart, CartItem } from "@/features/cart/types";

const mocks = vi.hoisted(() => ({
  useCart: vi.fn(),
  useAddCartItem: vi.fn(),
  useUpdateCartItem: vi.fn(),
  useRemoveCartItem: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/features/cart/api", () => ({
  useCart: () => mocks.useCart(),
  useAddCartItem: () => mocks.useAddCartItem(),
  useUpdateCartItem: () => mocks.useUpdateCartItem(),
  useRemoveCartItem: () => mocks.useRemoveCartItem(),
}));

import { CartLines } from "./cart-lines";
import { CartView } from "./cart-view";

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 11,
    product_id: 1,
    product_title: "بطری آزمایشی",
    variant_id: 101,
    current_price: 100,
    price_changed: false,
    quantity: 2,
    available_stock: 5,
    line_total: 200,
    ...overrides,
  };
}

function cartOf(...items: CartItem[]): Cart {
  return {
    id: 1,
    items,
    summary: {
      total_items: items.reduce((sum, item) => sum + item.quantity, 0),
      unique_items: items.length,
      subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
      discount_total: 0,
    },
  };
}

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

function seedCart(cart: Cart) {
  mocks.useCart.mockReturnValue({
    data: cart,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
}

const increase = () => screen.getByRole("button", { name: "افزایش تعداد" });

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useSession.mockReturnValue({ status: "authenticated" });
  mocks.useAddCartItem.mockReturnValue(idleMutation());
  mocks.useUpdateCartItem.mockReturnValue(idleMutation());
  mocks.useRemoveCartItem.mockReturnValue(idleMutation());
  seedCart(cartOf(line()));
});

describe("CartLines per-line availability", () => {
  it("flags a sold-out line and freezes its stepper", () => {
    seedCart(cartOf(line({ available_stock: 0 })));

    render(<CartLines />);

    expect(screen.getByText(/ناموجود/)).toBeInTheDocument();
    expect(increase()).toBeDisabled();
  });

  it("flags a line whose quantity is above the remaining stock", () => {
    seedCart(cartOf(line({ quantity: 4, available_stock: 1 })));

    render(<CartLines />);

    expect(screen.getByText(/تنها ۱ عدد موجود است/)).toBeInTheDocument();
    expect(increase()).toBeDisabled();
  });

  it("caps the stepper at the server stock without flagging the line", () => {
    seedCart(cartOf(line({ quantity: 2, available_stock: 2 })));

    render(<CartLines />);

    expect(increase()).toBeDisabled();
    expect(screen.queryByText(/ناموجود/)).not.toBeInTheDocument();
    expect(screen.queryByText(/تنها/)).not.toBeInTheDocument();
  });

  it("keeps the stepper open below the cap", () => {
    seedCart(cartOf(line({ quantity: 2, available_stock: 5 })));

    render(<CartLines />);

    expect(increase()).toBeEnabled();
  });

  it("treats a payload without stock as unknown rather than sold out", () => {
    const withoutStock: CartItem = line();
    delete withoutStock.available_stock;

    seedCart(cartOf(withoutStock));

    render(<CartLines />);

    expect(increase()).toBeEnabled();
    expect(screen.queryByText(/ناموجود/)).not.toBeInTheDocument();
  });
});

describe("CartView checkout gate", () => {
  it("keeps checkout reachable while every line is orderable", () => {
    render(<CartView />);

    expect(
      screen.getAllByRole("link", { name: /ادامه به تسویه/ }).length,
    ).toBeGreaterThan(0);
  });

  it("blocks checkout when a line is above its available stock", () => {
    seedCart(cartOf(line({ quantity: 3, available_stock: 1 })));

    render(<CartView />);

    expect(
      screen.queryByRole("link", { name: /ادامه به تسویه/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "تسویه" })).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/موجودی برخی اقلام سبد کافی نیست/).length,
    ).toBeGreaterThan(0);
  });
});
