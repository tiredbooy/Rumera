import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLoyaltyMember: vi.fn(),
  getLoyaltyProgramme: vi.fn(),
  adjustForm: vi.fn(() => null),
  ledger: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../api/server", () => ({
  getLoyaltyMember: mocks.getLoyaltyMember,
  getLoyaltyProgramme: mocks.getLoyaltyProgramme,
}));
vi.mock("./loyalty-adjust-form", () => ({
  LoyaltyAdjustForm: mocks.adjustForm,
}));
vi.mock("./loyalty-member-ledger", () => ({
  LoyaltyMemberLedger: mocks.ledger,
  LoyaltyLedgerSkeleton: () => null,
}));

import { LoyaltyMemberDetailView } from "./loyalty-member-detail-view";

const userID = "8b5948a0-d150-4c78-86cd-d16e63da940d";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLoyaltyProgramme.mockResolvedValue({ enabled: true });
  mocks.getLoyaltyMember.mockResolvedValue({
    user_id: userID,
    email: "jane@example.com",
    display_name: "جین دو",
    points_balance: 1200,
    lifetime_points: 3500,
    tier: "silver",
    points_to_next: 1500,
    updated_at: "2026-08-16T10:00:00Z",
  });
});

describe("admin loyalty member detail", () => {
  // L-2: the mint surface is the one that must not survive the kill switch.
  it("closes the member screen when the kill switch is off", async () => {
    mocks.getLoyaltyProgramme.mockResolvedValue({ enabled: false });

    await expect(
      LoyaltyMemberDetailView({ userID, ledgerPage: 1, canAdjust: true }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.getLoyaltyMember).not.toHaveBeenCalled();
  });

  it("offers the adjust form only with the loyalty grant", async () => {
    renderToStaticMarkup(
      await LoyaltyMemberDetailView({ userID, ledgerPage: 1, canAdjust: true }),
    );
    expect(mocks.adjustForm).toHaveBeenCalledOnce();

    mocks.adjustForm.mockClear();
    const markup = renderToStaticMarkup(
      await LoyaltyMemberDetailView({ userID, ledgerPage: 1, canAdjust: false }),
    );
    expect(mocks.adjustForm).not.toHaveBeenCalled();
    expect(markup).toContain("تنظیم امتیاز باشگاه");
  });
});
