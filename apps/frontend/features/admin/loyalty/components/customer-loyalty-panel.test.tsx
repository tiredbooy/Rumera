import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  getLoyaltyMember: vi.fn(),
  listLoyaltyMemberTransactions: vi.fn(),
  isLoyaltyEnabled: vi.fn(),
  canAdjustLoyalty: vi.fn(),
  adjustForm: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
// AdminDataErrorState is a client retry button — it wants a mounted router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../api/server", () => ({
  getLoyaltyMember: mocks.getLoyaltyMember,
  listLoyaltyMemberTransactions: mocks.listLoyaltyMemberTransactions,
}));
vi.mock("../guard", () => ({
  isLoyaltyEnabled: mocks.isLoyaltyEnabled,
  canAdjustLoyalty: mocks.canAdjustLoyalty,
}));
vi.mock("./loyalty-adjust-form", () => ({
  LoyaltyAdjustForm: mocks.adjustForm,
}));

import { CustomerLoyaltyStanding } from "./customer-loyalty-panel";

const userID = "8b5948a0-d150-4c78-86cd-d16e63da940d";

const page = <T,>(results: T[]) => ({
  results,
  pagination: {
    page: 1,
    limit: 5,
    total_items: results.length,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  },
});

const render = async () =>
  renderToStaticMarkup(await CustomerLoyaltyStanding({ userID }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoyaltyEnabled.mockResolvedValue(true);
  mocks.canAdjustLoyalty.mockResolvedValue(false);
  mocks.getLoyaltyMember.mockResolvedValue({
    user_id: userID,
    email: "jane@example.com",
    display_name: "جین دو",
    points_balance: 1200,
    lifetime_points: 3500,
    tier: "silver",
    next_tier: "gold",
    points_to_next: 1500,
    updated_at: "2026-08-16T10:00:00Z",
  });
  mocks.listLoyaltyMemberTransactions.mockResolvedValue(
    page([
      {
        id: 9,
        delta: 50,
        reason: "admin_adjust",
        ref_type: "admin",
        ref_id: "key-9",
        note: "جبران تأخیر ارسال",
        actor_user_id: "3f1c2d4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        actor_label: "سارا مرادی",
        created_at: "2026-08-16T09:00:00Z",
      },
    ]),
  );
});

describe("embeddable customer loyalty widget", () => {
  it("shows standing and recent activity from its own reads", async () => {
    const markup = await render();

    expect(markup).toContain("باشگاه مشتریان");
    expect(markup).toContain("۱٬۲۰۰");
    expect(markup).toContain("نقره‌ای");
    expect(markup).toContain("تنظیم توسط پشتیبانی");
    // L-4: the ledger answers "who granted this and why" here too.
    expect(markup).toContain("جبران تأخیر ارسال");
    expect(markup).toContain("سارا مرادی");
    expect(markup).toContain(`/admin/loyalty/${userID}`);
  });

  // L-2: switched off means gone, not broken.
  it("disappears while the kill switch is off", async () => {
    mocks.isLoyaltyEnabled.mockResolvedValue(false);

    expect(await render()).toBe("");
  });

  // L-8: minting points is a separate grant from reading the customer file.
  it("offers the mint control only with loyalty:adjust", async () => {
    await render();
    expect(mocks.adjustForm).not.toHaveBeenCalled();

    mocks.canAdjustLoyalty.mockResolvedValue(true);
    await render();
    expect(mocks.adjustForm).toHaveBeenCalledOnce();
  });

  it("keeps the standing when only the ledger read fails", async () => {
    mocks.listLoyaltyMemberTransactions.mockRejectedValue(new Error("offline"));

    const markup = await render();
    expect(markup).toContain("۱٬۲۰۰");
    expect(markup).toContain("دریافت دفتر کل ناموفق بود");
  });

  // An embed must never take its host down.
  it.each([400, 401, 403, 404, 422])(
    "renders nothing when the member read answers %s",
    async (status) => {
      mocks.getLoyaltyMember.mockRejectedValue(
        new ApiError(status, "NOPE", "no"),
      );

      expect(await render()).toBe("");
    },
  );

  it("degrades to an error state when the member read breaks", async () => {
    mocks.getLoyaltyMember.mockRejectedValue(
      new ApiError(500, "INTERNAL", "boom"),
    );

    const markup = await render();
    expect(markup).toContain("دریافت وضعیت باشگاه ناموفق بود");
  });
});
