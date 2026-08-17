import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { ApiError } from "@/lib/api/errors";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

import { LoyaltyMembersFilters } from "./loyalty-members-filters";
import { listLoyaltyMembers } from "../api/server";
import {
  loyaltyTierLabel,
  memberDisplayName,
} from "../labels";
import type { LoyaltyMemberFilters, LoyaltyMemberSearchParams } from "../types";
import {
  parseLoyaltyMemberFilters,
  toLoyaltyMemberListQuery,
} from "../validations";

const PAGE_SIZE = 20;

export function membersPageHref(
  filters: LoyaltyMemberFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.tier) params.set("tier", filters.tier);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/loyalty?${qs}` : "/admin/loyalty";
}

export function LoyaltyMembersView({
  searchParams,
}: {
  searchParams: LoyaltyMemberSearchParams;
}) {
  const filters = parseLoyaltyMemberFilters(searchParams);

  return (
    <section id="members">
      <LoyaltyMembersFilters filters={filters} />
      <Suspense
        key={`${filters.query}|${filters.tier ?? "all"}|${filters.sort}|${filters.page}`}
        fallback={<LoyaltyMembersSkeleton />}
      >
        <LoyaltyMembersTable filters={filters} />
      </Suspense>
    </section>
  );
}

export function LoyaltyMembersSkeleton() {
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
          <div className="hidden h-5 w-16 animate-pulse rounded-full bg-muted sm:block" />
          <div className="hidden h-5 w-16 animate-pulse rounded bg-muted md:block" />
        </div>
      ))}
    </div>
  );
}

export async function LoyaltyMembersTable({
  filters,
}: {
  filters: LoyaltyMemberFilters;
}) {
  let data;
  try {
    data = await listLoyaltyMembers(
      toLoyaltyMemberListQuery(filters, PAGE_SIZE),
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <AdminDataErrorState
        title="دریافت اعضای باشگاه ناموفق بود"
        description="هیچ فهرست جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
      />
    );
  }

  const { results, pagination } = data;
  if (pagination.total_pages > 0 && filters.page > pagination.total_pages) {
    redirect(membersPageHref(filters, pagination.total_pages));
  }

  const hasFilters =
    Boolean(filters.query) ||
    Boolean(filters.tier) ||
    filters.sort !== "newest";

  if (results.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Users className="size-6" />
        </span>
        <p className="font-serif text-lg">
          {hasFilters
            ? "عضوی با این فیلترها یافت نشد"
            : "هنوز عضوی در باشگاه ثبت نشده است"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "نام، ایمیل، تلفن یا سطح را تغییر دهید، یا مرتب‌سازی را به حالت پیش‌فرض برگردانید."
            : "پس از نخستین امتیاز (عضویت، خرید پرداخت‌شده یا تنظیم پشتیبانی) اعضا در این فهرست دیده می‌شوند."}
        </p>
        {hasFilters ? (
          <Button
            variant="outline"
            size="lg"
            asChild
            className="mt-1 cursor-pointer"
          >
            <Link href="/admin/loyalty">پاک کردن فیلترها</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {results.map((member) => {
          const name = memberDisplayName(member);
          const initial = name.trim().charAt(0).toUpperCase();
          return (
            <article
              key={member.user_id}
              className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
            >
              <Link
                href={`/admin/loyalty/${member.user_id}`}
                className="-m-1 flex min-h-11 items-center gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary"
                  aria-hidden
                >
                  {initial}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-medium">{name}</span>
                  <span
                    className="mt-1 block truncate text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {member.email}
                  </span>
                </span>
              </Link>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                <div>
                  <dt className="mb-1.5 text-muted-foreground">سطح</dt>
                  <dd className="font-medium">
                    {loyaltyTierLabel(member.tier)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-muted-foreground">موجودی</dt>
                  <dd className="font-medium tabular-nums" dir="ltr">
                    {faNum(member.points_balance)}
                  </dd>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                  <dt className="text-muted-foreground">امتیاز lifetime</dt>
                  <dd className="tabular-nums" dir="ltr">
                    {faNum(member.lifetime_points)}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="border-hairline hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                عضو
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                سطح
              </TableHead>
              <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                موجودی
              </TableHead>
              <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                lifetime
              </TableHead>
              <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                به‌روزرسانی
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((member) => {
              const name = memberDisplayName(member);
              const initial = name.trim().charAt(0).toUpperCase();
              return (
                <TableRow key={member.user_id} className="border-border/40">
                  <TableCell>
                    <Link
                      href={`/admin/loyalty/${member.user_id}`}
                      className="-mx-2 -my-1 flex items-center gap-3 rounded-lg px-2 py-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary"
                        aria-hidden
                      >
                        {initial}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block font-medium">{name}</span>
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {member.email}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    {loyaltyTierLabel(member.tier)}
                    <span className="ms-2 font-mono text-xs text-muted-foreground">
                      {member.tier}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-end tabular-nums"
                    dir="ltr"
                  >
                    {faNum(member.points_balance)}
                  </TableCell>
                  <TableCell
                    className="text-end tabular-nums"
                    dir="ltr"
                  >
                    {faNum(member.lifetime_points)}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground tabular-nums">
                    {faDate(member.updated_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        page={pagination.page}
        totalPages={pagination.total_pages}
        hasPrev={pagination.has_prev}
        hasNext={pagination.has_next}
        prevHref={membersPageHref(filters, pagination.page - 1)}
        nextHref={membersPageHref(filters, pagination.page + 1)}
        ariaLabel="صفحه‌بندی اعضای باشگاه"
        className="mt-6"
        label={
          <>
            {faNum(pagination.total_items)} عضو · صفحهٔ {faNum(pagination.page)} از{" "}
            {faNum(pagination.total_pages)}
          </>
        }
      />
    </>
  );
}