import type {
  AccountOrderListQuery,
  AdminOrderListQuery,
} from "./types";

export const orderKeys = {
  all: ["orders"] as const,
  list: (query: AccountOrderListQuery = {}) =>
    ["orders", "list", query] as const,
  detail: (id: number) => ["orders", "detail", id] as const,
};

export const adminOrderKeys = {
  all: ["admin", "orders"] as const,
  list: (query: AdminOrderListQuery = {}) =>
    ["admin", "orders", "list", query] as const,
};
