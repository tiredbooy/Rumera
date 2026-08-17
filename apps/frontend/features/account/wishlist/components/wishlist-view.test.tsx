// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";
import type { BulkAddCartResult } from "@/features/cart/types";
import type { Wishlist } from "@/features/wishlist/types";

const mocks = vi.hoisted(() => ({
  addCart: vi.fn(),
  bulkAdd: vi.fn(),
  removeItem: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("@/features/wishlist/hooks", () => ({
  useWishlist: () => ({
    data: wishlist,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useRemoveWishlistItem: () => ({
    mutateAsync: mocks.removeItem,
    isPending: false,
  }),
}));

vi.mock("@/features/cart/api", () => ({
  useAddCartItem: () => ({ mutateAsync: mocks.addCart, isPending: false }),
  useBulkAddCartItems: () => ({
    mutateAsync: mocks.bulkAdd,
    isPending: false,
  }),
}));

vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

import { WishlistView } from "./wishlist-view";

const wishlist: Wishlist = {
  id: 1,
  total: 2,
  items: [
    {
      id: 11,
      product_id: 1,
      product_slug: "first",
      product_title: "محصول اول",
      variant_id: 101,
      price: 100,
      is_in_stock: true,
      added_at: "2026-07-18T00:00:00Z",
    },
    {
      id: 22,
      product_id: 2,
      product_slug: "second",
      product_title: "محصول دوم",
      variant_id: 202,
      price: 200,
      is_in_stock: true,
      added_at: "2026-07-18T00:00:00Z",
    },
  ],
};

const cart: BulkAddCartResult["cart"] = {
  id: 1,
  items: [],
  summary: {
    total_items: 1,
    unique_items: 1,
    subtotal: 100,
    discount_total: 0,
  },
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bulkAdd.mockReset();
  mocks.addCart.mockResolvedValue(cart);
  mocks.removeItem.mockResolvedValue(undefined);
});

describe("WishlistView bulk actions", () => {
  it("awaits the bulk request, disables conflicting controls, and reports each row", async () => {
    let resolveBulk!: (result: BulkAddCartResult) => void;
    mocks.bulkAdd.mockReturnValue(
      new Promise<BulkAddCartResult>((resolve) => {
        resolveBulk = resolve;
      }),
    );

    render(<WishlistView />);
    const bulkButton = screen.getByRole("button", {
      name: "افزودن همه به سبد",
    });

    fireEvent.click(bulkButton);

    expect(bulkButton).toBeDisabled();
    expect(bulkButton).toHaveTextContent("در حال افزودن همه");
    expect(
      screen.getByRole("button", {
        name: "افزودن محصول اول به سبد خرید",
      }),
    ).toBeDisabled();
    expect(mocks.toastWarning).not.toHaveBeenCalled();
    expect(mocks.bulkAdd).toHaveBeenCalledWith([
      { product_variant_id: 101, quantity: 1 },
      { product_variant_id: 202, quantity: 1 },
    ]);

    await act(async () => {
      resolveBulk({
        cart,
        added: 1,
        skipped: [{ product_variant_id: 202, reason: "out_of_stock" }],
      });
    });

    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalledTimes(1));
    expect(screen.getByText("به سبد افزوده شد")).toBeInTheDocument();
    expect(screen.getByText("موجودی کافی نیست")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "۱ از ۲ مورد به سبد خرید افزوده شد",
    );
    expect(bulkButton).not.toBeDisabled();
  });

  it("reports an all-skipped response as an error", async () => {
    mocks.bulkAdd.mockResolvedValue({
      cart,
      added: 0,
      skipped: [
        { product_variant_id: 101, reason: "unavailable" },
        { product_variant_id: 202, reason: "out_of_stock" },
      ],
    });

    render(<WishlistView />);
    fireEvent.click(
      screen.getByRole("button", { name: "افزودن همه به سبد" }),
    );

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "هیچ موردی به سبد خرید افزوده نشد",
      expect.objectContaining({
        description: expect.stringContaining("موجودی کافی نیست"),
      }),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastWarning).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "هیچ موردی به سبد خرید افزوده نشد",
    );
  });

  it("keeps rejected bulk requests visible at both summary and row level", async () => {
    mocks.bulkAdd.mockRejectedValue(new Error("network"));

    render(<WishlistView />);
    fireEvent.click(
      screen.getByRole("button", { name: "افزودن همه به سبد" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "افزودن گروهی به سبد خرید ناموفق بود",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "افزودن گروهی به سبد خرید ناموفق بود",
    );
    expect(screen.getAllByText("افزودن ناموفق بود")).toHaveLength(2);
  });
});

describe("WishlistView add-to-cart errors", () => {
  it.each([
    ["OUT_OF_STOCK", "موجودی کافی نیست"],
    ["PRODUCT_UNAVAILABLE", "این گزینه فعلاً قابل خرید نیست"],
  ] as const)(
    "surfaces %s from a rejected add instead of a generic failure",
    async (code, copy) => {
      mocks.addCart.mockRejectedValue(new ApiClientError(409, code, "x"));

      render(<WishlistView />);
      fireEvent.click(
        screen.getByRole("button", {
          name: "افزودن محصول اول به سبد خرید",
        }),
      );

      await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
      expect(mocks.toastError).toHaveBeenCalledWith(
        copy,
        expect.objectContaining({ description: "محصول اول" }),
      );
      expect(screen.getByText(copy)).toBeInTheDocument();
      expect(screen.queryByText("افزودن ناموفق بود")).not.toBeInTheDocument();
    },
  );
});
