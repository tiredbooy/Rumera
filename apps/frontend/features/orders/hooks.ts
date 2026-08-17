"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { Paginated } from "@/lib/api/types";
import { queryKeys } from "@/lib/api/query-keys";

import {
  cancelAccountOrderClient,
  createAccountOrderClient,
  getAccountOrderClient,
  listAccountOrdersClient,
  payAccountOrderClient,
} from "./api/account-client";
import { orderKeys } from "./query-keys";
import type {
  AccountOrderListQuery,
  OrderListItem,
  OrderStatus,
} from "./types";

/** Tab → GET /orders `status` values. One request per entry; BE is single-status. */
export const ACCOUNT_ORDER_TAB_STATUSES = {
  all: [] as const,
  processing: ["pending", "paid", "processing", "ready_to_ship"],
  shipped: ["shipped", "out_for_delivery"],
  delivered: ["delivered"],
  cancelled: [
    "cancelled",
    "refund_requested",
    "refund_approved",
    "refunded",
    "partially_refunded",
  ],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type AccountOrderTab = keyof typeof ACCOUNT_ORDER_TAB_STATUSES;

export interface AccountOrdersTabQuery {
  page?: number;
  /** Omit or `[]` = unfiltered list. Otherwise one GET /orders per status. */
  statuses?: readonly OrderStatus[];
}

export function mergeOrderListPages(
  pages: Paginated<OrderListItem>[],
): Paginated<OrderListItem> {
  if (pages.length === 0) {
    return {
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
  }

  const seen = new Set<number>();
  const results: OrderListItem[] = [];
  for (const page of pages) {
    for (const item of page.results) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      results.push(item);
    }
  }
  results.sort((a, b) => {
    const delta = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (Number.isNaN(delta) || delta === 0) return b.id - a.id;
    return delta;
  });

  const total_items = pages.reduce((n, page) => n + page.pagination.total_items, 0);
  const total_pages = Math.max(
    1,
    ...pages.map((page) => page.pagination.total_pages),
  );

  return {
    results,
    pagination: {
      page: pages[0]?.pagination.page ?? 1,
      limit: pages[0]?.pagination.limit ?? 20,
      total_items,
      total_pages,
      has_next: pages.some((page) => page.pagination.has_next),
      has_prev: pages.some((page) => page.pagination.has_prev),
    },
  };
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAccountOrderClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useOrders(
  query: AccountOrderListQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () => listAccountOrdersClient(query),
    enabled,
  });
}

/** One GET /orders per status; merge those server pages. Never filter one page. */
export function useOrdersTab(
  query: AccountOrdersTabQuery = {},
  enabled = true,
) {
  const page = query.page;
  const statuses = query.statuses;
  const requests: AccountOrderListQuery[] =
    statuses && statuses.length > 0
      ? statuses.map((status) => ({ page, status }))
      : [{ page }];

  const results = useQueries({
    queries: requests.map((request) => ({
      queryKey: orderKeys.list(request),
      queryFn: () => listAccountOrdersClient(request),
      enabled,
    })),
  });

  const isError = results.some((result) => result.isError);
  const isLoading = results.some((result) => result.isLoading);
  const isFetching = results.some((result) => result.isFetching);
  const pages = results.map((result) => result.data);
  const data =
    !isError &&
    pages.every((pageData): pageData is Paginated<OrderListItem> =>
      pageData !== undefined,
    )
      ? mergeOrderListPages(pages)
      : undefined;

  return {
    data,
    isLoading,
    isError,
    isFetching,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

export function useOrder(id: number, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getAccountOrderClient(id),
    enabled: enabled && Number.isInteger(id) && id > 0,
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelAccountOrderClient,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => payAccountOrderClient(id),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      if (order?.id) {
        queryClient.setQueryData(orderKeys.detail(order.id), order);
      }
    },
  });
}
