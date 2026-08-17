// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { faNum } from "@/lib/products";
import type { Paginated } from "@/lib/api/types";
import type {
  Wallet,
  WalletTransaction,
  WalletTransactionQuery,
} from "@/features/wallet/types";

import { WALLET_LEDGER_PAGE_SIZE } from "../ledger-window";

const mocks = vi.hoisted(() => ({
  wallet: vi.fn(),
  txs: vi.fn(),
  txQuery: vi.fn(),
}));

vi.mock("@/features/wallet/hooks", () => ({
  useWallet: () => mocks.wallet(),
  useWalletTransactions: (query: WalletTransactionQuery) => {
    mocks.txQuery(query);
    return mocks.txs();
  },
}));

vi.mock("@/features/wallet/wallet-topup", () => ({
  WalletTopUp: () => <div data-testid="wallet-topup-stub" />,
}));

vi.mock("@/features/gift-cards/gift-card-purchase", () => ({
  GiftCardPurchase: () => <div data-testid="gift-purchase-stub" />,
}));

vi.mock("@/features/wallet/gift-card-redeem", () => ({
  GiftCardRedeem: () => <div data-testid="gift-redeem-stub" />,
}));

vi.mock("@/features/gift-cards/gift-card-mine", () => ({
  GiftCardMine: () => <div data-testid="gift-mine-stub" />,
}));

import { WalletView } from "./wallet-view";

function wallet(over: Partial<Wallet> = {}): Wallet {
  return {
    id: 1,
    balance: "50000",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
    ...over,
  };
}

function tx(
  over: Partial<WalletTransaction> & Pick<WalletTransaction, "id">,
): WalletTransaction {
  return {
    amount: "10000",
    type: "deposit",
    status: "completed",
    created_at: "2026-08-16T10:00:00Z",
    ...over,
  };
}

function pageOf(
  results: WalletTransaction[],
  pagination: Partial<Paginated<WalletTransaction>["pagination"]> = {},
): Paginated<WalletTransaction> {
  return {
    results,
    pagination: {
      page: 1,
      limit: WALLET_LEDGER_PAGE_SIZE,
      total_items: results.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
      ...pagination,
    },
  };
}

function readyWallet() {
  return {
    data: wallet(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function readyTxs(data: Paginated<WalletTransaction>) {
  return {
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function renderView(searchParams = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <WalletView />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallet.mockReturnValue(readyWallet());
  mocks.txs.mockReturnValue(readyTxs(pageOf([])));
});

describe("WalletView ledger pagination (PR-035c)", () => {
  it("asks GET /wallet/transactions for the URL page and server limit", () => {
    mocks.txs.mockReturnValue(
      readyTxs(
        pageOf([tx({ id: 1 })], {
          page: 2,
          total_items: 25,
          total_pages: 2,
          has_next: false,
          has_prev: true,
        }),
      ),
    );

    renderView("?page=2");

    expect(mocks.txQuery).toHaveBeenCalledWith({
      page: 2,
      limit: WALLET_LEDGER_PAGE_SIZE,
    });
    expect(mocks.txQuery).not.toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("pages on the server instead of slicing a 100-row client window", async () => {
    mocks.txs.mockReturnValue(
      readyTxs(
        pageOf([tx({ id: 11, description: "صفحه یک" })], {
          page: 1,
          total_items: 25,
          total_pages: 2,
          has_next: true,
          has_prev: false,
        }),
      ),
    );

    renderView();

    expect(screen.getByText("صفحه یک")).toBeInTheDocument();
    expect(
      screen.getByText(
        `${faNum(25)} تراکنش · صفحهٔ ${faNum(1)} از ${faNum(2)}`,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /بعدی/ }));

    await waitFor(() => {
      expect(mocks.txQuery).toHaveBeenCalledWith({
        page: 2,
        limit: WALLET_LEDGER_PAGE_SIZE,
      });
    });
  });

  it("labels the month summary as the loaded page, not the whole month", () => {
    mocks.txs.mockReturnValue(
      readyTxs(
        pageOf(
          [
            tx({
              id: 1,
              type: "deposit",
              amount: "15000",
              created_at: "2026-08-02T00:00:00Z",
            }),
            tx({
              id: 2,
              type: "purchase",
              amount: "3000",
              created_at: "2026-08-15T00:00:00Z",
            }),
          ],
          {
            page: 1,
            total_items: 40,
            total_pages: 2,
            has_next: true,
          },
        ),
      ),
    );

    renderView();

    expect(
      screen.getByText(`واریزی این ماه · صفحهٔ ${faNum(1)} از ${faNum(2)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`هزینهٔ این ماه · صفحهٔ ${faNum(1)} از ${faNum(2)}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText((_, node) => node?.textContent === "واریزی این ماه"),
    ).not.toBeInTheDocument();
  });

  it("does not treat a client filter as the ledger total", () => {
    mocks.txs.mockReturnValue(
      readyTxs(
        pageOf(
          [
            tx({ id: 1, type: "deposit", description: "واریز" }),
            tx({
              id: 2,
              type: "purchase",
              amount: "4000",
              description: "خرید",
            }),
          ],
          {
            page: 1,
            total_items: 25,
            total_pages: 2,
            has_next: true,
          },
        ),
      ),
    );

    renderView("?dir=credit");

    expect(screen.getByText("واریز")).toBeInTheDocument();
    expect(screen.queryByText("خرید")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        `${faNum(1)} از ${faNum(2)} تراکنش این صفحه · صفحهٔ ${faNum(1)} از ${faNum(2)}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`${faNum(1)} تراکنش · صفحهٔ ${faNum(1)} از ${faNum(2)}`),
    ).not.toBeInTheDocument();
  });
});
