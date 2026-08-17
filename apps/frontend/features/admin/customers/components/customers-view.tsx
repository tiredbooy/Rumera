import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";

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
import { listUsers } from "@/features/customers/api";
import { UserRoleBadge } from "@/features/customers/components/user-role-badge";
import { UserStatusBadge } from "@/features/customers/components/user-status-badge";
import type {
  UserListFilters,
  UserListSearchParams,
} from "@/features/customers/types";
import { parseUserListFilters } from "@/features/customers/validations";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { ApiError } from "@/lib/api/errors";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

import { UsersFilters, UsersListError, UsersListSkeleton } from "./UsersList";

const PAGE_SIZE = 20;

export type CustomersSearchParams = UserListSearchParams;

export function usersPageHref(filters: UserListFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.role) params.set("role", filters.role);
  if (filters.status !== "all") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/customers?${qs}` : "/admin/customers";
}

/**
 * CF-1. This used to require the internal bigint, which no customers response
 * has ever contained — so it returned undefined for every real row and the
 * orders count rendered as dead text. `GET /admin/orders` now accepts the public
 * UUID, which is the id this screen actually holds.
 *
 * Still guarded: only the public UUID shape produces a link, so a numeric id or
 * a stray string cannot build a filter that silently matches the wrong customer.
 */
const PUBLIC_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adminOrdersForUserHref(userId: string): string | undefined {
  const id = userId.trim();
  if (!PUBLIC_USER_ID.test(id)) return undefined;
  return `/admin/orders?user_uuid=${encodeURIComponent(id)}`;
}

function UserOrdersCount({
  userId,
  totalOrders,
}: {
  userId: string;
  totalOrders: number;
}) {
  const label = (
    <span className="tabular-nums">{faNum(totalOrders)} سفارش</span>
  );
  const href = adminOrdersForUserHref(userId);
  if (!href) return label;
  return (
    <Link
      href={href}
      className="-m-1 inline-flex min-h-11 items-center rounded-lg p-1 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {label}
    </Link>
  );
}

export function CustomersView({
  searchParams,
  canWrite,
}: {
  searchParams: CustomersSearchParams;
  canWrite: boolean;
}) {
  const filters = parseUserListFilters(searchParams);

  return (
    <AdminPage
      title="کاربران"
      description="مدیریت همهٔ حساب‌های فعال و غیرفعال، نقش‌ها و وضعیت دسترسی"
      action={
        canWrite ? (
          <Button asChild size="sm">
            <Link href="/admin/customers/new">
              <Plus className="size-4" aria-hidden />
              ساخت کاربر
            </Link>
          </Button>
        ) : null
      }
      filters={<UsersFilters filters={filters} />}
    >
      <Suspense
        key={`${filters.query}|${filters.role ?? "all"}|${filters.status}|${filters.page}`}
        fallback={<UsersListSkeleton />}
      >
        <UsersTable filters={filters} canWrite={canWrite} />
      </Suspense>
    </AdminPage>
  );
}

export async function UsersTable({
  filters,
  canWrite,
}: {
  filters: UserListFilters;
  canWrite: boolean;
}) {
  let data;
  try {
    data = await listUsers({
      page: filters.page,
      limit: PAGE_SIZE,
      search: filters.query || undefined,
      role: filters.role,
      is_active:
        filters.status === "active"
          ? true
          : filters.status === "inactive"
            ? false
            : undefined,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return <UsersListError />;
  }

  const { results, pagination } = data;
  if (filters.page > pagination.total_pages) {
    redirect(usersPageHref(filters, pagination.total_pages));
  }
  const hasFilters =
    Boolean(filters.query) || Boolean(filters.role) || filters.status !== "all";

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
            ? "کاربری با این فیلترها یافت نشد"
            : "هنوز کاربری ثبت نشده است"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "فیلترها یا عبارت جستجو را تغییر دهید. حساب‌های غیرفعال نیز با انتخاب وضعیت مناسب قابل مشاهده‌اند."
            : "پس از ثبت یا ساخت نخستین حساب، اطلاعات آن در این فهرست نمایش داده می‌شود."}
        </p>
        {hasFilters ? (
          <Button
            variant="outline"
            size="lg"
            asChild
            className="mt-1 cursor-pointer"
          >
            <Link href="/admin/customers">پاک کردن فیلترها</Link>
          </Button>
        ) : canWrite ? (
          <Button size="lg" asChild className="mt-1 cursor-pointer">
            <Link href="/admin/customers/new">ساخت نخستین کاربر</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {results.map((user) => {
          const initial = (user.full_name || user.email)
            .trim()
            .charAt(0)
            .toUpperCase();
          return (
            <article
              key={user.user_id}
              className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
            >
              <Link
                href={`/admin/customers/${user.user_id}`}
                className="-m-1 flex min-h-11 items-center gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary"
                  aria-hidden
                >
                  {initial}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-medium">
                    {user.full_name || "بدون نام"}
                  </span>
                  <span
                    className="mt-1 block truncate text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {user.email}
                  </span>
                </span>
              </Link>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                <div>
                  <dt className="mb-1.5 text-muted-foreground">نقش</dt>
                  <dd>
                    <UserRoleBadge role={user.role} />
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-muted-foreground">وضعیت</dt>
                  <dd>
                    <UserStatusBadge
                      active={user.is_active}
                      banned={user.is_banned}
                    />
                  </dd>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                  <dt className="text-muted-foreground">سفارش‌ها</dt>
                  <dd>
                    <UserOrdersCount
                      userId={user.user_id}
                      totalOrders={user.total_orders}
                    />
                  </dd>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">تاریخ عضویت</dt>
                  <dd className="tabular-nums">{faDate(user.created_at)}</dd>
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
                نام
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                نقش
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                وضعیت
              </TableHead>
              <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                سفارش‌ها
              </TableHead>
              <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                تاریخ عضویت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((user) => {
              const initial = (user.full_name || user.email)
                .trim()
                .charAt(0)
                .toUpperCase();
              return (
                <TableRow key={user.user_id} className="border-border/40">
                  <TableCell>
                    <Link
                      href={`/admin/customers/${user.user_id}`}
                      className="-mx-2 -my-1 flex items-center gap-3 rounded-lg px-2 py-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary"
                        aria-hidden
                      >
                        {initial}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block font-medium">
                          {user.full_name || "—"}
                        </span>
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {user.email}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <UserRoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge
                      active={user.is_active}
                      banned={user.is_banned}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <UserOrdersCount
                      userId={user.user_id}
                      totalOrders={user.total_orders}
                    />
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground tabular-nums">
                    {faDate(user.created_at)}
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
        prevHref={usersPageHref(filters, pagination.page - 1)}
        nextHref={usersPageHref(filters, pagination.page + 1)}
        ariaLabel="صفحه‌بندی کاربران"
        className="mt-6"
        label={
          <>
            {faNum(pagination.total_items)} کاربر · صفحهٔ {faNum(pagination.page)}{" "}
            از {faNum(pagination.total_pages)}
          </>
        }
      />
    </>
  );
}
