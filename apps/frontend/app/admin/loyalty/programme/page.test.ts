import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  getLoyaltyProgramme: vi.fn(),
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  view: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/loyalty/components/loyalty-programme-view", () => ({
  LoyaltyProgrammeView: mocks.view,
}));
vi.mock("@/features/admin/loyalty/api/server", () => ({
  getLoyaltyProgramme: mocks.getLoyaltyProgramme,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import AdminLoyaltyProgrammePage from "./page";

const programme = {
  config_source: "env",
  editable: false,
  earn_divisor: 100000,
  redeem_value: 1000,
  signup_bonus: 100,
  enabled: true,
  review_bonus: 50,
  birthday_bonus: 200,
  birthday_tz: "Asia/Tehran",
  referral_reward: 150,
  tiers: [{ id: "bronze", min_lifetime_points: 0 }],
  runbook: "rates persist in loyalty_programme; PUT /admin/loyalty/programme",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({
    role: "admin",
    permissions: [PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.CUSTOMERS_WRITE],
  });
  mocks.getLoyaltyProgramme.mockResolvedValue(programme);
});

describe("admin loyalty programme route", () => {
  it("requires customers:read then renders the live programme only", async () => {
    const element = await AdminLoyaltyProgrammePage();
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.CUSTOMERS_READ,
    );
    expect(mocks.getLoyaltyProgramme).toHaveBeenCalledOnce();
    expect(children[0].type).toBe(mocks.view);
    expect(children[0].props).toEqual({ programme, canWrite: true });

    const markup = renderToStaticMarkup(element);
    expect(markup).toContain("برنامهٔ باشگاه");
    expect(markup).toContain('href="/admin/loyalty"');
  });

  it("does not fetch the programme when the permission guard rejects", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AdminLoyaltyProgrammePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.getLoyaltyProgramme).not.toHaveBeenCalled();
    expect(mocks.view).not.toHaveBeenCalled();
  });

  it("renders a Persian retry state when the programme fetch fails", async () => {
    mocks.getLoyaltyProgramme.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(await AdminLoyaltyProgrammePage());

    expect(mocks.view).not.toHaveBeenCalled();
    expect(markup).toContain("برنامهٔ باشگاه");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("بارگذاری برنامهٔ باشگاه ناموفق بود");
    expect(markup).toContain("نرخ‌ها و سطوح امتیاز از سرور دریافت نشد");
    expect(markup).toContain("تلاش دوباره");
  });

  it("renders the retry state for a 500 from the programme API", async () => {
    mocks.getLoyaltyProgramme.mockRejectedValue(
      new ApiError(500, "INTERNAL", "boom"),
    );

    const markup = renderToStaticMarkup(await AdminLoyaltyProgrammePage());

    expect(mocks.view).not.toHaveBeenCalled();
    expect(markup).toContain("بارگذاری برنامهٔ باشگاه ناموفق بود");
  });

  it.each([401, 403] as const)(
    "rethrows %s so auth/forbidden stay outside the retry card",
    async (status) => {
      const error = new ApiError(status, "FORBIDDEN", "no access");
      mocks.getLoyaltyProgramme.mockRejectedValue(error);

      await expect(AdminLoyaltyProgrammePage()).rejects.toBe(error);
      expect(mocks.view).not.toHaveBeenCalled();
    },
  );

  it("withholds the editor from a session without customers:write", async () => {
    mocks.requirePermission.mockResolvedValue({
      role: "staff",
      permissions: [PERMISSIONS.CUSTOMERS_READ],
    });

    const element = await AdminLoyaltyProgrammePage();
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];

    expect(children[0].props).toEqual({ programme, canWrite: false });
  });
});
