// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  listQuery: vi.fn(),
  voidCard: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/gift-cards",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/features/gift-cards/hooks", () => ({
  useAdminGiftCards: (query: unknown) => {
    mocks.listQuery(query);
    return mocks.list();
  },
  useVoidGiftCard: () => ({
    mutateAsync: mocks.voidCard,
    isPending: false,
    variables: undefined,
    error: null,
  }),
}));

import { GiftCardApiError } from "@/features/gift-cards/api/admin-client";

import { GiftCardList } from "./gift-card-list";

const pagination = {
  page: 1,
  limit: 20,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_prev: false,
};

const activeCard = {
  id: 12,
  code: "ABCD-EFGH-JKLM-NPQR",
  initial_amount: "500000",
  status: "active" as const,
  created_at: "2026-08-16T10:00:00Z",
};

const redeemedCard = {
  id: 13,
  code: "RSTU-VWXY-2345-6789",
  initial_amount: "250000",
  status: "redeemed" as const,
  redeemed_by: 4,
  redeemed_at: "2026-08-16T12:00:00Z",
  created_at: "2026-08-16T11:00:00Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
  mocks.voidCard.mockResolvedValue({ ...activeCard, status: "disabled" });
});

describe("GiftCardList", () => {
  it("shows a retryable error without plausible gift-card rows", () => {
    const refetch = vi.fn();
    mocks.list.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      error: new GiftCardApiError(502, "UPSTREAM_UNAVAILABLE", "could not reach API"),
      refetch,
    });

    render(<GiftCardList />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "بارگذاری کارت‌های هدیه ناموفق بود",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("could not reach API");
    expect(screen.queryByText("ABCD-EFGH-JKLM-NPQR")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("derives only supported backend filters from URL state", () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("page=2&status=active&q=ABCD&sort=amount_asc"),
    );
    mocks.list.mockReturnValue({
      data: { results: [], pagination: { ...pagination, page: 2 } },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<GiftCardList />);

    expect(mocks.listQuery).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      status: "active",
      search: "ABCD",
      sortBy: "initial_amount",
      orderBy: "asc",
    });
  });

  it("distinguishes an empty ledger from a filtered miss", () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams("status=disabled"));
    mocks.list.mockReturnValue({
      data: { results: [], pagination },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<GiftCardList />);

    expect(
      screen.getByText("کارتی با این فیلترها پیدا نشد."),
    ).toBeInTheDocument();
  });

  it("voids an active card only after confirm and keeps redeemed rows inert", async () => {
    mocks.list.mockReturnValue({
      data: {
        results: [activeCard, redeemedCard],
        pagination: { ...pagination, total_items: 2 },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<GiftCardList />);

    expect(
      screen.queryByRole("button", { name: "باطل کردن RSTU-VWXY-2345-6789" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "باطل کردن ABCD-EFGH-JKLM-NPQR" }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent("بازپرداخت نیست");
    fireEvent.click(screen.getByRole("button", { name: "بله، باطل شود" }));

    await waitFor(() => expect(mocks.voidCard).toHaveBeenCalledWith(12));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("کارت هدیه باطل شد");
  });

  it("surfaces the backend void error and does not toast success", async () => {
    mocks.voidCard.mockRejectedValue(
      new GiftCardApiError(409, "INVALID_STATE", "gift card is not active"),
    );
    const refetch = vi.fn();
    mocks.list.mockReturnValue({
      data: {
        results: [activeCard],
        pagination: { ...pagination, total_items: 1 },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    });

    render(<GiftCardList />);
    fireEvent.click(
      screen.getByRole("button", { name: "باطل کردن ABCD-EFGH-JKLM-NPQR" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "بله، باطل شود" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("gift card is not active");
    expect(mocks.toastError).toHaveBeenCalledWith("gift card is not active");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });
});
