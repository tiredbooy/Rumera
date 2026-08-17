import { ORDER_STATUS_FA } from "@/features/orders/labels";
import type { AdminOrderListQuery, OrderStatus } from "@/features/orders/types";

export const ADMIN_ORDERS_PAGE_SIZE = 50;

export type AdminOrdersSearchParamValue = string | string[] | undefined;

export type AdminOrdersSearchParams = {
  page?: AdminOrdersSearchParamValue;
  status?: AdminOrdersSearchParamValue;
  user_id?: AdminOrdersSearchParamValue;
  user_uuid?: AdminOrdersSearchParamValue;
  paid_from?: AdminOrdersSearchParamValue;
  paid_to?: AdminOrdersSearchParamValue;
};

export type AdminOrderListFilters = {
  page: number;
  status?: OrderStatus;
  userId?: number;
  /** Public customer UUID (CF-1) — the id the customers screen actually shows. */
  userUuid?: string;
  paidFrom?: string;
  paidTo?: string;
};

const ORDER_STATUS_VALUES = new Set<string>(Object.keys(ORDER_STATUS_FA));
const PUBLIC_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the public UUID shape reaches the API; anything else is dropped. */
function parsePublicUserId(value: string | undefined): string | undefined {
  const id = (value ?? "").trim();
  return PUBLIC_USER_ID.test(id) ? id : undefined;
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function first(value: AdminOrdersSearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parsePage(value: AdminOrdersSearchParamValue): number {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string): OrderStatus | undefined {
  return ORDER_STATUS_VALUES.has(value) ? (value as OrderStatus) : undefined;
}

function parsePositiveInt(value: string): number | undefined {
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** Calendar day `YYYY-MM-DD` only. Invalid or rolled-over dates are dropped. */
export function parseIsoDate(value: string): string | undefined {
  if (!ISO_DATE.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return value;
}

/**
 * Expand a calendar day to RFC3339 UTC for `paid_from` / `paid_to`.
 * Local midnight / end-of-day so the operator's date picker matches paid_at.
 * Go BindQuery only accepts RFC3339 without fractional seconds.
 */
export function dayBoundRFC3339(
  value: string,
  bound: "start" | "end",
): string | undefined {
  const date = parseIsoDate(value);
  if (!date) return undefined;
  const parsed = new Date(
    `${date}T${bound === "end" ? "23:59:59" : "00:00:00"}`,
  );
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function parseAdminOrderListParams(
  params: AdminOrdersSearchParams,
): AdminOrderListFilters {
  const paidFrom = parseIsoDate(first(params.paid_from));
  const paidTo = parseIsoDate(first(params.paid_to));
  return {
    page: parsePage(params.page),
    status: parseStatus(first(params.status)),
    userId: parsePositiveInt(first(params.user_id)),
    userUuid: parsePublicUserId(first(params.user_uuid)),
    paidFrom,
    paidTo,
  };
}

export function hasAdminOrderListFilters(
  filters: AdminOrderListFilters,
): boolean {
  return Boolean(
    filters.status ||
      filters.userId ||
      filters.userUuid ||
      filters.paidFrom ||
      filters.paidTo,
  );
}

export function toAdminOrderListQuery(
  filters: AdminOrderListFilters,
): AdminOrderListQuery {
  return {
    page: filters.page,
    limit: ADMIN_ORDERS_PAGE_SIZE,
    sortBy: "created_at",
    orderBy: "desc",
    status: filters.status,
    user_id: filters.userId,
    user_uuid: filters.userUuid,
    paid_from: filters.paidFrom
      ? dayBoundRFC3339(filters.paidFrom, "start")
      : undefined,
    paid_to: filters.paidTo ? dayBoundRFC3339(filters.paidTo, "end") : undefined,
  };
}

export function adminOrdersHref(
  filters: AdminOrderListFilters,
  page = filters.page,
): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.userId) params.set("user_id", String(filters.userId));
  if (filters.userUuid) params.set("user_uuid", filters.userUuid);
  if (filters.paidFrom) params.set("paid_from", filters.paidFrom);
  if (filters.paidTo) params.set("paid_to", filters.paidTo);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}
