import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
  usePathname: () => "/admin/customers",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/customers/api", () => ({
  listUsers: mocks.listUsers,
}));

import {
  adminOrdersForUserHref,
  CustomersView,
  UsersTable,
} from "./customers-view";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue({
    results: [
      {
        user_id: "user-2",
        full_name: "مینا فروشنده",
        email: "mina@example.com",
        phone: "09120000000",
        role: "vendor",
        total_orders: 4,
        is_active: false,
        is_banned: false,
        created_at: "2026-07-20T10:00:00Z",
      },
    ],
    pagination: {
      page: 2,
      limit: 20,
      total_items: 41,
      total_pages: 3,
      has_next: true,
      has_prev: true,
    },
  });
});

describe("admin users list", () => {
  it("queries inactive users and preserves every URL filter across pagination", async () => {
    const filters = {
      query: "mina",
      page: 2,
      role: "vendor" as const,
      status: "inactive" as const,
    };

    const markup = renderToStaticMarkup(
      await UsersTable({ filters, canWrite: true }),
    );

    expect(mocks.listUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: "mina",
      role: "vendor",
      is_active: false,
    });
    expect(markup).toContain("مینا فروشنده");
    expect(markup).toContain("غیرفعال");
    expect(markup).toContain("۴ سفارش");
    // Never the internal bigint filter — this screen does not have that id.
    expect(markup).not.toContain("/admin/orders?user_id=");
    expect(markup).toContain(
      'href="/admin/customers?q=mina&amp;role=vendor&amp;status=inactive"',
    );
    expect(markup).toContain(
      'href="/admin/customers?q=mina&amp;role=vendor&amp;status=inactive&amp;page=3"',
    );
    expect(markup).not.toContain("/admin/customers/new");
  });

  it("hides the empty-state create CTA without customers:write", async () => {
    mocks.listUsers.mockResolvedValue({
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

    const filters = {
      query: "",
      page: 1,
      role: undefined,
      status: "all" as const,
    };

    const readable = renderToStaticMarkup(
      await UsersTable({ filters, canWrite: false }),
    );
    expect(readable).toContain("هنوز کاربری ثبت نشده است");
    expect(readable).not.toContain("ساخت نخستین کاربر");
    expect(readable).not.toContain("/admin/customers/new");

    const writable = renderToStaticMarkup(
      await UsersTable({ filters, canWrite: true }),
    );
    expect(writable).toContain("ساخت نخستین کاربر");
    expect(writable).toContain('href="/admin/customers/new"');
  });

  // CF-1. This used to assert the opposite: a link for the numeric id "7" and
  // none for a real UUID. But `user_id` on every customers response IS the UUID
  // — the numeric shape it demanded is one the API never returns — so the link
  // was dead for every real row. The orders filter now accepts the public id.
  it("jumps to the orders board for the public customer id it actually has", async () => {
    expect(adminOrdersForUserHref("user-2")).toBeUndefined();
    expect(adminOrdersForUserHref("07")).toBeUndefined();
    // The internal bigint must NOT build a link: it is not what this screen
    // holds, and guessing one would filter orders by the wrong customer.
    expect(adminOrdersForUserHref("7")).toBeUndefined();
    expect(adminOrdersForUserHref("b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d")).toBe(
      "/admin/orders?user_uuid=b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    );

    mocks.listUsers.mockResolvedValue({
      results: [
        {
          user_id: "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
          full_name: "علی خریدار",
          email: "ali@example.com",
          role: "customer",
          total_orders: 12,
          is_active: true,
          is_banned: false,
          created_at: "2026-07-20T10:00:00Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    const markup = renderToStaticMarkup(
      await UsersTable({
        filters: { query: "", page: 1, role: undefined, status: "all" },
        canWrite: false,
      }),
    );

    expect(markup).toContain("۱۲ سفارش");
    expect(markup).toContain(
      'href="/admin/orders?user_uuid=b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"',
    );
  });

  it("hides the list create button without customers:write", () => {
    const readable = renderToStaticMarkup(
      <CustomersView searchParams={{}} canWrite={false} />,
    );
    expect(readable).not.toContain("ساخت کاربر");
    expect(readable).not.toContain("/admin/customers/new");

    const writable = renderToStaticMarkup(
      <CustomersView searchParams={{}} canWrite />,
    );
    expect(writable).toContain("ساخت کاربر");
    expect(writable).toContain('href="/admin/customers/new"');
  });
});
