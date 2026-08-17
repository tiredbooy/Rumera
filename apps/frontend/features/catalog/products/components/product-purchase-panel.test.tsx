// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductDetail } from "@/features/catalog/products/types";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/wishlist/hooks", () => ({
  useWishlist: () => ({ data: { items: [] } }),
  useAddWishlistItem: () => ({ isPending: false, mutate: vi.fn() }),
  useRemoveWishlistItem: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/features/cart/components/add-to-cart-button", () => ({
  AddToCartButton: ({
    productVariantId,
    quantity,
    disabled,
    className,
    label,
  }: {
    productVariantId?: number;
    quantity?: number;
    disabled?: boolean;
    className?: string;
    label?: string;
  }) => (
    <button
      type="button"
      data-testid="add-to-cart"
      data-variant-id={productVariantId}
      data-quantity={quantity}
      disabled={disabled}
      className={className}
    >
      {label}
    </button>
  ),
}));
vi.mock("./alert-button", () => ({
  AlertButton: ({
    productVariantId,
    isAvailable,
  }: {
    productVariantId?: number;
    isAvailable: boolean;
  }) => (
    <button
      type="button"
      data-testid="alert-button"
      data-variant-id={productVariantId}
      data-available={String(isAvailable)}
    >
      {isAvailable ? "اعلان‌ها" : "اطلاع از موجود شدن"}
    </button>
  ),
}));

import { ProductPurchasePanel } from "./product-purchase-panel";

function makeProduct(variants: ProductDetail["variants"]): ProductDetail {
  return {
    id: 10,
    title: "محصول نمونه",
    slug: "sample",
    is_active: true,
    variants,
  };
}

afterEach(cleanup);

describe("ProductPurchasePanel", () => {
  it("defaults to the first available active variant and exposes one CTA per breakpoint", () => {
    render(
      <ProductPurchasePanel
        product={makeProduct([
          {
            id: 1,
            sku: "گزینه قرمز",
            price: 100_000,
            is_active: true,
            available_stock: 0,
          },
          {
            id: 2,
            sku: "گزینه طلایی",
            price: 125_000,
            is_active: true,
            available_stock: 2,
          },
          {
            id: 3,
            sku: "غیرفعال",
            price: 90_000,
            is_active: false,
            available_stock: 9,
          },
        ])}
      />,
    );

    expect(screen.getByRole("radio", { name: "گزینه طلایی" })).toBeChecked();
    expect(
      screen.queryByRole("radio", { name: "غیرفعال" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("۲ عدد باقی مانده");

    const cartButtons = screen.getAllByTestId("add-to-cart");
    expect(cartButtons).toHaveLength(2);
    expect(cartButtons[0]).toHaveClass("hidden", "lg:inline-flex");
    expect(cartButtons[0]).toHaveAttribute("data-variant-id", "2");
    expect(cartButtons[0]).toBeEnabled();
    expect(cartButtons[1].closest('[aria-label="خرید سریع"]')).toHaveClass(
      "lg:hidden",
    );
    expect(cartButtons[1]).toBeEnabled();
    expect(
      within(screen.getByLabelText("خرید سریع")).getByText(
        "گزینه طلایی · تعداد ۱",
      ),
    ).toBeInTheDocument();
  });

  it("caps quantity by stock and resets it when the selected variant changes", () => {
    render(
      <ProductPurchasePanel
        product={makeProduct([
          {
            id: 1,
            sku: "گزینه اول",
            price: 100_000,
            is_active: true,
            available_stock: 2,
          },
          {
            id: 2,
            sku: "گزینه دوم",
            price: 150_000,
            is_active: true,
            available_stock: 4,
          },
        ])}
      />,
    );

    const increase = screen.getByRole("button", { name: "افزایش تعداد" });
    fireEvent.click(increase);
    expect(increase).toBeDisabled();
    expect(screen.getAllByTestId("add-to-cart")[0]).toHaveAttribute(
      "data-quantity",
      "2",
    );

    fireEvent.click(screen.getByRole("radio", { name: "گزینه دوم" }));
    expect(screen.getAllByTestId("add-to-cart")[0]).toHaveAttribute(
      "data-quantity",
      "1",
    );
    expect(screen.getByRole("button", { name: "کاهش تعداد" })).toBeDisabled();
  });

  it("shows sold-out state, disables cart, and keeps a variant-specific alert", () => {
    render(
      <ProductPurchasePanel
        product={makeProduct([
          {
            id: 1,
            sku: "گزینه موجود",
            price: 100_000,
            is_active: true,
            available_stock: 2,
          },
          {
            id: 2,
            sku: "گزینه تمام‌شده",
            price: 150_000,
            is_active: true,
            available_stock: 0,
          },
        ])}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: "گزینه تمام‌شده، ناموجود" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "این گزینه در حال حاضر ناموجود است.",
    );
    expect(
      screen.queryByRole("button", { name: "افزایش تعداد" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-to-cart")).not.toBeInTheDocument();
    const alerts = screen.getAllByTestId("alert-button");
    expect(alerts.length).toBeGreaterThan(0);
    for (const button of alerts) {
      expect(button).toHaveTextContent("اطلاع از موجود شدن");
      expect(button).toHaveAttribute("data-available", "false");
      expect(button).toHaveAttribute("data-variant-id", "2");
    }
  });

  it("provides nonblank fallback labels and selects the first active variant when all are sold out", () => {
    render(
      <ProductPurchasePanel
        product={makeProduct([
          {
            id: 1,
            sku: "   ",
            price: 100_000,
            is_active: true,
            available_stock: 0,
          },
          {
            id: 2,
            price: 120_000,
            is_active: true,
            available_stock: 0,
            options: [
              {
                id: 1,
                option_type_id: 1,
                option_type_title: "volume",
                option_type: "حجم",
                value: "   ",
              },
            ],
          },
        ])}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "گزینه ۱، ناموجود" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "گزینه ۲، ناموجود" }),
    ).not.toBeChecked();
  });
});
