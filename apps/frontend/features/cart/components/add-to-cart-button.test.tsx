// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";

const mocks = vi.hoisted(() => ({
  status: "authenticated",
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    info: mocks.info,
  },
}));

vi.mock("@/features/cart/api", () => ({
  useAddCartItem: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({ mutateAsync: mocks.mutateAsync }),
}));

import { AddToCartButton } from "./add-to-cart-button";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "authenticated";
  mocks.mutateAsync.mockResolvedValue(undefined);
});

describe("AddToCartButton", () => {
  it("sends the backend cart contract and treats tracking as non-blocking", async () => {
    render(
      <AddToCartButton productVariantId={17} productId={9} quantity={2} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد" }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { product_variant_id: 17, quantity: 2 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    const options = mocks.mutate.mock.calls[0]?.[1];
    mocks.mutateAsync.mockRejectedValueOnce(new Error("tracking offline"));
    options.onSuccess({ id: 1, items: [], summary: {} });

    expect(mocks.success).toHaveBeenCalledWith(
      "به سبد خرید افزوده شد",
      expect.objectContaining({ action: expect.any(Object) }),
    );
    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        product_id: 9,
        interaction_type: "add_to_cart",
        source: "cart_button",
      });
    });
  });

  it("shows the backend stock error without reporting false success", () => {
    render(<AddToCartButton productVariantId={17} />);
    fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد" }));

    const options = mocks.mutate.mock.calls[0]?.[1];
    options.onError(new ApiClientError(409, "OUT_OF_STOCK", "out"));

    expect(mocks.error).toHaveBeenCalledWith("موجودی کافی نیست");
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("rejects missing variants before making a cart request", () => {
    render(<AddToCartButton />);
    fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "این محصول گزینهٔ قابل خرید ندارد",
    );
  });
});
