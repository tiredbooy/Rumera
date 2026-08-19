"use client";

import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Label } from "@/components/ui/label";
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
import { ORDER_STATUS_FA } from "@/features/orders/labels";
import { gregorianLocalToJalaliDisplay } from "@/lib/datetime/jalali";
import { faNum } from "@/lib/products";

import {
  hasAdminOrderListFilters,
  type AdminOrderListFilters,
} from "../order-list-params";

const STATUS_OPTIONS = [
  { value: "", label: "همهٔ وضعیت‌ها" },
  ...Object.entries(ORDER_STATUS_FA).map(([value, label]) => ({
    value,
    label,
  })),
];

/** Every param this list owns — feeds the chips and the saved-view menu. */
export const ORDER_FILTER_PARAMS: FilterParamLabels = {
  status: "وضعیت",
  paid_from: "از تاریخ پرداخت",
  paid_to: "تا تاریخ پرداخت",
  user_id: "شناسهٔ داخلی کاربر",
  user_uuid: "مشتری",
};

function orderChips(filters: AdminOrderListFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.status) {
    chips.push({
      param: "status",
      label: `وضعیت: ${ORDER_STATUS_FA[filters.status]}`,
    });
  }
  if (filters.paidFrom) {
    chips.push({
      param: "paid_from",
      label: `از ${gregorianLocalToJalaliDisplay(filters.paidFrom)}`,
    });
  }
  if (filters.paidTo) {
    chips.push({
      param: "paid_to",
      label: `تا ${gregorianLocalToJalaliDisplay(filters.paidTo)}`,
    });
  }
  if (filters.userId) {
    chips.push({ param: "user_id", label: `کاربر #${faNum(filters.userId)}` });
  }
  // No control renders this one — it arrives from the customers screen (CF-1) —
  // but it still filters the list, so it still gets a chip to clear it by.
  if (filters.userUuid) {
    chips.push({ param: "user_uuid", label: "فقط سفارش‌های این مشتری" });
  }
  return chips;
}

/**
 * Order triage is a status-toggling loop, so nothing here waits for an «اعمال»
 * button any more (S-3): the dropdown applies on change, the id field after a
 * short pause, and the Jalali fields when a *complete* date parses — a
 * half-typed one never reaches the URL, which is what the apply button used to
 * be protecting.
 */
export function OrderListFilters({
  filters,
}: {
  filters: AdminOrderListFilters;
}) {
  const setFilters = useFilterParams();

  return (
    <AdminFilterBar
      id="orders-filter-title"
      title="فیلتر سفارش‌ها"
      description="فیلتر وضعیت، تاریخ پرداخت و کاربر روی همهٔ سفارش‌ها اعمال می‌شود، نه فقط ردیف‌های همین صفحه."
      hasFilters={hasAdminOrderListFilters(filters)}
      onReset={() =>
        setFilters(
          Object.fromEntries(
            Object.keys(ORDER_FILTER_PARAMS).map((param) => [param, undefined]),
          ),
        )
      }
      gridClassName="sm:grid-cols-2 lg:grid-cols-[12rem_11rem_11rem_minmax(10rem,1fr)] lg:items-end"
      chips={
        <>
          <AdminFilterChips
            params={ORDER_FILTER_PARAMS}
            chips={orderChips(filters)}
          />
          <AdminSavedViews list="orders" params={ORDER_FILTER_PARAMS} />
        </>
      }
    >
      <FilterSelect
        id="orders-status"
        label="وضعیت"
        param="status"
        value={filters.status ?? ""}
        options={STATUS_OPTIONS}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="orders-paid-from">از تاریخ پرداخت</Label>
        <JalaliDateTimeInput
          id="orders-paid-from"
          granularity="date"
          value={filters.paidFrom ?? ""}
          onChange={(next) => setFilters({ paid_from: next || undefined })}
          className="h-9"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="orders-paid-to">تا تاریخ پرداخت</Label>
        <JalaliDateTimeInput
          id="orders-paid-to"
          granularity="date"
          value={filters.paidTo ?? ""}
          onChange={(next) => setFilters({ paid_to: next || undefined })}
          className="h-9"
        />
      </div>

      <FilterSearchInput
        id="orders-user-id"
        label="شناسهٔ داخلی کاربر"
        placeholder="مثلاً ۷"
        param="user_id"
        numeric
        value={filters.userId ? String(filters.userId) : ""}
      />
    </AdminFilterBar>
  );
}
