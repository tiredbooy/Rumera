// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "authenticated" as "authenticated" | "unauthenticated" | "loading",
  addMutate: vi.fn(),
  removeMutate: vi.fn(),
  useWishlist: vi.fn((enabled?: boolean) => ({
    enabled,
    data: { items: [] as Array<{ id: number; variant_id: number }> },
  })),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/wishlist/hooks", () => ({
  useWishlist: (enabled?: boolean) => mocks.useWishlist(enabled),
  useAddWishlistItem: () => ({ isPending: false, mutate: mocks.addMutate }),
  useRemoveWishlistItem: () => ({
    isPending: false,
    mutate: mocks.removeMutate,
  }),
}));

vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/features/cart/components/add-to-cart-button", () => ({
  AddToCartButton: ({
    productVariantId,
    label,
  }: {
    productVariantId?: number;
    label?: string;
  }) => (
    <button
      type="button"
      data-testid="add-to-cart"
      data-variant-id={productVariantId}
    >
      {label}
    </button>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) =>
    asChild ? (
      children
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    ),
}));

import {
  PRODUCT_CARD_ACTIONS_OVERLAY_CLASS,
  ProductCardActions,
} from "./product-card-actions";

const baseProps = {
  productId: 42,
  productTitle: "بطری رزرو ویژه",
  productHref: "/products/reserve-bottle",
  hasActiveVariants: true,
  hasAvailableVariants: true,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "authenticated";
  mocks.useWishlist.mockImplementation((enabled?: boolean) => ({
    enabled,
    data: { items: [] },
  }));
});

describe("ProductCardActions visibility", () => {
  it("keeps quick-add off touch media while preserving hover and focus access", () => {
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).toContain(
      "[@media(hover:hover)_and_(pointer:fine)]:group-hover/product:opacity-100",
    );
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).toContain(
      "group-focus-within/product:opacity-100",
    );
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).not.toContain("max-sm:opacity-100");
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).not.toContain(
      "motion-reduce:opacity-100",
    );
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).toContain(
      "motion-reduce:transition-none",
    );
  });
});

describe("ProductCardActions wishlist", () => {
  it("toggles the resolved purchasable variant and keeps quick-add", () => {
    render(
      <ProductCardActions {...baseProps} purchasableVariantId={9} />,
    );

    expect(mocks.useWishlist).toHaveBeenCalledWith(true);
    const heart = screen.getByRole("button", {
      name: "افزودن بطری رزرو ویژه به علاقه‌مندی‌ها",
    });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("link", { name: /علاقه‌مندی/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(heart);
    expect(mocks.addMutate).toHaveBeenCalledWith(9, expect.any(Object));

    const quickAdd = screen.getByTestId("add-to-cart");
    expect(quickAdd).toHaveAttribute("data-variant-id", "9");
    expect(screen.queryByText("انتخاب گزینه‌ها")).not.toBeInTheDocument();
  });

  it("links multi-option cards to the PDP instead of inventing a wishlist target", () => {
    render(<ProductCardActions {...baseProps} />);

    expect(mocks.useWishlist).toHaveBeenCalledWith(false);
    const heart = screen.getByRole("link", {
      name: "برای افزودن بطری رزرو ویژه به علاقه‌مندی‌ها ابتدا گزینه را انتخاب کنید",
    });
    expect(heart).toHaveAttribute("href", "/products/reserve-bottle");
    expect(heart).not.toHaveAttribute("aria-pressed");
    expect(
      screen.queryByRole("button", { name: /علاقه‌مندی/ }),
    ).not.toBeInTheDocument();
    expect(mocks.addMutate).not.toHaveBeenCalled();
    expect(mocks.removeMutate).not.toHaveBeenCalled();

    expect(screen.queryByTestId("add-to-cart")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "انتخاب گزینه‌ها" }),
    ).toHaveAttribute("href", "/products/reserve-bottle");
  });

  it("hides the heart when multi-option cards have no public PDP", () => {
    render(
      <ProductCardActions
        {...baseProps}
        productHref={null}
      />,
    );

    expect(screen.queryByRole("link", { name: /علاقه‌مندی/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /علاقه‌مندی/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-to-cart")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "انتخاب گزینه در دسترس نیست" }),
    ).toBeDisabled();
  });

  it("does not show a heart for out-of-stock or unconfigured cards", () => {
    const { rerender } = render(
      <ProductCardActions
        {...baseProps}
        hasAvailableVariants={false}
      />,
    );

    expect(screen.queryByRole("link", { name: /علاقه‌مندی/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /علاقه‌مندی/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ناموجود/ })).toBeDisabled();

    rerender(
      <ProductCardActions
        {...baseProps}
        hasActiveVariants={false}
        hasAvailableVariants={false}
      />,
    );

    expect(screen.queryByRole("link", { name: /علاقه‌مندی/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /علاقه‌مندی/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "در حال تأمین" })).toBeDisabled();
  });
});
