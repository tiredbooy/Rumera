// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShoppableProduct } from "@/features/recipes/types";

const mocks = vi.hoisted(() => ({
  state: {
    status: "authenticated" as "authenticated" | "loading" | "unauthenticated",
    result: {
      added: 1,
      skipped: [] as Array<{
        product_variant_id: number;
        reason: "invalid" | "not_found" | "unavailable" | "out_of_stock";
      }>,
    },
  },
  mutate: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.state.status }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/recipes/mojito",
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/features/cart/api", () => ({
  useBulkAddCartItems: () => ({ isPending: false, mutate: mocks.mutate }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
    info: mocks.info,
  },
}));

import { AddAllIngredientsButton } from "./add-all-button";

const product: ShoppableProduct = {
  recipe_product_id: 1,
  product_variant_id: 8,
  product_id: 4,
  product_title: "محصول",
  product_slug: "product",
  price: 100,
  is_available: true,
  available_stock: 3,
  sort_order: 0,
  is_primary: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.status = "authenticated";
  mocks.state.result = { added: 1, skipped: [] };
  mocks.mutate.mockImplementation(
    (
      _items,
      options: { onSuccess: (result: typeof mocks.state.result) => void },
    ) => options.onSuccess(mocks.state.result),
  );
});

afterEach(cleanup);

describe("AddAllIngredientsButton", () => {
  it("waits for session resolution instead of redirecting prematurely", () => {
    mocks.state.status = "loading";
    render(<AddAllIngredientsButton products={[product]} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("reports a partial result as a warning with exact skip reasons", () => {
    mocks.state.result = {
      added: 1,
      skipped: [{ product_variant_id: 9, reason: "out_of_stock" }],
    };
    render(<AddAllIngredientsButton products={[product]} />);
    fireEvent.click(screen.getByRole("button"));

    expect(mocks.warning).toHaveBeenCalledWith(
      expect.stringContaining("۱ از ۲"),
      expect.objectContaining({
        description: expect.stringContaining("موجودی کافی نیست"),
      }),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("reports a complete rejection as an error, never success", () => {
    mocks.state.result = {
      added: 0,
      skipped: [{ product_variant_id: 8, reason: "unavailable" }],
    };
    render(<AddAllIngredientsButton products={[product]} />);
    fireEvent.click(screen.getByRole("button"));

    expect(mocks.error).toHaveBeenCalledWith(
      "هیچ موردی به سبد خرید افزوده نشد",
      expect.objectContaining({
        description: expect.stringContaining("دیگر قابل خرید نیست"),
      }),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
