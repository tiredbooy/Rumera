import { afterEach, describe, expect, it, vi } from "vitest";

import {
  banAdminUser,
  createAdminUser,
  deactivateAdminUser,
  unbanAdminUser,
} from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("customers client API", () => {
  it("posts the exact create payload through the admin BFF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      json: vi.fn().mockResolvedValue({
        data: { user_id: "user-2", email: "mina@example.com" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      email: "mina@example.com",
      password: "secure-pass",
      role: "vendor" as const,
      is_active: false,
    };

    await createAdminUser(input);

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("accepts a 204 soft-deactivation response without parsing JSON", async () => {
    const json = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      json,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deactivateAdminUser("user-2")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/admin/users/user-2", {
      method: "DELETE",
      headers: {},
    });
    expect(json).not.toHaveBeenCalled();
  });

  it("posts ban with no body through the admin BFF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        data: { user_id: "user-2", is_banned: true },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(banAdminUser("user-2")).resolves.toEqual({
      user_id: "user-2",
      is_banned: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/users/user-2/ban",
      {
        method: "POST",
        headers: {},
      },
    );
  });

  it("posts unban with no body through the admin BFF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        data: { user_id: "user-2", is_banned: false },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(unbanAdminUser("user-2")).resolves.toEqual({
      user_id: "user-2",
      is_banned: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/users/user-2/unban",
      {
        method: "POST",
        headers: {},
      },
    );
  });
});
