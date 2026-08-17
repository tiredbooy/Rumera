import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));

import { fetchLookupList } from "./fetch-lookup-list";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchLookupList", () => {
  it("returns results from a legal paginated lookup", async () => {
    const brands = [{ id: 1, title: "رومرا" }];
    mocks.apiFetch.mockResolvedValue({
      results: brands,
      pagination: { page: 1, limit: 100, total_items: 1, total_pages: 1 },
    });

    await expect(fetchLookupList("/brands?limit=100")).resolves.toEqual(brands);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/brands?limit=100");
  });

  it("treats a missing results array as empty, not as failure", async () => {
    mocks.apiFetch.mockResolvedValue({ pagination: { page: 1, limit: 20 } });

    await expect(
      fetchLookupList("/categories?limit=20&sortBy=title"),
    ).resolves.toEqual([]);
  });

  it("rejects an illegal limit before fetching", async () => {
    await expect(fetchLookupList("/brands?limit=200")).rejects.toThrow(
      /limit must be 1–100/,
    );
    await expect(fetchLookupList("/brands")).rejects.toThrow(/got missing/);
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("does not swallow lookup failures", async () => {
    mocks.apiFetch.mockRejectedValue(new Error("INVALID_QUERY"));

    await expect(fetchLookupList("/tags?limit=100")).rejects.toThrow(
      "INVALID_QUERY",
    );
  });
});
