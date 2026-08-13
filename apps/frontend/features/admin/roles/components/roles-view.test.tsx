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
    authorization_mode: "role_capabilities",
    admin_roles: ["admin", "staff"],
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
      {
        role: "staff",
        admin_access: true,
        assignable: true,
        member_count: 3,
        active_member_count: 2,
      },
    ],
  });
});

describe("RolesView", () => {
  it("renders the live role+capability policy, member counts, and capability matrix", async () => {
    const markup = renderToStaticMarkup(await RolesView());

    expect(mocks.getAdminRoles).toHaveBeenCalledOnce();
    expect(markup).toContain("مدل نقش + قابلیت فعال است");
    expect(markup).toContain("ماتریس دسترسی پویا");
    expect(markup).toContain("مشتری");
    expect(markup).toContain("فروشنده");
    expect(markup).toContain("مدیر کل");
    expect(markup).toContain("اپراتور");
    expect(markup).toContain("۱۲");
    expect(markup).toContain("۱۰");
    expect(markup).toContain("بدون دسترسی به پنل");
    expect(markup).toContain("ورود به پنل مجاز");
    expect(markup).toContain("products:read");
    expect(markup).not.toMatch(/\bmanager\b|\bsupport\b/i);
  });

  it("shows an error instead of fabricated roles or counts", async () => {
    mocks.getAdminRoles.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(await RolesView());

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("دریافت نقش‌ها ناموفق بود");
    expect(markup).not.toContain("<article");
  });
});
