"use client";

import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import {
  FilterSearchInput,
  FilterSelect,
} from "@/features/dashboard/components/admin-filter-controls";

import { LOYALTY_TIER_FA, LOYALTY_TIER_IDS } from "../labels";
import type { LoyaltyMemberFilters } from "../types";

const TIER_OPTIONS = [
  { value: "", label: "همهٔ سطوح" },
  ...LOYALTY_TIER_IDS.map((tier) => ({
    value: tier,
    label: LOYALTY_TIER_FA[tier],
  })),
];

const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین به‌روزرسانی" },
  { value: "oldest", label: "قدیمی‌ترین به‌روزرسانی" },
  { value: "balance_desc", label: "بیشترین موجودی" },
  { value: "balance_asc", label: "کمترین موجودی" },
  { value: "tier_desc", label: "بالاترین سطح" },
  { value: "tier_asc", label: "پایین‌ترین سطح" },
];

export function LoyaltyMembersFilters({
  filters,
}: {
  filters: LoyaltyMemberFilters;
}) {
  return (
    <AdminFilterBar
      id="loyalty-members-filter-title"
      title="جستجو و فیلتر اعضا"
      hasFilters={
        Boolean(filters.query) ||
        Boolean(filters.tier) ||
        filters.sort !== "newest"
      }
      resetHref="/admin/loyalty"
      gridClassName="sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_14rem] lg:items-end"
    >
      <FilterSearchInput
        id="loyalty-members-query"
        label="نام، ایمیل یا تلفن"
        placeholder="جستجوی اعضا…"
        value={filters.query}
      />
      <FilterSelect
        id="loyalty-members-tier"
        label="سطح"
        param="tier"
        value={filters.tier ?? ""}
        options={TIER_OPTIONS}
      />
      <FilterSelect
        id="loyalty-members-sort"
        label="مرتب‌سازی"
        param="sort"
        value={filters.sort === "newest" ? "" : filters.sort}
        options={[
          { value: "", label: SORT_OPTIONS[0]!.label },
          ...SORT_OPTIONS.slice(1),
        ]}
      />
    </AdminFilterBar>
  );
}
