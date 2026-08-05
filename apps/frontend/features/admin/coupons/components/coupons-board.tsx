"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  TicketPercent,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CouponApiError,
  useAdminCoupons,
  useDeactivateAdminCoupon,
} from "@/features/coupons/api";
import type {
  Coupon,
  CouponListQuery,
  DiscountType,
} from "@/features/coupons/types";
import { DashboardErrorState } from "@/features/dashboard/components/async-state";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { faNum, formatPrice } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

const PAGE_SIZE = 20;
type StatusFilter = "all" | "current" | "inactive";

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function statusFilter(value: string | null): StatusFilter {
  return value === "current" || value === "inactive" ? value : "all";
}

function discountTypeFilter(value: string | null): DiscountType | undefined {
  return value === "percentage" ||
    value === "fixed_amount" ||
    value === "free_shipping"
    ? value
    : undefined;
}

function discountLabel(coupon: Coupon): string {
  if (coupon.discount_type === "free_shipping") return "ارسال رایگان";
  if (coupon.discount_type === "percentage") {
    return `${faNum(coupon.discount_value)}٪`;
  }
  return formatPrice(coupon.discount_value);
}

function couponStatus(coupon: Coupon): {
  label: string;
  variant: "default" | "secondary" | "outline";
} {
  if (!coupon.is_active) return { label: "غیرفعال", variant: "secondary" };
  if (coupon.is_exhausted) return { label: "تمام‌شده", variant: "secondary" };
  const now = Date.now();
  if (new Date(coupon.starts_at).getTime() > now) {
    return { label: "زمان‌بندی‌شده", variant: "outline" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    return { label: "منقضی", variant: "secondary" };
  }
  return { label: "فعال", variant: "default" };
}

function LoadingTable() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری کدهای تخفیف"
      className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
    >
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border/40 px-4 py-4 last:border-0"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="ms-auto h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

export function CouponsBoard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = positivePage(searchParams.get("page"));
  const status = statusFilter(searchParams.get("status"));
  const type = discountTypeFilter(searchParams.get("type"));
  const [search, setSearch] = React.useState(query);
  const [lastQuery, setLastQuery] = React.useState(query);
  const [archiveTarget, setArchiveTarget] = React.useState<Coupon | null>(null);

  if (query !== lastQuery) {
    setLastQuery(query);
    setSearch(query);
  }

  const updateURL = React.useCallback(
    (
      updates: Record<string, string | undefined>,
      resetPage = false,
      replace = false,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (resetPage) params.delete("page");
      const suffix = params.toString();
      const href = suffix ? `${pathname}?${suffix}` : pathname;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (search.trim() === query) return;
    const timer = window.setTimeout(
      () => updateURL({ q: search.trim() || undefined }, true),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [query, search, updateURL]);

  const listQuery: CouponListQuery = {
    page,
    limit: PAGE_SIZE,
    sortBy: "created_at",
    orderBy: "desc",
    search: query || undefined,
    discount_type: type,
    ...(status === "current"
      ? { active_only: true }
      : status === "inactive"
        ? { is_active: false }
        : {}),
  };
  const coupons = useAdminCoupons(listQuery);
  const deactivate = useDeactivateAdminCoupon();
  const outOfRangePage = Boolean(
    coupons.data &&
    coupons.data.results.length === 0 &&
    coupons.data.pagination.total_items > 0 &&
    page > coupons.data.pagination.total_pages,
  );
  const previousPage = coupons.data
    ? Math.min(page - 1, coupons.data.pagination.total_pages)
    : page - 1;

  React.useEffect(() => {
    if (!outOfRangePage || !coupons.data) return;
    const lastPage = coupons.data.pagination.total_pages;
    updateURL(
      { page: lastPage > 1 ? String(lastPage) : undefined },
      false,
      true,
    );
  }, [coupons.data, outOfRangePage, updateURL]);

  async function confirmDeactivate() {
    if (!archiveTarget) return;
    try {
      await deactivate.mutateAsync(archiveTarget.id);
      toast.success("کد تخفیف غیرفعال شد");
      setArchiveTarget(null);
    } catch (error) {
      toast.error(
        error instanceof CouponApiError
          ? error.message
          : "غیرفعال‌سازی کد تخفیف ناموفق بود",
      );
    }
  }

  const mutationError = deactivate.error
    ? deactivate.error instanceof CouponApiError
      ? deactivate.error.message
      : "غیرفعال‌سازی کد تخفیف ناموفق بود"
    : null;

  return (
    <>
      <PageHeader
        title="کدهای تخفیف"
        description="کدها، بازهٔ اعتبار، محدودیت مصرف و دامنهٔ کاربرد را مدیریت کنید."
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/coupons/new">
              <Plus className="size-4" /> کد جدید
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <label className="relative block">
          <span className="sr-only">جستجوی کد تخفیف</span>
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو بر اساس کد…"
            className="ps-9"
          />
        </label>
        <Select
          value={status}
          onValueChange={(value) =>
            updateURL({ status: value === "all" ? undefined : value }, true)
          }
        >
          <SelectTrigger className="w-full" aria-label="فیلتر وضعیت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ وضعیت‌ها</SelectItem>
            <SelectItem value="current">فعال در بازهٔ زمانی</SelectItem>
            <SelectItem value="inactive">غیرفعال</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={type ?? "all"}
          onValueChange={(value) =>
            updateURL({ type: value === "all" ? undefined : value }, true)
          }
        >
          <SelectTrigger className="w-full" aria-label="فیلتر نوع تخفیف">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ انواع</SelectItem>
            <SelectItem value="percentage">درصدی</SelectItem>
            <SelectItem value="fixed_amount">مبلغ ثابت</SelectItem>
            <SelectItem value="free_shipping">ارسال رایگان</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mutationError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}

      {coupons.isLoading ? <LoadingTable /> : null}

      {coupons.isError ? (
        <DashboardErrorState
          title="بارگذاری کدهای تخفیف ناموفق بود"
          description="فهرست کدها از سرور دریافت نشد. پس از اطمینان از اتصال دوباره تلاش کنید."
          onRetry={() => void coupons.refetch()}
          isRetrying={coupons.isFetching}
        />
      ) : null}

      {coupons.data && coupons.data.results.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <TicketPercent className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {outOfRangePage
              ? "در حال بازگشت به آخرین صفحه…"
              : query || status !== "all" || type
                ? "کدی با این فیلتر پیدا نشد"
                : "هنوز کد تخفیفی ساخته نشده است"}
          </p>
        </div>
      ) : null}

      {coupons.data && coupons.data.results.length > 0 ? (
        <div
          className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
          aria-busy={coupons.isFetching || undefined}
        >
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-start">کد</TableHead>
                <TableHead className="text-start">تخفیف</TableHead>
                <TableHead className="text-start">مصرف</TableHead>
                <TableHead className="text-start">حداقل سفارش</TableHead>
                <TableHead className="text-start">اعتبار</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="w-28 text-end">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.data.results.map((coupon) => {
                const statusMeta = couponStatus(coupon);
                const pending =
                  deactivate.isPending && deactivate.variables === coupon.id;
                return (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <Link
                        href={`/admin/coupons/${coupon.id}`}
                        className="rounded-lg font-mono font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        dir="ltr"
                      >
                        {coupon.code}
                      </Link>
                    </TableCell>
                    <TableCell>{discountLabel(coupon)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {coupon.max_uses != null
                        ? `${faNum(coupon.total_uses)} / ${faNum(coupon.max_uses)}`
                        : faNum(coupon.total_uses)}
                    </TableCell>
                    <TableCell>
                      {formatPrice(coupon.min_order_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {coupon.expires_at
                        ? faDate(coupon.expires_at)
                        : "بدون پایان"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusMeta.variant}>
                        {statusMeta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/admin/coupons/${coupon.id}`}
                            aria-label={`ویرایش ${coupon.code}`}
                          >
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={!coupon.is_active || deactivate.isPending}
                          aria-label={`غیرفعال کردن ${coupon.code}`}
                          onClick={() => setArchiveTarget(coupon)}
                        >
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Archive className="size-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {coupons.data &&
      (coupons.data.pagination.total_items > 0 ||
        coupons.data.pagination.has_prev ||
        coupons.data.pagination.has_next) ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {faNum(coupons.data.pagination.total_items)} کد · صفحهٔ{" "}
            {faNum(coupons.data.pagination.page)} از{" "}
            {faNum(coupons.data.pagination.total_pages)}
            {coupons.isFetching ? (
              <Loader2
                className="ms-1 inline size-3 animate-spin"
                aria-hidden
              />
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!coupons.data.pagination.has_prev || coupons.isFetching}
              onClick={() =>
                updateURL({
                  page: previousPage > 1 ? String(previousPage) : undefined,
                })
              }
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!coupons.data.pagination.has_next || coupons.isFetching}
              onClick={() => updateURL({ page: String(page + 1) })}
            >
              بعدی
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) =>
          !open && !deactivate.isPending && setArchiveTarget(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>غیرفعال کردن کد تخفیف</AlertDialogTitle>
            <AlertDialogDescription>
              کد {archiveTarget?.code} حذف نمی‌شود و سابقهٔ مصرف آن حفظ خواهد
              شد، اما دیگر قابل استفاده نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivate.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deactivate.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeactivate();
              }}
            >
              {deactivate.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              غیرفعال کردن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
