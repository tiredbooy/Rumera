import { afterEach, describe, expect, it, vi } from "vitest";

import { createAdminUser, deactivateAdminUser } from "./client";

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
});
