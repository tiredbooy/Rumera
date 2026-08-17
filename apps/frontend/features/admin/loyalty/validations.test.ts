import { describe, expect, it } from "vitest";

import {
  parseLoyaltyLedgerFilters,
  parseLoyaltyLedgerPage,
  parseLoyaltyMemberFilters,
  parseLoyaltyMemberUserID,
  toLoyaltyMemberListQuery,
} from "./validations";

describe("loyalty admin search params", () => {
  it("parses q, tier, sort, and page", () => {
    expect(
      parseLoyaltyMemberFilters({
        q: "  jane ",
        tier: "silver",
        sort: "balance_desc",
        page: "3",
      }),
    ).toEqual({
      query: "jane",
      page: 3,
      tier: "silver",
      sort: "balance_desc",
    });
  });

  it("normalizes Persian digits so a phone paste matches the store", () => {
    expect(
      parseLoyaltyMemberFilters({ q: "۰۹۱۲۱۲۳۴۵۶۷" }).query,
    ).toBe("09121234567");
  });

  it("drops unknown tiers, sorts, and non-positive pages", () => {
    expect(
      parseLoyaltyMemberFilters({
        q: "x",
        tier: "all",
        sort: "popular",
        page: "0",
      }),
    ).toEqual({ query: "x", page: 1, tier: undefined, sort: "newest" });
  });

  it("maps UI sort keys onto the members query", () => {
    expect(
      toLoyaltyMemberListQuery(
        { query: "0912", page: 1, sort: "balance_desc" },
        20,
      ),
    ).toEqual({
      page: 1,
      limit: 20,
      q: "0912",
      sortBy: "points_balance",
      orderBy: "desc",
    });
  });

  it("parses the ledger page", () => {
    expect(parseLoyaltyLedgerPage({ page: "4" })).toBe(4);
    expect(parseLoyaltyLedgerPage({})).toBe(1);
  });

  it("parses a known ledger reason and drops unknown ones", () => {
    expect(
      parseLoyaltyLedgerFilters({ reason: "order_paid", page: "2" }),
    ).toEqual({ page: 2, reason: "order_paid" });
    expect(parseLoyaltyLedgerFilters({ reason: "mystery" })).toEqual({
      page: 1,
      reason: undefined,
    });
  });
});

describe("parseLoyaltyMemberUserID", () => {
  it("accepts a UUID and rejects non-UUID paths", () => {
    expect(
      parseLoyaltyMemberUserID("8b5948a0-d150-4c78-86cd-d16e63da940d"),
    ).toBe("8b5948a0-d150-4c78-86cd-d16e63da940d");
    expect(parseLoyaltyMemberUserID("../roles")).toBeNull();
    expect(parseLoyaltyMemberUserID("not-a-uuid")).toBeNull();
  });
});