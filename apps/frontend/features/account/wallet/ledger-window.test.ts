import { describe, expect, it } from "vitest";

import { faNum } from "@/lib/products";
import type { WalletTransaction } from "@/features/wallet/types";

import {
  dayBound,
  filterLedgerPage,
  isPartialLedgerWindow,
  ledgerCountLabel,
  ledgerWindowLabel,
  monthSummaryFromRows,
} from "./ledger-window";

function tx(
  over: Partial<WalletTransaction> &
    Pick<WalletTransaction, "id" | "type" | "amount" | "created_at">,
): WalletTransaction {
  return {
    status: "completed",
    ...over,
  };
}

const now = new Date("2026-08-16T12:00:00.000Z");

describe("dayBound", () => {
  it("returns null for an empty value", () => {
    expect(dayBound("")).toBeNull();
    expect(dayBound("", true)).toBeNull();
  });

  it("parses start and end of an ISO date", () => {
    expect(dayBound("2026-08-16")).toBe(
      new Date("2026-08-16T00:00:00.000").getTime(),
    );
    expect(dayBound("2026-08-16", true)).toBe(
      new Date("2026-08-16T23:59:59.999").getTime(),
    );
  });
});

describe("filterLedgerPage", () => {
  const rows = [
    tx({
      id: 1,
      type: "deposit",
      amount: "10000",
      created_at: "2026-08-10T10:00:00.000Z",
    }),
    tx({
      id: 2,
      type: "purchase",
      amount: "4000",
      created_at: "2026-08-12T10:00:00.000Z",
    }),
    tx({
      id: 3,
      type: "refund",
      amount: "2000",
      created_at: "2026-07-01T10:00:00.000Z",
    }),
  ];

  it("keeps credit types only", () => {
    expect(
      filterLedgerPage(rows, { direction: "credit", from: "", to: "" }).map(
        (row) => row.id,
      ),
    ).toEqual([1, 3]);
  });

  it("keeps debit types only", () => {
    expect(
      filterLedgerPage(rows, { direction: "debit", from: "", to: "" }).map(
        (row) => row.id,
      ),
    ).toEqual([2]);
  });

  it("clips the loaded page to the date range", () => {
    expect(
      filterLedgerPage(rows, {
        direction: "all",
        from: "2026-08-11",
        to: "2026-08-12",
      }).map((row) => row.id),
    ).toEqual([2]);
  });
});

describe("monthSummaryFromRows", () => {
  it("sums only rows in the given calendar month", () => {
    const summary = monthSummaryFromRows(
      [
        tx({
          id: 1,
          type: "deposit",
          amount: "15000",
          created_at: "2026-08-02T00:00:00.000Z",
        }),
        tx({
          id: 2,
          type: "purchase",
          amount: "3000",
          created_at: "2026-08-15T00:00:00.000Z",
        }),
        tx({
          id: 3,
          type: "refund",
          amount: "9000",
          created_at: "2026-07-15T12:00:00.000Z",
        }),
      ],
      now,
    );
    expect(summary).toEqual({ credited: 15000, spent: 3000 });
  });

  it("does not invent totals for rows that were never loaded", () => {
    const summary = monthSummaryFromRows(
      [
        tx({
          id: 1,
          type: "deposit",
          amount: "1000",
          created_at: "2026-08-01T00:00:00.000Z",
        }),
      ],
      now,
    );
    expect(summary.credited).toBe(1000);
    expect(summary.spent).toBe(0);
  });
});

describe("ledger window labels", () => {
  it("labels a single loaded page without implying more rows", () => {
    expect(ledgerWindowLabel(undefined)).toBe("این صفحه");
    expect(
      ledgerWindowLabel({ page: 1, total_pages: 1 }),
    ).toBe("این صفحه");
    expect(
      isPartialLedgerWindow({
        page: 1,
        limit: 20,
        total_items: 4,
        total_pages: 1,
      }),
    ).toBe(false);
  });

  it("names the server page when the ledger is longer than one fetch", () => {
    expect(
      ledgerWindowLabel({ page: 2, total_pages: 5 }),
    ).toBe(`صفحهٔ ${faNum(2)} از ${faNum(5)}`);
    expect(
      isPartialLedgerWindow({
        page: 1,
        limit: 20,
        total_items: 25,
        total_pages: 2,
      }),
    ).toBe(true);
  });

  it("uses the server total unless a page-local filter is on", () => {
    expect(
      ledgerCountLabel({
        hasActiveFilter: false,
        rowCount: 8,
        loadedCount: 8,
        ledgerTotal: 25,
        safePage: 1,
        totalPages: 2,
      }),
    ).toBe(`${faNum(25)} تراکنش · صفحهٔ ${faNum(1)} از ${faNum(2)}`);

    expect(
      ledgerCountLabel({
        hasActiveFilter: true,
        rowCount: 2,
        loadedCount: 8,
        ledgerTotal: 25,
        safePage: 1,
        totalPages: 2,
      }),
    ).toBe(
      `${faNum(2)} از ${faNum(8)} تراکنش این صفحه · صفحهٔ ${faNum(1)} از ${faNum(2)}`,
    );
  });
});
