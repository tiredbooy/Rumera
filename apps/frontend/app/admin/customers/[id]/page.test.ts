import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  can: vi.fn<(...args: unknown[]) => boolean>(() => true),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requirePermission: vi.fn().mockResolvedValue({
    role: "admin",
    user: { id: "actor-1", email: "admin@example.com" },
  }),
  view: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock("@/features/admin/customers/components/customer-detail-view", () => ({
  CustomerDetailView: mocks.view,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminCustomerDetailPage from "./page";

const userID = "8b5948a0-d150-4c78-86cd-d16e63da940d";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({
    role: "admin",
    user: { id: "actor-1", email: "admin@example.com" },
  });
  mocks.can.mockReturnValue(true);
});

describe("admin customer detail route", () => {
  it("requires customers:read and splits write vs wallet:credit", async () => {
    const session = {
      role: "admin",
      user: { id: "actor-1", email: "admin@example.com" },
    };
    mocks.requirePermission.mockResolvedValue(session);
    mocks.can.mockImplementation(
      (...args: unknown[]) => args[1] === PERMISSIONS.CUSTOMERS_WRITE,
    );

    const element = await AdminCustomerDetailPage({
      params: Promise.resolve({ id: userID }),
      searchParams: Promise.resolve({ audit_page: "2" }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.CUSTOMERS_READ,
    );
    expect(mocks.can).toHaveBeenCalledWith(
      session,
      PERMISSIONS.CUSTOMERS_WRITE,
    );
    expect(mocks.can).toHaveBeenCalledWith(session, PERMISSIONS.WALLET_CREDIT);
    expect(mocks.can).toHaveBeenCalledWith(session, PERMISSIONS.CUSTOMERS_BAN);
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      id: userID,
      currentUserId: "actor-1",
      currentUserEmail: "admin@example.com",
      auditPage: 2,
      canWrite: true,
      canCreditWallet: false,
      canBan: false,
    });
  });

  it("forwards wallet credit only when the session has wallet:credit", async () => {
    mocks.can.mockImplementation(
      (...args: unknown[]) => args[1] === PERMISSIONS.WALLET_CREDIT,
    );

    const element = await AdminCustomerDetailPage({
      params: Promise.resolve({ id: userID }),
      searchParams: Promise.resolve({}),
    });

    expect(element.props).toEqual({
      id: userID,
      currentUserId: "actor-1",
      currentUserEmail: "admin@example.com",
      auditPage: 1,
      canWrite: false,
      canCreditWallet: true,
      canBan: false,
    });
  });

  it("forwards ban only when the session has customers:ban", async () => {
    mocks.can.mockImplementation(
      (...args: unknown[]) => args[1] === PERMISSIONS.CUSTOMERS_BAN,
    );

    const element = await AdminCustomerDetailPage({
      params: Promise.resolve({ id: userID }),
      searchParams: Promise.resolve({}),
    });

    expect(element.props).toEqual({
      id: userID,
      currentUserId: "actor-1",
      currentUserEmail: "admin@example.com",
      auditPage: 1,
      canWrite: false,
      canCreditWallet: false,
      canBan: true,
    });
  });

  it("404s a non-UUID customer path", async () => {
    await expect(
      AdminCustomerDetailPage({
        params: Promise.resolve({ id: "../roles" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.view).not.toHaveBeenCalled();
  });
});
