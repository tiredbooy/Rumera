"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { UserListFilters } from "@/features/customers/types";
import { ROLE_LABELS } from "@/lib/rbac/roles";

const ROLE_OPTIONS = ["customer", "vendor", "admin", "staff"] as const;

export function UsersFilters({ filters }: { filters: UserListFilters }) {
  const hasFilters =
    Boolean(filters.query) || Boolean(filters.role) || filters.status !== "all";

  return (
    <section
      className="border-hairline mb-5 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
      aria-labelledby="users-filter-title"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden />
        <h2 id="users-filter-title">جستجو و فیلتر کاربران</h2>
      </div>
      <form
        action="/admin/customers"
        method="get"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto] lg:items-end"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="users-query">نام، ایمیل یا تلفن</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="users-query"
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="جستجوی کاربران…"
              className="h-11 ps-9"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="users-role">نقش</Label>
          <NativeSelect
            id="users-role"
            name="role"
            defaultValue={filters.role ?? "all"}
            className="w-full [&_[data-slot=native-select]]:h-11"
          >
            <NativeSelectOption value="all">همهٔ نقش‌ها</NativeSelectOption>
            {ROLE_OPTIONS.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {ROLE_LABELS[role]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="users-status">وضعیت</Label>
          <NativeSelect
            id="users-status"
            name="status"
            defaultValue={filters.status}
            className="w-full [&_[data-slot=native-select]]:h-11"
          >
            <NativeSelectOption value="all">
              فعال، غیرفعال و مسدود
            </NativeSelectOption>
            <NativeSelectOption value="active">فقط فعال</NativeSelectOption>
            <NativeSelectOption value="inactive">
              غیرفعال یا مسدود
            </NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
          <Button
            type="submit"
            size="lg"
            className="h-11 flex-1 cursor-pointer"
          >
            اعمال فیلترها
          </Button>
          {hasFilters ? (
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 cursor-pointer"
            >
              <Link href="/admin/customers" aria-label="پاک کردن همهٔ فیلترها">
                <X className="size-4" aria-hidden />
                پاک کردن
              </Link>
            </Button>
          ) : null}
        </div>
      </form>
    </section>
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
