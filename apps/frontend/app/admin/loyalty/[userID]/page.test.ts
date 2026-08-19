import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  view: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock(
  "@/features/admin/loyalty/components/loyalty-member-detail-view",
  () => ({
    LoyaltyMemberDetailView: mocks.view,
  }),
);
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminLoyaltyMemberPage from "./page";

const userID = "8b5948a0-d150-4c78-86cd-d16e63da940d";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ role: "admin" });
  mocks.can.mockReturnValue(true);
});

describe("admin loyalty member route", () => {
  it("requires customers:read and passes the loyalty grant to the detail view", async () => {
    const element = await AdminLoyaltyMemberPage({
      params: Promise.resolve({ userID }),
      searchParams: Promise.resolve({ page: "2" }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.CUSTOMERS_READ,
    );
    // L-8: minting rides loyalty:adjust, never customers:write.
    expect(mocks.can).toHaveBeenCalledWith(
      { role: "admin" },
      PERMISSIONS.LOYALTY_ADJUST,
    );
    expect(mocks.can).not.toHaveBeenCalledWith(
      expect.anything(),
      PERMISSIONS.CUSTOMERS_WRITE,
    );
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      userID,
      ledgerPage: 2,
      ledgerReason: undefined,
      canAdjust: true,
    });
  });

  it("forwards a valid ledger reason filter", async () => {
    const element = await AdminLoyaltyMemberPage({
      params: Promise.resolve({ userID }),
      searchParams: Promise.resolve({ reason: "order_paid", page: "2" }),
    });

    expect(element.props).toMatchObject({
      userID,
      ledgerPage: 2,
      ledgerReason: "order_paid",
    });
  });

  it("hides adjust when the operator lacks loyalty:adjust", async () => {
    mocks.can.mockReturnValue(false);

    const element = await AdminLoyaltyMemberPage({
      params: Promise.resolve({ userID }),
      searchParams: Promise.resolve({}),
    });

    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      userID,
      ledgerPage: 1,
      ledgerReason: undefined,
      canAdjust: false,
    });
  });

  it("404s a non-UUID member path", async () => {
    await expect(
      AdminLoyaltyMemberPage({
        params: Promise.resolve({ userID: "../roles" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.view).not.toHaveBeenCalled();
  });
});