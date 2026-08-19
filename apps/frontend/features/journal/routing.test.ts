import { describe, expect, it } from "vitest";

import {
  JOURNAL_SEARCH_MAX_LENGTH,
  journalPageHref,
  journalRedirectHref,
  parseJournalPage,
  parseJournalRouteQuery,
} from "./routing";

describe("journal routing", () => {
  it("accepts only canonical positive safe-integer pages", () => {
    expect(parseJournalPage(undefined)).toBe(1);
    expect(parseJournalPage("2")).toBe(2);
    expect(parseJournalPage(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );

    for (const value of [
      "",
      "0",
      "-1",
      "1.5",
      "1e2",
      "01",
      " 2",
      ["1", "2"],
      String(Number.MAX_SAFE_INTEGER + 1),
    ]) {
      expect(parseJournalPage(value)).toBeNull();
    }
  });

  it("maps only supported sort modes and omits the default from canonical URLs", () => {
    expect(parseJournalRouteQuery({})).toMatchObject({
      page: 1,
      sort: "new",
      sortBy: "published_at",
      orderBy: "desc",
      needsRedirect: false,
    });
    expect(parseJournalRouteQuery({ sort: "popular" })).toMatchObject({
      sortBy: "total_reads",
      orderBy: "desc",
      needsRedirect: false,
    });
    for (const sort of ["new", "price", "", ["new", "popular"]]) {
      expect(parseJournalRouteQuery({ sort })).toMatchObject({
        sort: "new",
        needsRedirect: true,
      });
    }
  });

  it("trims and bounds search while removing ambiguous or unknown state", () => {
    expect(parseJournalRouteQuery({ q: "  مالت  " })).toMatchObject({
      q: "مالت",
      needsRedirect: true,
    });
    expect(parseJournalRouteQuery({ q: ["الف", "ب"] })).toMatchObject({
      q: undefined,
      needsRedirect: true,
    });
    expect(parseJournalRouteQuery({ q: "" })).toMatchObject({
      q: undefined,
      needsRedirect: true,
    });
    // U-4: a campaign param is not a malformed URL. It rides along instead of
    // triggering a redirect that would strip it before analytics ever saw it.
    expect(parseJournalRouteQuery({ campaign: "x" }).needsRedirect).toBe(false);

    const campaign = parseJournalRouteQuery({ page: "1", utm_source: "ig" });
    expect(campaign.needsRedirect).toBe(true);
    expect(journalRedirectHref(campaign, campaign.page)).toContain(
      "utm_source=ig",
    );
    expect(journalPageHref(campaign, 2)).not.toContain("utm_source");

    const parsed = parseJournalRouteQuery({
      q: "آ".repeat(JOURNAL_SEARCH_MAX_LENGTH + 3),
    });
    expect(Array.from(parsed.q ?? "")).toHaveLength(JOURNAL_SEARCH_MAX_LENGTH);
  });

  it("preserves canonical filters through anchored pagination", () => {
    const query = parseJournalRouteQuery({
      q: "تک مالت",
      sort: "popular",
      page: "3",
    });
    const filters = new URLSearchParams({
      q: "تک مالت",
      sort: "popular",
      page: "4",
    }).toString();

    expect(journalPageHref(query, 4, "journal-results-title")).toBe(
      `/journal?${filters}#journal-results-title`,
    );
    expect(journalPageHref({ sort: "new" }, 1)).toBe("/journal");
  });
});
