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
  lookup: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/payments",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/features/payments/hooks", () => ({
  useAdminPayments: (query: unknown) => {
    mocks.listQuery(query);
    return mocks.list();
  },
  useAdminPaymentByTransactionID: (id: string, enabled: boolean) =>
    mocks.lookup(id, enabled),
}));

import { PaymentsBoard } from "./payments-board";

const pagination = {
  page: 1,
  limit: 20,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_prev: false,
};

const idleLookup = {
  data: undefined,
  error: null,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
  mocks.lookup.mockReturnValue(idleLookup);
});

describe("PaymentsBoard", () => {
  it("shows a retryable error without plausible payment rows", () => {
    const refetch = vi.fn();
    mocks.list.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    });

    render(<PaymentsBoard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "بارگذاری تراکنش‌های پرداخت ناموفق بود",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("derives only supported backend filters from URL state", () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams(
        "page=2&status=failed&order=42&user=7&sort=amount_asc",
      ),
    );
    mocks.list.mockReturnValue({
      data: { results: [], pagination: { ...pagination, page: 2 } },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<PaymentsBoard />);

    expect(mocks.listQuery).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      status: "failed",
      order_id: 42,
      user_id: 7,
      sortBy: "amount",
      orderBy: "asc",
    });
  });

  it("links a public user UUID to the customer detail page", () => {
    const publicUserID = "11111111-1111-1111-1111-111111111111";
    mocks.list.mockReturnValue({
      data: {
        results: [
          {
            id: 51,
            order_id: 9,
            user_id: publicUserID,
            amount: "450000",
            currency: "IRT",
            status: "succeeded",
            payment_method: "gateway",
            transaction_id: "gateway-51",
            created_at: "2026-07-29T12:00:00Z",
          },
        ],
        pagination: { ...pagination, total_items: 1 },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<PaymentsBoard />);

    const customerLinks = screen.getAllByRole("link", { name: publicUserID });
    expect(customerLinks.length).toBeGreaterThan(0);
    for (const link of customerLinks) {
      expect(link).toHaveAttribute("href", `/admin/customers/${publicUserID}`);
    }
    expect(screen.queryByRole("link", { name: /#7/ })).not.toBeInTheDocument();
  });

  it("looks up a gateway id and links the real result to its detail page", async () => {
    const result = {
      id: 51,
      order_id: 9,
      amount: "450000",
      currency: "IRT",
      status: "succeeded",
      payment_method: "gateway",
      transaction_id: "gateway-51",
      created_at: "2026-07-29T12:00:00Z",
    };
    mocks.list.mockReturnValue({
      data: { results: [], pagination },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.lookup.mockImplementation((id: string) =>
      id ? { ...idleLookup, data: result } : idleLookup,
    );

    render(<PaymentsBoard />);
    fireEvent.change(screen.getByLabelText("شناسهٔ تراکنش درگاه"), {
      target: { value: "gateway-51" },
    });
    fireEvent.click(screen.getByRole("button", { name: "جستجو" }));

    await waitFor(() =>
      expect(mocks.lookup).toHaveBeenCalledWith("gateway-51", true),
    );
    expect(
      screen.getByRole("link", { name: /مشاهدهٔ جزئیات/ }),
    ).toHaveAttribute("href", "/admin/payments/51");
  });
});
