import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { Users } from "lucide-react";

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
import { PageHeader } from "@/features/dashboard/components/page-header";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

import { UsersListSkeleton, UsersSearch } from "./UsersList";

const PAGE_SIZE = 20;

export type CustomersSearchParams = {
  q?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function pageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/customers?${qs}` : "/admin/customers";
}

export function CustomersView({
  searchParams,
}: {
  searchParams: CustomersSearchParams;
}) {
  const query = first(searchParams.q).trim();
  const page = Math.max(1, Number.parseInt(first(searchParams.page), 10) || 1);

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
  const data = await listUsers({
    page,
    limit: PAGE_SIZE,
    search: query || undefined,
  });

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
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary">
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
                    <UserStatusBadge active={user.is_active} />
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
