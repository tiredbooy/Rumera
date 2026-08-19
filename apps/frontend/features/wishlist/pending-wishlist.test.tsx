// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "authenticated",
  mutate: vi.fn(),
  record: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/features/wishlist/hooks", () => ({
  useAddWishlistItem: () => ({ mutate: mocks.mutate }),
}));
vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({ mutate: mocks.record }),
}));

import {
  PendingWishlistIntent,
  stashWishlistIntent,
  takeWishlistIntent,
} from "./pending-wishlist";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.status = "authenticated";
});

describe("wishlist intent", () => {
  it("round-trips the variant and product id", () => {
    stashWishlistIntent({ product_variant_id: 9, product_id: 42 });
    expect(takeWishlistIntent()).toEqual({
      product_variant_id: 9,
      product_id: 42,
    });
    expect(takeWishlistIntent()).toBeNull();
  });

  it("replays the heart after login", async () => {
    stashWishlistIntent({ product_variant_id: 9, product_id: 42 });
    render(<PendingWishlistIntent />);

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    );
    mocks.mutate.mock.calls.at(-1)?.[1].onSuccess();
    expect(mocks.success).toHaveBeenCalledWith("به علاقه‌مندی‌ها افزوده شد");
    expect(mocks.record).toHaveBeenCalledWith({
      product_id: 42,
      interaction_type: "wishlist",
      source: "product_card",
    });
  });
});
