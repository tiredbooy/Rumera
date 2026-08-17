import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));

import {
  getProductOptionCatalog,
  loadProductOptionCatalog,
  PRODUCT_OPTION_CATALOG_ERROR,
} from "./server";

const volumeType = {
  id: 3,
  title: "volume",
  display_name: "حجم",
  created_at: "2026-07-27T00:00:00Z",
  updated_at: "2026-07-27T00:00:00Z",
};

const volumeValues = [
  {
    id: 11,
    option_type_id: 3,
    value: "700ml",
    sort_order: 0,
    created_at: "2026-07-27T00:00:00Z",
    updated_at: "2026-07-27T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProductOptionCatalog", () => {
  it("joins option types with their values", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce([volumeType])
      .mockResolvedValueOnce(volumeValues);

    await expect(getProductOptionCatalog()).resolves.toEqual([
      { ...volumeType, values: volumeValues },
    ]);
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, "/admin/option-types");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/admin/option-types/3/values",
    );
  });

  it("throws when types or values fail", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error("option types down"));
    await expect(getProductOptionCatalog()).rejects.toThrow("option types down");

    mocks.apiFetch
      .mockResolvedValueOnce([volumeType])
      .mockRejectedValueOnce(new Error("option values down"));
    await expect(getProductOptionCatalog()).rejects.toThrow(
      "option values down",
    );
  });
});

describe("loadProductOptionCatalog", () => {
  it("returns the catalog when the N+1 load succeeds", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce([volumeType])
      .mockResolvedValueOnce(volumeValues);

    await expect(loadProductOptionCatalog()).resolves.toEqual({
      optionTypes: [{ ...volumeType, values: volumeValues }],
      error: null,
    });
  });

  it("isolates a catalog failure as empty types plus an error", async () => {
    mocks.apiFetch.mockRejectedValue(new Error("option types down"));

    await expect(loadProductOptionCatalog()).resolves.toEqual({
      optionTypes: [],
      error: PRODUCT_OPTION_CATALOG_ERROR,
    });
    expect(PRODUCT_OPTION_CATALOG_ERROR).not.toContain(
      "هنوز ویژگی مشترکی تعریف نشده",
    );
  });
});
