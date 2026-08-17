import { dehydrate, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/api/query-keys";
import { loyaltyKeys } from "@/features/loyalty/query-keys";
import { orderKeys } from "@/features/orders/query-keys";
import { recommendationKeys } from "@/features/recommendations/query-keys";
import { tasteProfileKeys } from "@/features/taste/query-keys";
import { walletKeys } from "@/features/wallet/query-keys";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  listAccountOrders: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/features/orders/api/account", () => ({
  listAccountOrders: mocks.listAccountOrders,
}));

import { prefetchAccountOverview } from "./prefetch-account-overview";

const emptyOrders = {
  results: [],
  pagination: {
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  },
};

const wallet = {
  id: 1,
  balance: "0",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const loyalty = {
  points_balance: 10,
  lifetime_points: 10,
  tier: "bronze" as const,
  points_to_next: 90,
};

const taste = {
  categories: [] as string[],
  budget_max: 0,
  flavor: [] as string[],
  occasions: [] as string[],
};

function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function seedSuccessfulFetches() {
  mocks.listAccountOrders.mockResolvedValue(emptyOrders);
  mocks.apiFetch.mockImplementation(async (path: string) => {
    switch (path) {
      case "/addresses":
        return [];
      case "/wallet":
        return wallet;
      case "/loyalty":
        return loyalty;
      case "/me/taste-profile":
        return taste;
      case "/recommendations/for-you":
        return [];
      default:
        throw new Error(`unexpected path ${path}`);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedSuccessfulFetches();
});

describe("prefetchAccountOverview", () => {
  it("seeds the same keys the overview hooks use with default args", async () => {
    const client = queryClient();
    await prefetchAccountOverview(client);

    expect(mocks.listAccountOrders).toHaveBeenCalledWith({});
    expect(mocks.apiFetch).toHaveBeenCalledWith("/addresses");
    expect(mocks.apiFetch).toHaveBeenCalledWith("/wallet");
    expect(mocks.apiFetch).toHaveBeenCalledWith("/loyalty");
    expect(mocks.apiFetch).toHaveBeenCalledWith("/me/taste-profile");
    expect(mocks.apiFetch).toHaveBeenCalledWith("/recommendations/for-you");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(5);

    expect(client.getQueryData(orderKeys.list({}))).toEqual(emptyOrders);
    expect(client.getQueryData(queryKeys.addresses)).toEqual([]);
    expect(client.getQueryData(walletKeys.all)).toEqual(wallet);
    expect(client.getQueryData(loyaltyKeys.account)).toEqual(loyalty);
    expect(client.getQueryData(tasteProfileKeys.profile)).toEqual(taste);
    expect(client.getQueryData(recommendationKeys.forYou({}))).toEqual([]);
  });

  it("leaves a failed query out of the dehydrated payload", async () => {
    mocks.listAccountOrders.mockRejectedValue(new Error("orders down"));

    const client = queryClient();
    await expect(prefetchAccountOverview(client)).resolves.toBeUndefined();

    const keys = dehydrate(client).queries.map((query) => query.queryKey);
    expect(keys).not.toContainEqual(orderKeys.list({}));
    expect(keys).toEqual(
      expect.arrayContaining([
        queryKeys.addresses,
        walletKeys.all,
        loyaltyKeys.account,
        tasteProfileKeys.profile,
        recommendationKeys.forYou({}),
      ]),
    );
    expect(keys).toHaveLength(5);
  });
});
