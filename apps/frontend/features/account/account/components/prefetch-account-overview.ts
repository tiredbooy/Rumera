import "server-only";

import type { QueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Address } from "@/features/addresses/types";
import { listAccountOrders } from "@/features/orders/api/account";
import { orderKeys } from "@/features/orders/query-keys";
import type { LoyaltyAccount } from "@/features/loyalty/types";
import { loyaltyKeys } from "@/features/loyalty/query-keys";
import type { RecommendationItem } from "@/features/recommendations/types";
import { recommendationKeys } from "@/features/recommendations/query-keys";
import type { TasteProfile } from "@/features/taste/types";
import { tasteProfileKeys } from "@/features/taste/query-keys";
import type { Wallet } from "@/features/wallet/types";
import { walletKeys } from "@/features/wallet/query-keys";

/**
 * Default args the overview hooks pass (`useOrders()`, `useForYou()`).
 * Keys must stay identical or the client will miss the dehydrated cache.
 */
const OVERVIEW_LIST_QUERY = {};

export async function prefetchAccountOverview(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: orderKeys.list(OVERVIEW_LIST_QUERY),
      queryFn: () => listAccountOrders(OVERVIEW_LIST_QUERY),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.addresses,
      queryFn: () => apiFetch<Address[]>("/addresses"),
    }),
    queryClient.prefetchQuery({
      queryKey: walletKeys.all,
      queryFn: () => apiFetch<Wallet>("/wallet"),
    }),
    queryClient.prefetchQuery({
      queryKey: loyaltyKeys.account,
      queryFn: () => apiFetch<LoyaltyAccount>("/loyalty"),
    }),
    queryClient.prefetchQuery({
      queryKey: tasteProfileKeys.profile,
      queryFn: () => apiFetch<TasteProfile>("/me/taste-profile"),
    }),
    queryClient.prefetchQuery({
      queryKey: recommendationKeys.forYou(OVERVIEW_LIST_QUERY),
      queryFn: () =>
        apiFetch<RecommendationItem[]>("/recommendations/for-you"),
    }),
  ]);
}
