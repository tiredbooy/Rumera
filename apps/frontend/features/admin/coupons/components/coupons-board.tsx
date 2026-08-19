"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, Loader2, Pencil, Plus, TicketPercent } from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  AdminFilterChips,
  AdminSavedViews,
  FilterSearchInput,
  FilterSelect,
  useFilterParams,
  type FilterChip,
  type FilterParamLabels,
} from "@/features/dashboard/components/admin-filter-controls";
import {
  AdminFilterBar,
  AdminPage,
} from "@/features/dashboard/components/admin-page";
import { faNum, formatPrice } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

const PAGE_SIZE = 20;
type StatusFilter = "all" | "current" | "inactive";

const STATUS_OPTIONS = [
  { value: "", label: "همهٔ وضعیت‌ها" },
  { value: "current", label: "فعال در بازهٔ زمانی" },
  { value: "inactive", label: "غیرفعال" },
];

const TYPE_FA: Record<DiscountType, string> = {
  percentage: "درصدی",
  fixed_amount: "مبلغ ثابت",
  free_shipping: "ارسال رایگان",
};

const TYPE_OPTIONS = [
  { value: "", label: "همهٔ انواع" },
  ...(Object.keys(TYPE_FA) as DiscountType[]).map((value) => ({
    value,
    label: TYPE_FA[value],
  })),
];

/** Every param this list owns — feeds the chips and the saved-view menu. */
const COUPON_FILTER_PARAMS: FilterParamLabels = {
  q: "جستجو",
  status: "وضعیت",
  type: "نوع تخفیف",
};

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

function couponChips(
  query: string,
  status: StatusFilter,
  type: DiscountType | undefined,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query) chips.push({ param: "q", label: `جستجو: ${query}` });
  if (status !== "all") {
    chips.push({
      param: "status",
      label: status === "current" ? "فعال در بازهٔ زمانی" : "غیرفعال",
    });
  }
  if (type) chips.push({ param: "type", label: `نوع: ${TYPE_FA[type]}` });
  return chips;
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
  const searchParams = useSearchParams();
  const setFilters = useFilterParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = positivePage(searchParams.get("page"));
  const status = statusFilter(searchParams.get("status"));
  const type = discountTypeFilter(searchParams.get("type"));
  const [archiveTarget, setArchiveTarget] = React.useState<Coupon | null>(null);

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
    setFilters({ page: lastPage > 1 ? String(lastPage) : undefined });
  }, [coupons.data, outOfRangePage, setFilters]);

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

  const hasFilters = Boolean(query) || status !== "all" || Boolean(type);

  return (
    <AdminPage
      title="کدهای تخفیف"
      description="کدها، بازهٔ اعتبار، محدودیت مصرف و دامنهٔ کاربرد را مدیریت کنید."
      action={
        <Button size="sm" asChild>
          <Link href="/admin/coupons/new">
            <Plus className="size-4" /> کد جدید
          </Link>
        </Button>
      }
      filters={
        <AdminFilterBar
          id="coupons-filter-title"
          title="جستجو و فیلتر کدها"
          hasFilters={hasFilters}
          onReset={() =>
            setFilters({ q: undefined, status: undefined, type: undefined })
          }
          gridClassName="sm:grid-cols-[minmax(0,1fr)_11rem_11rem]"
          chips={
            <>
              <AdminFilterChips
                params={COUPON_FILTER_PARAMS}
                chips={couponChips(query, status, type)}
              />
              <AdminSavedViews list="coupons" params={COUPON_FILTER_PARAMS} />
            </>
          }
        >
          <FilterSearchInput
            id="coupons-query"
            label="جستجوی کد تخفیف"
            placeholder="جستجو بر اساس کد…"
            value={query}
          />
          <FilterSelect
            id="coupons-status"
            label="وضعیت"
            param="status"
            value={status === "all" ? "" : status}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            id="coupons-type"
            label="نوع تخفیف"
            param="type"
            value={type ?? ""}
            options={TYPE_OPTIONS}
          />
        </AdminFilterBar>
      }
      pagination={
        coupons.data &&
        (coupons.data.pagination.total_items > 0 ||
          coupons.data.pagination.has_prev ||
          coupons.data.pagination.has_next) ? (
          <ListPagination
            page={coupons.data.pagination.page}
            totalPages={coupons.data.pagination.total_pages}
            hasPrev={coupons.data.pagination.has_prev}
            hasNext={coupons.data.pagination.has_next}
            onPrev={() =>
              setFilters({
                page: previousPage > 1 ? String(previousPage) : undefined,
              })
            }
            onNext={() => setFilters({ page: String(page + 1) })}
            disabled={coupons.isFetching}
            ariaLabel="صفحه‌بندی کدهای تخفیف"
            label={
              <>
                {faNum(coupons.data.pagination.total_items)} کد · صفحهٔ{" "}
                {faNum(coupons.data.pagination.page)} از{" "}
                {faNum(coupons.data.pagination.total_pages)}
              </>
            }
          />
        ) : null
      }
    >
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
              : hasFilters
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
    </AdminPage>
  );
}
