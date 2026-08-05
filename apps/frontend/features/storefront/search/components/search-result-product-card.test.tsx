// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductListItem } from "@/features/catalog/products/types";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  status: "authenticated" as "authenticated" | "unauthenticated" | "loading",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));

vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({
    mutateAsync: mocks.mutateAsync,
  }),
}));

vi.mock("@/features/catalog/products/components/product-card", () => ({
  ProductCard: ({ product }: { product: ProductListItem }) => (
    <a href={`/products/${product.slug}`}>{product.title}</a>
  ),
}));

import { SearchResultProductCard } from "./search-result-product-card";

const product: ProductListItem = {
  id: 11,
  title: "ویسکی تست",
  slug: "test-whisky",
  image_response: null,
  is_active: true,
  min_price: 1000,
  max_price: 1000,
  active_variant_count: 1,
  available_variant_count: 1,
  purchasable_variant_id: 2,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "authenticated";
  mocks.mutateAsync.mockResolvedValue(undefined);
});

describe("SearchResultProductCard", () => {
  it("records search_click for signed-in shoppers", () => {
    render(<SearchResultProductCard product={product} query="ویسکی" />);
    fireEvent.click(screen.getByText("ویسکی تست"));
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      product_id: 11,
      interaction_type: "search_click",
      source: "search",
      metadata: { q: "ویسکی" },
    });
  });

  it("skips recording for guests", () => {
    mocks.status = "unauthenticated";
    render(<SearchResultProductCard product={product} query="ویسکی" />);
    fireEvent.click(screen.getByText("ویسکی تست"));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
});
