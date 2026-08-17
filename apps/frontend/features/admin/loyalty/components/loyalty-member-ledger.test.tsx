import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLoyaltyMemberTransactions: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () =>
    "/admin/loyalty/8b5948a0-d150-4c78-86cd-d16e63da940d",
  useSearchParams: () => new URLSearchParams("reason=order_paid"),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../api/server", () => ({
  listLoyaltyMemberTransactions: mocks.listLoyaltyMemberTransactions,
}));

import {
  LoyaltyMemberLedger,
  LoyaltyMemberLedgerView,
  memberLedgerHref,
} from "./loyalty-member-ledger";

const userID = "8b5948a0-d150-4c78-86cd-d16e63da940d";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loyalty member ledger reason filter", () => {
  it("forwards reason to the list API and keeps it on pager links", async () => {
    mocks.listLoyaltyMemberTransactions.mockResolvedValue({
      results: [
        {
          id: 9,
          delta: 40,
          reason: "order_paid",
          ref_type: "order",
          ref_id: "12",
          created_at: "2026-08-16T10:00:00Z",
        },
      ],
      pagination: {
        page: 2,
        limit: 20,
        total_items: 21,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      },
    });

    const markup = renderToStaticMarkup(
      await LoyaltyMemberLedger({
        userID,
        page: 2,
        reason: "order_paid",
      }),
    );

    expect(mocks.listLoyaltyMemberTransactions).toHaveBeenCalledWith(userID, {
      page: 2,
      limit: 20,
      reason: "order_paid",
    });
    expect(markup).toContain("امتیاز خرید");
    expect(markup).toContain('id="loyalty-ledger-reason"');
    expect(markup).toContain(
      `href="/admin/loyalty/${userID}?reason=order_paid"`,
    );
  });

  it("splits a filtered miss from an empty ledger", () => {
    const empty = {
      page: 1,
      limit: 20,
      total_items: 0,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };

    expect(
      renderToStaticMarkup(
        <LoyaltyMemberLedgerView
          userID={userID}
          reason="admin_adjust"
          transactions={[]}
          pagination={empty}
        />,
      ),
    ).toContain("ردیفی با این علت نیست");

    expect(
      renderToStaticMarkup(
        <LoyaltyMemberLedgerView
          userID={userID}
          transactions={[]}
          pagination={empty}
        />,
      ),
    ).toContain("هنوز ردیفی در دفتر کل نیست");
  });

  it("builds ledger hrefs with reason and page", () => {
    expect(memberLedgerHref(userID, 1)).toBe(`/admin/loyalty/${userID}`);
    expect(memberLedgerHref(userID, 1, "order_paid")).toBe(
      `/admin/loyalty/${userID}?reason=order_paid`,
    );
    expect(memberLedgerHref(userID, 3, "order_paid")).toBe(
      `/admin/loyalty/${userID}?reason=order_paid&page=3`,
    );
  });
});
