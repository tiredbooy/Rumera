import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  getLoyaltyProgramme: vi.fn(),
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  members: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/loyalty/components/loyalty-members-view", () => ({
  LoyaltyMembersView: mocks.members,
}));
vi.mock("@/features/admin/loyalty/api/server", () => ({
  getLoyaltyProgramme: mocks.getLoyaltyProgramme,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import AdminLoyaltyPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({
    role: "admin",
    permissions: [PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.CUSTOMERS_WRITE],
  });
});

const emptySearch = { searchParams: Promise.resolve({}) };

describe("admin loyalty members route", () => {
  it("requires customers:read then renders members without the programme editor", async () => {
    const element = await AdminLoyaltyPage(emptySearch);
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.CUSTOMERS_READ,
    );
    expect(mocks.getLoyaltyProgramme).not.toHaveBeenCalled();
    expect(children[0].type).toBe(mocks.members);
    expect(children[0].props).toEqual({ searchParams: {} });

    const markup = renderToStaticMarkup(element);
    expect(markup).toContain("باشگاه مشتریان");
    expect(markup).toContain('href="/admin/loyalty/programme"');
    expect(markup).toContain("تنظیمات برنامه");
  });

  it("does not render members when the permission guard rejects", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AdminLoyaltyPage(emptySearch)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.members).not.toHaveBeenCalled();
  });
});
