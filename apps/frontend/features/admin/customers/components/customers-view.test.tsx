import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/customers/api", () => ({
  listUsers: mocks.listUsers,
}));

import { UsersTable } from "./customers-view";

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
        total_orders: 0,
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

    const markup = renderToStaticMarkup(await UsersTable({ filters }));

    expect(mocks.listUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: "mina",
      role: "vendor",
      is_active: false,
    });
    expect(markup).toContain("مینا فروشنده");
    expect(markup).toContain("غیرفعال");
    expect(markup).toContain(
      'href="/admin/customers?q=mina&amp;role=vendor&amp;status=inactive"',
    );
    expect(markup).toContain(
      'href="/admin/customers?q=mina&amp;role=vendor&amp;status=inactive&amp;page=3"',
    );
  });
});
