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
import {
  ADMIN_PRODUCT_SORT_OPTIONS,
  hasAdminProductListFilters,
  matchAdminProductSort,
  type AdminProductListFilters,
} from "@/features/admin/products/products-list-params";

const IS_ACTIVE_OPTIONS = [
  { value: "", label: "منتشرشده و پیش‌نویس" },
  { value: "true", label: "منتشرشده" },
  { value: "false", label: "پیش‌نویس" },
];

// Index 0 is the default sort, so it is the “no filter” entry.
const SORT_OPTIONS = ADMIN_PRODUCT_SORT_OPTIONS.map((option, index) => ({
  value: index === 0 ? "" : option.value,
  label: option.label,
}));

/**
 * The params this list owns. `sortBy`/`orderBy` are a legacy alias for `sort`
 * rather than an operator-facing filter, so they are cleared by the sort chip
 * but are not declared here — an explicit `sortBy=created_at` is applied, just
 * as the default, and should not be reported as ignored.
 */
export const PRODUCT_FILTER_PARAMS: FilterParamLabels = {
  q: "جستجو",
  is_active: "وضعیت",
  sort: "مرتب‌سازی",
};

const SORT_CHIP_PARAMS = ["sort", "sortBy", "orderBy"] as const;

function productChips(filters: AdminProductListFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.query) {
    chips.push({ param: "q", label: `جستجو: ${filters.query}` });
  }
  if (filters.isActive !== undefined) {
    chips.push({
      param: "is_active",
      label: filters.isActive ? "منتشرشده" : "پیش‌نویس",
    });
  }
  // `sort` may be undefined for a hand-written `sortBy`/`orderBy` pair that is
  // not one of the five presets — still a non-default sort, still clearable.
  const sort = matchAdminProductSort(filters.sortBy, filters.orderBy);
  if (sort?.value !== ADMIN_PRODUCT_SORT_OPTIONS[0].value) {
    chips.push({
      param: SORT_CHIP_PARAMS,
      label: `مرتب‌سازی: ${sort?.label ?? "سفارشی"}`,
    });
  }
  return chips;
}

/**
 * Products used to need «اعمال فیلترها» while coupons searched by itself; S-3
 * removes that split. Search debounces, the two dropdowns apply on change, and
 * every hop is a `replace`.
 */
export function ProductsFilters({
  filters,
}: {
  filters: AdminProductListFilters;
}) {
  const setFilters = useFilterParams();
  const sortValue =
    matchAdminProductSort(filters.sortBy, filters.orderBy)?.value ?? "";

  return (
    <AdminFilterBar
      id="products-filter-title"
      title="جستجو و فیلتر محصولات"
      hasFilters={hasAdminProductListFilters(filters)}
      onReset={() =>
        setFilters({
          q: undefined,
          is_active: undefined,
          sort: undefined,
          sortBy: undefined,
          orderBy: undefined,
        })
      }
      gridClassName="sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem] lg:items-end"
      chips={
        <>
          <AdminFilterChips
            params={PRODUCT_FILTER_PARAMS}
            chips={productChips(filters)}
          />
          <AdminSavedViews list="products" params={PRODUCT_FILTER_PARAMS} />
        </>
      }
    >
      <FilterSearchInput
        id="products-query"
        label="نام یا برند"
        placeholder="جستجوی محصول یا برند…"
        value={filters.query}
      />
      <FilterSelect
        id="products-is-active"
        label="وضعیت"
        param="is_active"
        value={filters.isActive === undefined ? "" : String(filters.isActive)}
        options={IS_ACTIVE_OPTIONS}
      />
      <FilterSelect
        id="products-sort"
        label="مرتب‌سازی"
        param="sort"
        value={
          sortValue === ADMIN_PRODUCT_SORT_OPTIONS[0].value ? "" : sortValue
        }
        options={SORT_OPTIONS}
        clears={["sortBy", "orderBy"]}
      />
    </AdminFilterBar>
  );
}
