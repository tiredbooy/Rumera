"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import {
  FilterSearchInput,
  FilterSelect,
} from "@/features/dashboard/components/admin-filter-controls";
import type { UserListFilters } from "@/features/customers/types";
import { ROLE_LABELS } from "@/lib/rbac/roles";

const ROLE_OPTIONS = ["customer", "vendor", "admin", "staff"] as const;

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "همهٔ نقش‌ها" },
  ...ROLE_OPTIONS.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "فعال، غیرفعال و مسدود" },
  { value: "active", label: "فقط فعال" },
  { value: "inactive", label: "غیرفعال یا مسدود" },
];

export function UsersFilters({ filters }: { filters: UserListFilters }) {
  return (
    <AdminFilterBar
      id="users-filter-title"
      title="جستجو و فیلتر کاربران"
      hasFilters={
        Boolean(filters.query) ||
        Boolean(filters.role) ||
        filters.status !== "all"
      }
      resetHref="/admin/customers"
      gridClassName="sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem] lg:items-end"
    >
      <FilterSearchInput
        id="users-query"
        label="نام، ایمیل یا تلفن"
        placeholder="جستجوی کاربران…"
        value={filters.query}
      />
      <FilterSelect
        id="users-role"
        label="نقش"
        param="role"
        value={filters.role ?? ""}
        options={ROLE_FILTER_OPTIONS}
      />
      <FilterSelect
        id="users-status"
        label="وضعیت"
        param="status"
        value={filters.status === "all" ? "" : filters.status}
        options={STATUS_FILTER_OPTIONS}
      />
    </AdminFilterBar>
  );
}

export function UsersListError() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-foreground/[0.04]"
      role="alert"
      aria-busy={isPending}
    >
      <p className="font-serif text-lg">دریافت کاربران ناموفق بود</p>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        هیچ دادهٔ جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره
        تلاش کنید.
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        className="mt-1 cursor-pointer"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="size-4" aria-hidden />
        )}
        {isPending ? "در حال تلاش…" : "تلاش دوباره"}
      </Button>
    </div>
  );
}

/** Loading placeholder for both mobile cards and the desktop users table. */
export function UsersListSkeleton() {
  return (
    <div
      className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
      aria-hidden
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/40 px-4 py-4 last:border-0"
        >
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 max-w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden h-5 w-20 animate-pulse rounded-full bg-muted sm:block" />
          <div className="hidden h-5 w-16 animate-pulse rounded-full bg-muted md:block" />
          <div className="hidden h-5 w-20 animate-pulse rounded bg-muted md:block" />
        </div>
      ))}
    </div>
  );
}
