"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Pencil,
  Plus,
  Power,
  RotateCw,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

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
import { ListPagination } from "@/components/list-pagination";
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
  ShippingApiError,
  useAdminShippingMethods,
  useDeleteAdminShippingMethod,
  useUpdateAdminShippingMethod,
} from "@/features/shipping/api";
import type {
  ShippingMethod,
  ShippingMethodListQuery,
  ShippingRateType,
} from "@/features/shipping/types";
import { faNum, formatPrice } from "@/lib/products";

const PAGE_SIZE = 12;
type MethodStatusFilter = "all" | "active" | "inactive";
type MethodSort = "newest" | "name_asc" | "rate_asc" | "rate_desc";

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function methodStatus(value: string | null): MethodStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

function methodSort(value: string | null): MethodSort {
  return value === "name_asc" || value === "rate_asc" || value === "rate_desc"
    ? value
    : "newest";
}

function rateType(value: string | null): ShippingRateType | undefined {
  return value === "flat_rate" ||
    value === "per_kg" ||
    value === "percentage" ||
    value === "free"
    ? value
    : undefined;
}

function MethodSearch({
  initialValue,
  onCommit,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  React.useEffect(() => {
    if (value.trim() === initialValue) return;
    const timer = window.setTimeout(() => onCommit(value.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [initialValue, onCommit, value]);

  return (
    <label className="relative block min-w-0">
      <span className="sr-only">جستجوی روش ارسال</span>
      <Search
        className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جستجوی نام روش…"
        className="ps-9"
      />
    </label>
  );
}

function rateSummary(method: ShippingMethod): string {
  switch (method.rate_type) {
    case "free":
      return "رایگان";
    case "percentage":
      return `${faNum(method.base_rate)}٪ از سفارش`;
    case "per_kg":
      return `${formatPrice(method.base_rate)} / کیلوگرم`;
    default:
      return formatPrice(method.base_rate);
  }
}

function deliverySummary(method: ShippingMethod): string {
  if (method.min_delivery_days != null && method.max_delivery_days != null) {
    return `${faNum(method.min_delivery_days)} تا ${faNum(method.max_delivery_days)} روز`;
  }
  if (method.min_delivery_days != null) {
    return `از ${faNum(method.min_delivery_days)} روز`;
  }
  if (method.max_delivery_days != null) {
    return `تا ${faNum(method.max_delivery_days)} روز`;
  }
  return "بدون برآورد";
}

function MethodActions({
  zoneID,
  method,
  busy,
  pending,
  onToggle,
  onDelete,
}: {
  zoneID: number;
  method: ShippingMethod;
  busy: boolean;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="ghost" size="icon" asChild>
        <Link
          href={`/admin/shipping/${zoneID}/methods/${method.id}`}
          aria-label={`ویرایش روش ${method.name}`}
        >
          <Pencil className="size-4" />
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={busy}
        aria-label={`${method.is_active ? "غیرفعال" : "فعال"} کردن روش ${method.name}`}
        onClick={onToggle}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Power className="size-4" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={busy}
        aria-label={`حذف روش ${method.name}`}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function ShippingMethodsPanel({ zoneID }: { zoneID: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("methods_q")?.trim() ?? "";
  const page = positivePage(searchParams.get("methods_page"));
  const status = methodStatus(searchParams.get("methods_status"));
  const type = rateType(searchParams.get("rate_type"));
  const sort = methodSort(searchParams.get("methods_sort"));
  const [deleteTarget, setDeleteTarget] = React.useState<ShippingMethod | null>(
    null,
  );
  const [actionError, setActionError] = React.useState<string | null>(null);

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
      if (resetPage) params.delete("methods_page");
      const suffix = params.toString();
      const href = suffix ? `${pathname}?${suffix}` : pathname;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router, searchParams],
  );
  const commitSearch = React.useCallback(
    (value: string) => updateURL({ methods_q: value || undefined }, true),
    [updateURL],
  );

  const listQuery: ShippingMethodListQuery = {
    page,
    limit: PAGE_SIZE,
    search: query || undefined,
    rate_type: type,
    ...(status === "active"
      ? { is_active: true }
      : status === "inactive"
        ? { is_active: false }
        : {}),
    ...(sort === "name_asc"
      ? { sortBy: "name", orderBy: "asc" }
      : sort === "rate_asc"
        ? { sortBy: "base_rate", orderBy: "asc" }
        : sort === "rate_desc"
          ? { sortBy: "base_rate", orderBy: "desc" }
          : { sortBy: "created_at", orderBy: "desc" }),
  };
  const methods = useAdminShippingMethods(zoneID, listQuery);
  const updateMethod = useUpdateAdminShippingMethod(zoneID);
  const deleteMethod = useDeleteAdminShippingMethod(zoneID);
  const mutationBusy = updateMethod.isPending || deleteMethod.isPending;
  const outOfRangePage = Boolean(
    methods.data &&
    methods.data.results.length === 0 &&
    methods.data.pagination.total_items > 0 &&
    page > methods.data.pagination.total_pages,
  );

  React.useEffect(() => {
    if (!outOfRangePage || !methods.data) return;
    const lastPage = methods.data.pagination.total_pages;
    updateURL(
      { methods_page: lastPage > 1 ? String(lastPage) : undefined },
      false,
      true,
    );
  }, [methods.data, outOfRangePage, updateURL]);

  async function toggleMethod(method: ShippingMethod) {
    setActionError(null);
    try {
      await updateMethod.mutateAsync({
        id: method.id,
        input: { is_active: !method.is_active },
      });
      toast.success(
        method.is_active ? "روش ارسال غیرفعال شد" : "روش ارسال فعال شد",
      );
    } catch (error) {
      const message =
        error instanceof ShippingApiError
          ? error.message
          : "تغییر وضعیت روش ارسال ناموفق بود";
      setActionError(message);
      toast.error(message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteMethod.mutateAsync(deleteTarget.id);
      toast.success("روش ارسال حذف شد");
      setDeleteTarget(null);
    } catch (error) {
      const message =
        error instanceof ShippingApiError
          ? error.message
          : "حذف روش ارسال ناموفق بود";
      setActionError(message);
      toast.error(message);
    }
  }

  return (
    <section className="mt-10 min-w-0" aria-labelledby="shipping-methods-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="shipping-methods-title" className="font-serif text-xl">
            روش‌های ارسال
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            نرخ، آستانهٔ رایگان، وزن و زمان تحویل را مدیریت کنید و فهرست را مرتب
            کنید.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href={`/admin/shipping/${zoneID}/methods/new`}>
            <Plus className="size-4" /> روش جدید
          </Link>
        </Button>
      </div>

      <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_11rem_11rem]">
        <MethodSearch
          key={query}
          initialValue={query}
          onCommit={commitSearch}
        />
        <Select
          value={status}
          onValueChange={(value) =>
            updateURL(
              { methods_status: value === "all" ? undefined : value },
              true,
            )
          }
        >
          <SelectTrigger className="w-full" aria-label="فیلتر وضعیت روش">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ وضعیت‌ها</SelectItem>
            <SelectItem value="active">فعال</SelectItem>
            <SelectItem value="inactive">غیرفعال</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={type ?? "all"}
          onValueChange={(value) =>
            updateURL({ rate_type: value === "all" ? undefined : value }, true)
          }
        >
          <SelectTrigger className="w-full" aria-label="فیلتر نوع نرخ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ نرخ‌ها</SelectItem>
            <SelectItem value="flat_rate">ثابت</SelectItem>
            <SelectItem value="per_kg">وزنی</SelectItem>
            <SelectItem value="percentage">درصدی</SelectItem>
            <SelectItem value="free">رایگان</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(value) =>
            updateURL(
              { methods_sort: value === "newest" ? undefined : value },
              true,
            )
          }
        >
          <SelectTrigger className="w-full" aria-label="ترتیب روش‌ها">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">جدیدترین</SelectItem>
            <SelectItem value="name_asc">نام، صعودی</SelectItem>
            <SelectItem value="rate_asc">نرخ، کم به زیاد</SelectItem>
            <SelectItem value="rate_desc">نرخ، زیاد به کم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {methods.isLoading ? (
        <div
          role="status"
          aria-label="در حال بارگذاری روش‌های ارسال"
          className="grid gap-3 sm:grid-cols-2"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-hairline space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
            >
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : null}

      {methods.isError && !methods.data ? (
        <div
          role="alert"
          className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-5 py-12 text-center ring-1 ring-foreground/[0.04]"
        >
          <p>بارگذاری روش‌های ارسال ناموفق بود</p>
          <Button variant="outline" size="sm" onClick={() => methods.refetch()}>
            <RotateCw className="size-4" /> تلاش مجدد
          </Button>
        </div>
      ) : null}

      {methods.isError && methods.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>
            به‌روزرسانی روش‌ها ناموفق بود؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی
            باشد.
          </p>
          <Button variant="outline" size="sm" onClick={() => methods.refetch()}>
            <RotateCw className="size-4" /> تلاش مجدد
          </Button>
        </div>
      ) : null}

      {methods.data && methods.data.results.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-5 py-12 text-center ring-1 ring-foreground/[0.04]">
          <Truck className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {outOfRangePage
              ? "در حال بازگشت به آخرین صفحه…"
              : query || status !== "all" || type
                ? "روشی با این فیلتر پیدا نشد"
                : "هنوز روشی برای این منطقه ساخته نشده است"}
          </p>
        </div>
      ) : null}

      {methods.data && methods.data.results.length > 0 ? (
        <div aria-busy={methods.isFetching || mutationBusy || undefined}>
          <div className="grid gap-3 lg:hidden">
            {methods.data.results.map((method) => {
              const pending =
                updateMethod.isPending &&
                updateMethod.variables?.id === method.id;
              return (
                <article
                  key={method.id}
                  className="border-hairline min-w-0 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/shipping/${zoneID}/methods/${method.id}`}
                        className="rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {method.name}
                      </Link>
                      {method.carrier ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {method.carrier}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant={method.is_active ? "default" : "secondary"}>
                      {method.is_active ? "فعال" : "غیرفعال"}
                    </Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">نرخ</dt>
                    <dd className="text-end">{rateSummary(method)}</dd>
                    <dt className="text-muted-foreground">تحویل</dt>
                    <dd className="text-end">{deliverySummary(method)}</dd>
                    <dt className="text-muted-foreground">حداکثر وزن</dt>
                    <dd className="text-end">
                      {method.max_weight_kg != null
                        ? `${faNum(method.max_weight_kg)} کیلوگرم`
                        : "بدون محدودیت"}
                    </dd>
                    <dt className="text-muted-foreground">آستانهٔ رایگان</dt>
                    <dd className="text-end">
                      {method.free_above_amount != null
                        ? formatPrice(method.free_above_amount)
                        : "ندارد"}
                    </dd>
                  </dl>
                  <div className="mt-3 border-t border-border/50 pt-2">
                    <MethodActions
                      zoneID={zoneID}
                      method={method}
                      busy={mutationBusy}
                      pending={pending}
                      onToggle={() => void toggleMethod(method)}
                      onDelete={() => setDeleteTarget(method)}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-hairline hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] lg:block">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[24%] text-start">روش</TableHead>
                  <TableHead className="w-[22%] text-start">نرخ</TableHead>
                  <TableHead className="w-[18%] text-start">تحویل</TableHead>
                  <TableHead className="w-[14%] text-start">وضعیت</TableHead>
                  <TableHead className="w-[22%] text-end">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.data.results.map((method) => {
                  const pending =
                    updateMethod.isPending &&
                    updateMethod.variables?.id === method.id;
                  return (
                    <TableRow key={method.id}>
                      <TableCell className="align-top">
                        <Link
                          href={`/admin/shipping/${zoneID}/methods/${method.id}`}
                          className="rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {method.name}
                        </Link>
                        {method.carrier ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {method.carrier}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {rateSummary(method)}
                        {method.free_above_amount != null ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            رایگان از {formatPrice(method.free_above_amount)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {deliverySummary(method)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant={method.is_active ? "default" : "secondary"}
                        >
                          {method.is_active ? "فعال" : "غیرفعال"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <MethodActions
                          zoneID={zoneID}
                          method={method}
                          busy={mutationBusy}
                          pending={pending}
                          onToggle={() => void toggleMethod(method)}
                          onDelete={() => setDeleteTarget(method)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {methods.data && methods.data.pagination.total_items > 0 ? (
        <ListPagination
          page={methods.data.pagination.page}
          totalPages={methods.data.pagination.total_pages}
          hasPrev={methods.data.pagination.has_prev}
          hasNext={methods.data.pagination.has_next}
          onPrev={() =>
            updateURL({
              methods_page: page > 2 ? String(page - 1) : undefined,
            })
          }
          onNext={() => updateURL({ methods_page: String(page + 1) })}
          disabled={methods.isFetching}
          ariaLabel="صفحه‌بندی روش‌های ارسال"
          className="mt-4"
          label={
            <>
              {faNum(methods.data.pagination.total_items)} روش · صفحهٔ{" "}
              {faNum(methods.data.pagination.page)} از{" "}
              {faNum(methods.data.pagination.total_pages)}
            </>
          }
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) =>
          !open && !deleteMethod.isPending && setDeleteTarget(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف روش ارسال</AlertDialogTitle>
            <AlertDialogDescription>
              روش {deleteTarget?.name} برای همیشه حذف می‌شود. برای توقف موقت، آن
              را غیرفعال کنید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMethod.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMethod.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteMethod.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              حذف روش
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
