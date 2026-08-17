"use client";

import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import {
  FilterSearchInput,
  FilterSelect,
} from "@/features/dashboard/components/admin-filter-controls";

import {
  hasAdminInventoryListFilters,
  type AdminInventoryListFilters,
} from "../inventory-list-params";

const LOW_STOCK_OPTIONS = [
  { value: "", label: "همهٔ ردیف‌ها" },
  { value: "true", label: "رو به اتمام (≤ آستانه)" },
];

export function InventoryListFilters({
  filters,
}: {
  filters: AdminInventoryListFilters;
}) {
  return (
    <AdminFilterBar
      id="inventory-filter-title"
      title="جستجو و فیلتر موجودی"
      hasFilters={hasAdminInventoryListFilters(filters)}
      resetHref="/admin/inventory"
      gridClassName="sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_14rem] lg:items-end"
    >
      <FilterSearchInput
        id="inventory-query"
        label="محصول یا کد کالا"
        placeholder="جستجوی محصول یا کد کالا…"
        value={filters.query}
      />
      <FilterSelect
        id="inventory-low-stock"
        label="کسری موجودی"
        param="low_stock"
        value={filters.lowStock ? "true" : ""}
        options={LOW_STOCK_OPTIONS}
      />
    </AdminFilterBar>
  );
}
