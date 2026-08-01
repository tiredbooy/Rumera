import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminRoles: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/customers/api", () => ({
  getAdminRoles: mocks.getAdminRoles,
}));

import { RolesView } from "./roles-view";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminRoles.mockResolvedValue({
    authorization_mode: "single_role",
    admin_roles: ["admin"],
    roles: [
      {
        role: "customer",
        admin_access: false,
        assignable: true,
        member_count: 12,
        active_member_count: 10,
      },
      {
        role: "vendor",
        admin_access: false,
        assignable: true,
        member_count: 4,
        active_member_count: 3,
      },
      {
        role: "admin",
        admin_access: true,
        assignable: true,
        member_count: 2,
        active_member_count: 2,
      },
    ],
  });
});

describe("RolesView", () => {
  it("renders the live single-role policy and member counts without a fake matrix", async () => {
    const markup = renderToStaticMarkup(await RolesView());

    expect(mocks.getAdminRoles).toHaveBeenCalledOnce();
    expect(markup).toContain("مدل تک‌نقشی فعال است");
    expect(markup).toContain("مشتری");
    expect(markup).toContain("فروشنده");
    expect(markup).toContain("مدیر کل");
    expect(markup).toContain("۱۲");
    expect(markup).toContain("۱۰");
    expect(markup).toContain("بدون دسترسی به پنل");
    expect(markup).toContain("ورود به پنل مجاز");
    expect(markup).not.toMatch(/manager|support/i);
    expect(markup).not.toContain("مشاهدهٔ محصولات");
  });

  it("shows an error instead of fabricated roles or counts", async () => {
    mocks.getAdminRoles.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(await RolesView());

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("دریافت نقش‌ها ناموفق بود");
    expect(markup).not.toContain("<article");
  });
});
