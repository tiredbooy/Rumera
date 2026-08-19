import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  getAdminUserAudit: vi.fn(),
  listAdminOrders: vi.fn(),
  listCustomerWalletTransactions: vi.fn(),
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
  listUsers: vi.fn(),
}));
vi.mock("@/features/orders/api/admin", () => ({
  listAdminOrders: mocks.listAdminOrders,
}));
vi.mock("../api", () => ({
  listCustomerWalletTransactions: mocks.listCustomerWalletTransactions,
}));

import { CustomerDetailView } from "./customer-detail-view";

const page = <T,>(results: T[], total = results.length) => ({
  results,
  pagination: {
    page: 1,
    limit: 20,
    total_items: total,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  },
});

// Public UUID shape: `adminOrdersForUserHref` only links for a real user_id.
const USER_UUID = "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

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
  mocks.getAdminUserAudit.mockResolvedValue(page([]));
  mocks.listAdminOrders.mockResolvedValue(page([]));
  mocks.listCustomerWalletTransactions.mockResolvedValue(page([]));
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

// CF-3. The screen opened when a customer calls used to answer none of the
// questions a customer asks: no orders, no balance, and credit minted with no
// balance in view.
describe("CustomerDetailView commerce panels", () => {
  it("shows orders, balance and ledger for the customer", async () => {
    mocks.getAdminUser.mockResolvedValue({
      ...user,
      user_id: USER_UUID,
      wallet_balance: "125000.00",
    });
    mocks.listAdminOrders.mockResolvedValue(
      page(
        [
          {
            id: 41,
            status: "shipped",
            payment_method: "wallet",
            total_amount: 890000,
            item_count: 3,
            created_at: "2026-08-01T09:00:00Z",
          },
        ],
        7,
      ),
    );
    mocks.listCustomerWalletTransactions.mockResolvedValue(
      page([
        {
          id: 9,
          amount: "890000.00",
          type: "purchase",
          status: "completed",
          reference_order_id: 41,
          created_at: "2026-08-01T09:00:00Z",
        },
      ]),
    );

    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: USER_UUID,
        auditPage: 1,
        canWrite: false,
        canCreditWallet: false,
      }),
    );

    expect(mocks.listAdminOrders).toHaveBeenCalledWith(
      expect.objectContaining({ user_uuid: USER_UUID }),
    );
    expect(markup).toContain("#۴۱");
    expect(markup).toContain("ارسال‌شده");
    // Balance is on the page even without wallet:credit — reading a customer
    // file is support work, minting is not.
    expect(markup).toContain("۱۲۵٬۰۰۰ تومان");
    expect(markup).toContain("خرید");
    expect(markup).toContain(`href="/admin/orders?user_uuid=${USER_UUID}"`);
  });

  it("puts the balance in front of the operator minting credit", async () => {
    mocks.getAdminUser.mockResolvedValue({
      ...user,
      wallet_balance: "125000.00",
    });

    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: true,
      }),
    );

    expect(markup).toContain("wallet-credit-form");
    expect(markup).toContain("wallet-credit-balance");
    expect(markup).toContain("موجودی فعلی");
  });

  it("keeps the identity card when orders and ledger reads fail", async () => {
    mocks.listAdminOrders.mockRejectedValue(new Error("boom"));
    mocks.listCustomerWalletTransactions.mockRejectedValue(new Error("boom"));

    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: false,
      }),
    );

    expect(markup).toContain("مینا رحیمی");
    expect(markup).toContain("فهرست سفارش‌ها در دسترس نیست");
    expect(markup).toContain("دریافت تراکنش‌های کیف پول ناموفق بود");
  });

  it("reports an unread balance as unknown rather than zero", async () => {
    const markup = renderToStaticMarkup(
      await CustomerDetailView({
        id: "user-2",
        auditPage: 1,
        canWrite: false,
        canCreditWallet: false,
      }),
    );

    expect(markup).toContain("نامشخص");
    expect(markup).not.toContain("۰ تومان");
  });
});
