import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  getAdminUserAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/features/customers/api", () => ({
  getAdminUser: mocks.getAdminUser,
  getAdminUserAudit: mocks.getAdminUserAudit,
}));

import { CustomerDetailView } from "./customer-detail-view";

const user = {
  user_id: "user-2",
  first_name: "مینا",
  last_name: "رحیمی",
  email: "mina@example.com",
  role: "vendor" as const,
  is_active: true,
  is_banned: false,
  created_at: "2026-07-20T10:00:00Z",
  updated_at: "2026-07-21T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminUser.mockResolvedValue(user);
  mocks.getAdminUserAudit.mockResolvedValue({
    results: [],
    pagination: {
      page: 1,
      limit: 20,
      total_items: 0,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  });
});

describe("CustomerDetailView write affordances", () => {
  it("hides edit, deactivate, and wallet credit without the matching caps", async () => {
    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: false,
      }),
    );

    expect(markup).toContain("مینا رحیمی");
    expect(markup).not.toContain("ویرایش کاربر");
    expect(markup).not.toContain("/admin/customers/user-2/edit");
    expect(markup).not.toContain("غیرفعال‌کردن حساب");
    expect(markup).not.toContain("مسدود کردن حساب");
    expect(markup).not.toContain("رفع مسدودی");
    expect(markup).not.toContain("wallet-credit-form");
  });

  it("shows edit and deactivate when the operator has customers:write", async () => {
    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: true,
        canCreditWallet: false,
      }),
    );

    expect(markup).toContain("ویرایش کاربر");
    expect(markup).toContain('href="/admin/customers/user-2/edit"');
    expect(markup).toContain("غیرفعال‌کردن حساب");
    expect(markup).not.toContain("مسدود کردن حساب");
    expect(markup).not.toContain("wallet-credit-form");
  });

  it("shows wallet credit only with wallet:credit, not customers:write", async () => {
    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: true,
      }),
    );

    expect(markup).toContain("wallet-credit-form");
    expect(markup).toContain("افزایش موجودی کیف پول");
    expect(markup).not.toContain("ویرایش کاربر");
    expect(markup).not.toContain("غیرفعال‌کردن حساب");
    expect(markup).not.toContain("مسدود کردن حساب");
  });

  it("shows ban without customers:write when the operator has customers:ban", async () => {
    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: false,
        canBan: true,
      }),
    );

    expect(markup).toContain("مسدود کردن حساب");
    expect(markup).not.toContain("ویرایش کاربر");
    expect(markup).not.toContain("غیرفعال‌کردن حساب");
    expect(markup).not.toContain("wallet-credit-form");
  });

  it("offers unban for a banned account when the operator has customers:ban", async () => {
    mocks.getAdminUser.mockResolvedValue({ ...user, is_banned: true });

    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: false,
        canBan: true,
      }),
    );

    expect(markup).toContain("رفع مسدودی");
    expect(markup).toContain(
      "رفع مسدودی در همین صفحه و پس از تأیید انجام می‌شود",
    );
    expect(markup).not.toContain("قرارداد فعلی");
    expect(markup).not.toContain("مسدود کردن حساب");
  });
});
