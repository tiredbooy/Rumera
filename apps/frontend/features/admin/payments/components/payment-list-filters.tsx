"use client";

import {
  AdminFilterChips,
  AdminSavedViews,
  FilterSearchInput,
  FilterSelect,
  useFilterParams,
  type FilterChip,
  type FilterParamLabels,
} from "@/features/dashboard/components/admin-filter-controls";
import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import { PAYMENT_STATUS_FA } from "@/features/payments/presentation";
import type { PaymentStatus } from "@/features/payments/types";
import { faNum } from "@/lib/products";

export type PaymentSort = "newest" | "oldest" | "amount_desc" | "amount_asc";

export function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function paymentStatus(value: string | null): PaymentStatus | undefined {
  return value === "pending" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "refunded" ||
    value === "partially_refunded"
    ? value
    : undefined;
}

export function paymentSort(value: string | null): PaymentSort {
  return value === "oldest" || value === "amount_desc" || value === "amount_asc"
    ? value
    : "newest";
}

const STATUS_OPTIONS = [
  { value: "", label: "همهٔ وضعیت‌ها" },
  ...(Object.keys(PAYMENT_STATUS_FA) as PaymentStatus[]).map((value) => ({
    value,
    label: PAYMENT_STATUS_FA[value],
  })),
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "amount_desc", label: "بیشترین مبلغ" },
  { value: "amount_asc", label: "کمترین مبلغ" },
];

const SORT_FA: Record<PaymentSort, string> = {
  newest: "جدیدترین",
  oldest: "قدیمی‌ترین",
  amount_desc: "بیشترین مبلغ",
  amount_asc: "کمترین مبلغ",
};

/** Every param the ledger owns — feeds the chips and the saved-view menu. */
export const PAYMENT_FILTER_PARAMS: FilterParamLabels = {
  order: "شناسهٔ سفارش",
  user: "شناسهٔ داخلی کاربر",
  status: "وضعیت",
  sort: "ترتیب",
};

/**
 * Status and sort were already instant; S-3 retires «اعمال شناسه‌ها» too. The
 * id fields accept digits only — Eastern digits are folded on the way in — so
 * a half-typed id is a narrower query rather than the malformed one the submit
 * button and its error message used to guard against.
 */
export function PaymentListFilters({
  orderID,
  userID,
  status,
  sort,
  hasFilters,
}: {
  orderID?: number;
  userID?: number;
  status?: PaymentStatus;
  sort: PaymentSort;
  hasFilters: boolean;
}) {
  const setFilters = useFilterParams();

  const chips: FilterChip[] = [];
  if (orderID) {
    chips.push({ param: "order", label: `سفارش #${faNum(orderID)}` });
  }
  if (userID) {
    chips.push({ param: "user", label: `کاربر #${faNum(userID)}` });
  }
  if (status) {
    chips.push({ param: "status", label: `وضعیت: ${PAYMENT_STATUS_FA[status]}` });
  }
  if (sort !== "newest") {
    chips.push({ param: "sort", label: `ترتیب: ${SORT_FA[sort]}` });
  }

  return (
    <AdminFilterBar
      id="payment-filter-title"
      title="جستجو و فیلتر تراکنش‌ها"
      description="فیلترها مستقیماً روی دادهٔ واقعی پرداخت اعمال می‌شوند و بدون دکمهٔ اعمال اثر می‌گذارند."
      hasFilters={hasFilters}
      onReset={() =>
        setFilters(
          Object.fromEntries(
            Object.keys(PAYMENT_FILTER_PARAMS).map((param) => [
              param,
              undefined,
            ]),
          ),
        )
      }
      gridClassName="sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_12rem] lg:items-end"
      chips={
        <>
          <AdminFilterChips params={PAYMENT_FILTER_PARAMS} chips={chips} />
          <AdminSavedViews list="payments" params={PAYMENT_FILTER_PARAMS} />
        </>
      }
    >
      <FilterSearchInput
        id="payment-order-filter"
        label="شناسهٔ سفارش"
        placeholder="مثلاً ۱۲۳"
        param="order"
        numeric
        value={orderID ? String(orderID) : ""}
      />
      <FilterSearchInput
        id="payment-user-filter"
        label="شناسهٔ داخلی کاربر"
        placeholder="مثلاً ۷"
        param="user"
        numeric
        value={userID ? String(userID) : ""}
      />
      <FilterSelect
        id="payment-status-filter"
        label="وضعیت"
        param="status"
        value={status ?? ""}
        options={STATUS_OPTIONS}
      />
      <FilterSelect
        id="payment-sort-filter"
        label="ترتیب"
        param="sort"
        value={sort === "newest" ? "" : sort}
        options={SORT_OPTIONS}
      />
    </AdminFilterBar>
  );
}
