import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  listLoyaltyMembers: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
  usePathname: () => "/admin/loyalty",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../api/server", () => ({
  listLoyaltyMembers: mocks.listLoyaltyMembers,
}));

import { LoyaltyMembersFilters } from "./loyalty-members-filters";
import {
  LoyaltyMembersTable,
  membersPageHref,
} from "./loyalty-members-view";

const member = {
  user_id: "8b5948a0-d150-4c78-86cd-d16e63da940d",
  email: "jane@example.com",
  display_name: "جین دو",
  points_balance: 1200,
  lifetime_points: 3500,
  tier: "silver" as const,
  updated_at: "2026-08-16T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLoyaltyMembers.mockResolvedValue({
    results: [member],
    pagination: {
      page: 2,
      limit: 20,
      total_items: 41,
      total_pages: 3,
      has_next: true,
      has_prev: true,
    },
  });
});

describe("admin loyalty member search", () => {
  // The bar no longer posts a GET form: filters apply as you go and the reset
  // link is the only navigation in it (see AdminFilterBar).
  it("renders the search and tier controls with the URL state", () => {
    const markup = renderToStaticMarkup(
      <LoyaltyMembersFilters
        filters={{ query: "jane", page: 1, tier: "silver", sort: "newest" }}
      />,
    );

    expect(markup).toContain("جستجو و فیلتر اعضا");
    expect(markup).toContain('id="loyalty-members-query"');
    expect(markup).toContain("نام، ایمیل یا تلفن");
    expect(markup).toContain("jane");
    expect(markup).toContain('id="loyalty-members-tier"');
    expect(markup).toContain("نقره‌ای");
    expect(markup).toContain('id="loyalty-members-sort"');
    expect(markup).toContain("بیشترین موجودی");
    expect(markup).toContain('href="/admin/loyalty"');
  });

  it("queries members and preserves q/tier across pagination", async () => {
    const filters = {
      query: "jane",
      page: 2,
      tier: "silver" as const,
      sort: "newest" as const,
    };

    const markup = renderToStaticMarkup(
      await LoyaltyMembersTable({ filters }),
    );

    expect(mocks.listLoyaltyMembers).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      q: "jane",
      tier: "silver",
      sortBy: "updated_at",
      orderBy: "desc",
    });
    expect(markup).toContain("جین دو");
    expect(markup).toContain("jane@example.com");
    expect(markup).toContain("نقره‌ای");
    expect(markup).toContain(
      'href="/admin/loyalty/8b5948a0-d150-4c78-86cd-d16e63da940d"',
    );
    expect(markup).toContain(
      'href="/admin/loyalty?q=jane&amp;tier=silver"',
    );
    expect(markup).toContain(
      'href="/admin/loyalty?q=jane&amp;tier=silver&amp;page=3"',
    );
  });

  it("asks the list API for balance sort", async () => {
    await LoyaltyMembersTable({
      filters: { query: "", page: 1, sort: "balance_desc" },
    });
    expect(mocks.listLoyaltyMembers).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      q: undefined,
      tier: undefined,
      sortBy: "points_balance",
      orderBy: "desc",
    });
  });

  it("renders an empty state when search returns no members", async () => {
    mocks.listLoyaltyMembers.mockResolvedValue({
      results: [],
      pagination: {
        page: 1,
        limit: 20,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      },
    });

    const markup = renderToStaticMarkup(
      await LoyaltyMembersTable({
        filters: { query: "missing", page: 1, tier: "gold", sort: "newest" },
      }),
    );

    expect(markup).toContain("عضوی با این فیلترها یافت نشد");
    expect(markup).toContain('href="/admin/loyalty"');
  });

  it("renders a Persian retry card when the members API fails", async () => {
    mocks.listLoyaltyMembers.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(
      await LoyaltyMembersTable({
        filters: { query: "", page: 1, sort: "newest" },
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("دریافت اعضای باشگاه ناموفق بود");
    expect(markup).toContain("تلاش دوباره");
  });

  it.each([401, 403] as const)(
    "rethrows %s so auth/forbidden stay outside the retry card",
    async (status) => {
      const error = new ApiError(status, "FORBIDDEN", "no access");
      mocks.listLoyaltyMembers.mockRejectedValue(error);

      await expect(
        LoyaltyMembersTable({ filters: { query: "", page: 1, sort: "newest" } }),
      ).rejects.toBe(error);
    },
  );

  it("builds list hrefs with q, tier, sort, and page", () => {
    expect(
      membersPageHref({ query: "jane", page: 1, tier: "gold", sort: "newest" }, 1),
    ).toBe("/admin/loyalty?q=jane&tier=gold");
    expect(
      membersPageHref(
        { query: "jane", page: 1, tier: "gold", sort: "balance_desc" },
        3,
      ),
    ).toBe("/admin/loyalty?q=jane&tier=gold&sort=balance_desc&page=3");
  });
});