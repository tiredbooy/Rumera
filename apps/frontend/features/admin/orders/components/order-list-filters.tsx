import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import { ORDER_STATUS_FA } from "@/features/orders/labels";
import type { OrderStatus } from "@/features/orders/types";

import {
  hasAdminOrderListFilters,
  type AdminOrderListFilters,
} from "../order-list-params";

const STATUS_OPTIONS = Object.keys(ORDER_STATUS_FA) as OrderStatus[];

/**
 * Orders is the one list that keeps an explicit «اعمال فیلترها»: a half-typed
 * date range or a half-typed numeric user id is a *wrong* query, not a narrower
 * one, so these fields commit on submit rather than as you type. Everything else
 * about the bar — reset position, no card — matches the rest of the console.
 */
export function OrderListFilters({
  filters,
}: {
  filters: AdminOrderListFilters;
}) {
  return (
    <AdminFilterBar
      id="orders-filter-title"
      title="فیلتر سفارش‌ها"
      description="فیلتر وضعیت، تاریخ پرداخت و کاربر روی همهٔ سفارش‌ها اعمال می‌شود، نه فقط ردیف‌های همین صفحه."
      hasFilters={hasAdminOrderListFilters(filters)}
      resetHref="/admin/orders"
    >
      <form
        action="/admin/orders"
        method="get"
        aria-labelledby="orders-filter-title"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_11rem_11rem_minmax(10rem,1fr)_auto] lg:items-end"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="orders-status">وضعیت</Label>
          <NativeSelect
            id="orders-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="w-full [&_[data-slot=native-select]]:h-9"
          >
            <NativeSelectOption value="">همهٔ وضعیت‌ها</NativeSelectOption>
            {STATUS_OPTIONS.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {ORDER_STATUS_FA[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="orders-paid-from">از تاریخ پرداخت</Label>
          <JalaliDateTimeInput
            id="orders-paid-from"
            name="paid_from"
            granularity="date"
            defaultValue={filters.paidFrom ?? ""}
            className="h-9"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="orders-paid-to">تا تاریخ پرداخت</Label>
          <JalaliDateTimeInput
            id="orders-paid-to"
            name="paid_to"
            granularity="date"
            defaultValue={filters.paidTo ?? ""}
            className="h-9"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="orders-user-id">شناسهٔ داخلی کاربر</Label>
          <Input
            id="orders-user-id"
            name="user_id"
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            defaultValue={filters.userId ?? ""}
            placeholder="مثلاً ۷"
            className="h-9"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-9 cursor-pointer sm:col-span-2 lg:col-span-1"
        >
          اعمال فیلترها
        </Button>
      </form>
    </AdminFilterBar>
  );
}
