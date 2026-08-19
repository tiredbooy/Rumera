// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "authenticated",
  mutate: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}));
vi.mock("@/features/cart/api", () => ({
  useBulkAddCartItems: () => ({ mutate: mocks.mutate }),
}));

import {
  PendingBulkAddIntent,
  stashBulkAddIntent,
  takeBulkAddIntent,
} from "./pending-bulk-add";

const items = [
  { product_variant_id: 8, quantity: 1 },
  { product_variant_id: 9, quantity: 1 },
];

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.status = "authenticated";
});

describe("bulk add intent", () => {
  it("round-trips and clears on read", () => {
    stashBulkAddIntent(items);
    expect(takeBulkAddIntent()).toEqual(items);
    expect(takeBulkAddIntent()).toBeNull();
  });

  it("replays once after login", async () => {
    stashBulkAddIntent(items);
    render(<PendingBulkAddIntent />);

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        items,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    );

    mocks.mutate.mock.calls.at(-1)?.[1].onSuccess({
      added: 2,
      skipped: [],
      cart: { id: 1, items: [], summary: { total_items: 0, unique_items: 0, subtotal: 0, discount_total: 0 } },
    });
    expect(mocks.success).toHaveBeenCalled();
    expect(sessionStorage.getItem("rumera_bulk_add_intent")).toBeNull();
  });

  it("leaves the stash alone for a guest", async () => {
    mocks.status = "unauthenticated";
    stashBulkAddIntent(items);
    render(<PendingBulkAddIntent />);
    await waitFor(() => expect(mocks.mutate).not.toHaveBeenCalled());
    expect(takeBulkAddIntent()).toEqual(items);
  });
});
