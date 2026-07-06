import { Suspense } from "react";
import Link from "next/link";
import { Users, AlertCircle } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi, ApiError } from "@/lib/api/client";
import type { UserListItem } from "@/lib/api/admin-client";
import type { Paginated } from "@/lib/catalog/types";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/catalog/labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import {
  UserStatusBadge,
  UserRoleBadge,
} from "@/components/admin/status-badge";
import {
  UsersSearch,
  UsersListSkeleton,
} from "@/features/admin/customers/components/UsersList";

const PAGE_SIZE = 20;

type SearchParams = { q?: string | string[]; page?: string | string[] };

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Builds an href to this page preserving the search query, swapping the page. */
function pageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/customers?${qs}` : "/admin/customers";
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const sp = await searchParams;
  const query = first(sp.q).trim();
  const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  return (
    <>
      <PageHeader
        title="مشتریان"
        description="کاربران ثبت‌شده در فروشگاه"
        actions={<UsersSearch initialQuery={query} />}
      />
      <Suspense key={`${query}|${page}`} fallback={<UsersListSkeleton />}>
        <UsersTable query={query} page={page} />
      </Suspense>
    </>
  );
}

async function UsersTable({ query, page }: { query: string; page: number }) {
  let data: Paginated<UserListItem> | null = null;
  let failed = false;
  try {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (query) qs.set("search", query);
    data = await serverApi<Paginated<UserListItem>>(
      `/admin/users?${qs.toString()}`,
    );
  } catch (e) {
    if (e instanceof ApiError) failed = true;
    else throw e;
  }

  if (failed || !data) {
    return (
      <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          aria-hidden
        >
          <AlertCircle className="size-6" />
        </span>
        <p className="font-serif text-lg">بارگذاری کاربران ناموفق بود</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          در ارتباط با سرور خطایی رخ داد. لطفاً چند لحظه بعد دوباره تلاش کنید.
        </p>
      </div>
    );
  }

  const { results, pagination } = data;

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
          {query ? "نتیجه‌ای یافت نشد" : "هنوز کاربری ثبت نشده است"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {query
            ? "برای این جستجو کاربری پیدا نشد. عبارت دیگری را امتحان کنید."
            : "به‌محض ثبت‌نام کاربران، فهرست آن‌ها اینجا نمایش داده می‌شود."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
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
                تاریخ عضویت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((u) => {
              const fullName = [u.first_name, u.last_name]
                .filter(Boolean)
                .join(" ")
                .trim();
              const initial = (fullName || u.email)
                .trim()
                .charAt(0)
                .toUpperCase();
              return (
                <TableRow key={u.user_id} className="border-border/40">
                  <TableCell>
                    <Link
                      href={`/admin/customers/${u.user_id}`}
                      className="-mx-2 -my-1 flex items-center gap-3 rounded-lg px-2 py-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary">
                        {initial}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block font-medium">
                          {fullName || "—"}
                        </span>
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {u.email}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <UserRoleBadge role={u.role} />
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge active={u.is_active} />
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground tabular-nums">
                    {faDate(u.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {faNum(pagination.total_items)} کاربر · صفحهٔ {faNum(pagination.page)}{" "}
          از {faNum(pagination.total_pages)}
        </p>
        <div className="flex items-center gap-2">
          {pagination.has_prev ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="cursor-pointer"
            >
              <Link href={pageHref(query, pagination.page - 1)} rel="prev">
                قبلی
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              قبلی
            </Button>
          )}
          {pagination.has_next ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="cursor-pointer"
            >
              <Link href={pageHref(query, pagination.page + 1)} rel="next">
                بعدی
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              بعدی
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
