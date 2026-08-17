// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/gift-cards",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/gift-cards/hooks", () => ({
  useCreateGiftCards: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminGiftCards: () => mocks.list(),
  useVoidGiftCard: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
    error: null,
  }),
}));

import { GiftCardsBoard } from "./gift-cards-board";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockReturnValue({
    data: {
      results: [],
      pagination: {
        page: 1,
        limit: 20,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
});

describe("GiftCardsBoard", () => {
  it("sends issuance to its own route and keeps the ledger here", () => {
    render(<GiftCardsBoard />);

    expect(
      screen.getByRole("heading", { name: "کارت‌های هدیه" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /صدور کارت/ }),
    ).toHaveAttribute("href", "/admin/gift-cards/new");
    expect(screen.getByRole("region", { name: "دفتر کارت‌ها" })).toBeInTheDocument();
    expect(screen.getByText("هنوز کارتی صادر نشده است.")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("مبلغ هر کارت (تومان)"),
    ).not.toBeInTheDocument();
  });
});
