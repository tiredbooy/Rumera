import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getLoyaltyOverview: vi.fn() }));

vi.mock("server-only", () => ({}));
// AdminDataErrorState is a client retry button — it wants a mounted router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../api/server", () => ({
  getLoyaltyOverview: mocks.getLoyaltyOverview,
}));

import { LoyaltyOverviewCards } from "./loyalty-overview";

const overview = {
  enabled: true,
  members: 8,
  points_outstanding: 1000,
  // Fractional Toman — a whole-Toman fixture would still pass if the
  // component rounded through Math.round(Number(...)).
  points_liability: "999499.5",
  redeem_value: 1000.5,
  tiers: [
    { tier: "bronze", members: 6, points_balance: 100 },
    { tier: "silver", members: 0, points_balance: 0 },
    { tier: "gold", members: 2, points_balance: 900 },
    { tier: "cellar", members: 0, points_balance: 0 },
  ],
  birthday: {
    timezone: "Asia/Tehran",
    local_date: "2026-08-18",
    bonus: 200,
    due_today: 3,
    granted_today: 1,
    pending_today: 2,
    granted_this_year: 12,
    last_award_at: "2026-08-17T03:00:00Z",
    status: "pending",
  },
  generated_at: "2026-08-18T09:00:00Z",
};

const render = async () => renderToStaticMarkup(await LoyaltyOverviewCards());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLoyaltyOverview.mockResolvedValue(overview);
});

describe("loyalty programme overview", () => {
  // Liability is money: the fractional Toman must survive to the screen.
  it("renders the exact liability without rounding it", async () => {
    const markup = await render();

    expect(markup).toContain("۹۹۹٬۴۹۹٫۵ تومان");
    expect(markup).not.toContain("۹۹۹٬۵۰۰");
  });

  it("shows every tier, including the empty ones", async () => {
    const markup = await render();

    expect(markup).toContain("برنزی");
    expect(markup).toContain("نقره‌ای");
    expect(markup).toContain("طلایی");
    expect(markup).toContain("سرداب");
  });

  it("flags a birthday cohort the job has not finished", async () => {
    const markup = await render();

    expect(markup).toContain("عقب‌افتاده");
    expect(markup).toContain("۱/۳");
  });

  it.each([
    ["ok", "به‌روز"],
    ["idle", "بدون مورد"],
    ["off", "خاموش"],
  ])("labels birthday status %s", async (status, label) => {
    mocks.getLoyaltyOverview.mockResolvedValue({
      ...overview,
      birthday: { ...overview.birthday, status },
    });

    expect(await render()).toContain(label);
  });

  // The rates screen must survive its own operational read failing.
  it("degrades to an error state without taking the screen down", async () => {
    mocks.getLoyaltyOverview.mockRejectedValue(new Error("offline"));

    const markup = await render();
    expect(markup).toContain("بارگذاری وضعیت عملیاتی ناموفق بود");
  });
});
