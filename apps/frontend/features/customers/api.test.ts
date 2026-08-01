import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({
  apiFetch: mocks.apiFetch,
}));

import {
  getAdminRoles,
  getAdminUser,
  getAdminUserAudit,
  listUsers,
} from "./api";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiFetch.mockResolvedValue({});
});

describe("customers server API", () => {
  it("uses the exact admin role, user, inactive-filter, and audit paths", async () => {
    await getAdminRoles();
    await listUsers({ page: 2, limit: 20, role: "vendor", is_active: false });
    await getAdminUser("user-2");
    await getAdminUserAudit("user-2", { page: 3, limit: 20 });

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, "/admin/roles");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/admin/users?page=2&limit=20&role=vendor&is_active=false",
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(3, "/admin/users/user-2");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      4,
      "/admin/users/user-2/audit?page=3&limit=20",
    );
  });
});
