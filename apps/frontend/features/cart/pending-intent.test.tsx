// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";
import type { Cart, CartItem } from "@/features/cart/types";

const mocks = vi.hoisted(() => ({
  status: "authenticated",
  mutate: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
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
    warning: mocks.warning,
    error: mocks.error,
  },
}));

vi.mock("@/features/cart/api", () => ({
  useAddCartItem: () => ({ mutate: mocks.mutate }),
}));

import {
  PendingCartIntent,
  stashAddToCartIntent,
  takeAddToCartIntent,
} from "./pending-intent";

const KEY = "rumera_cart_intent";

function cartWith(item: Partial<CartItem>): Cart {
  return {
    id: 1,
    items: [
      {
        id: 5,
        product_id: 9,
        product_title: "شراب",
        variant_id: 17,
        current_price: 100,
        price_changed: false,
        quantity: 2,
        line_total: 200,
        ...item,
      },
    ],
    summary: { total_items: 2, unique_items: 1, subtotal: 200, discount_total: 0 },
  };
}

/** Resolve the mutation's success/error callbacks from the last mutate() call. */
function lastCallbacks() {
  return mocks.mutate.mock.calls.at(-1)?.[1];
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.status = "authenticated";
});

describe("add-to-cart intent stash", () => {
  it("round-trips a stashed intent and clears it in the same read", () => {
    stashAddToCartIntent({ product_variant_id: 17, quantity: 2 });

    expect(takeAddToCartIntent()).toEqual({
      product_variant_id: 17,
      quantity: 2,
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(takeAddToCartIntent()).toBeNull();
  });

  it("drops an intent that outlived its TTL", () => {
    stashAddToCartIntent({ product_variant_id: 17, quantity: 1 });

    // Eleven minutes later: past the ten-minute bound.
    expect(takeAddToCartIntent(Date.now() + 11 * 60 * 1000)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("discards a corrupt or hand-edited stash instead of replaying it", () => {
    sessionStorage.setItem(KEY, "{not json");
    expect(takeAddToCartIntent()).toBeNull();

    sessionStorage.setItem(
      KEY,
      JSON.stringify({ product_variant_id: 0, quantity: 1, expires_at: Date.now() + 1000 }),
    );
    expect(takeAddToCartIntent()).toBeNull();

    sessionStorage.setItem(
      KEY,
      JSON.stringify({ product_variant_id: 17, quantity: 2 }),
    );
    expect(takeAddToCartIntent()).toBeNull();
  });
});

describe("PendingCartIntent", () => {
  it("replays the intent the guest was bounced out of, once authenticated", async () => {
    stashAddToCartIntent({ product_variant_id: 17, quantity: 3 });

    render(<PendingCartIntent />);

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        { product_variant_id: 17, quantity: 3 },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    );

    lastCallbacks().onSuccess(cartWith({ available_stock: 9 }));
    expect(mocks.success).toHaveBeenCalledWith(
      "کالای انتخابی پس از ورود به سبد خرید افزوده شد",
      expect.objectContaining({ action: expect.any(Object) }),
    );
  });

  it("does not replay again on a refresh, a remount or a back-navigation", async () => {
    stashAddToCartIntent({ product_variant_id: 17, quantity: 1 });

    const first = render(<PendingCartIntent />);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    // The stash is emptied by the read, not by the response.
    expect(sessionStorage.getItem(KEY)).toBeNull();

    first.rerender(<PendingCartIntent />);
    first.unmount();
    render(<PendingCartIntent />);

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
  });

  it("leaves the intent alone while the shopper is still a guest", async () => {
    mocks.status = "unauthenticated";
    stashAddToCartIntent({ product_variant_id: 17, quantity: 1 });

    render(<PendingCartIntent />);

    await waitFor(() => expect(mocks.mutate).not.toHaveBeenCalled());
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it("never replays an expired intent", async () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        product_variant_id: 17,
        quantity: 1,
        expires_at: Date.now() - 1,
      }),
    );

    render(<PendingCartIntent />);

    await waitFor(() => expect(mocks.mutate).not.toHaveBeenCalled());
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("surfaces the per-line availability state when the replay outruns stock", async () => {
    stashAddToCartIntent({ product_variant_id: 17, quantity: 2 });

    render(<PendingCartIntent />);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));

    // U-3 projection: the row landed, but above what is really sellable.
    lastCallbacks().onSuccess(cartWith({ quantity: 2, available_stock: 1 }));

    expect(mocks.warning).toHaveBeenCalledWith(
      "کالای انتخابی به سبد افزوده شد اما موجودی کافی نیست",
      expect.objectContaining({
        description: "پیش از پرداخت، تعداد را در سبد خرید اصلاح کنید.",
      }),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("reports a rejected replay instead of failing silently", async () => {
    stashAddToCartIntent({ product_variant_id: 17, quantity: 5 });

    render(<PendingCartIntent />);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));

    lastCallbacks().onError(new ApiClientError(409, "OUT_OF_STOCK", "out"));

    expect(mocks.error).toHaveBeenCalledWith("افزودن خودکار به سبد انجام نشد", {
      description: "موجودی کافی نیست",
    });
    expect(mocks.success).not.toHaveBeenCalled();
    // A failed replay still leaves nothing behind to fire a second time.
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
