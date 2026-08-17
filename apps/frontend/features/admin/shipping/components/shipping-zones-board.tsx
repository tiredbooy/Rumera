"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  Power,
  RotateCw,
  Search,
  Trash2,
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
  AdminFilterBar,
  AdminPage,
} from "@/features/dashboard/components/admin-page";
import {
  ShippingApiError,
  useAdminShippingZones,
  useDeleteAdminShippingZone,
  useUpdateAdminShippingZone,
} from "@/features/shipping/api";
import type {
  ShippingZone,
  ShippingZoneListQuery,
} from "@/features/shipping/types";
import { faNum } from "@/lib/products";

const PAGE_SIZE = 20;
type ZoneStatusFilter = "all" | "active" | "inactive";
type ZoneSort = "newest" | "name_asc" | "name_desc";

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function zoneStatus(value: string | null): ZoneStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

function zoneSort(value: string | null): ZoneSort {
  return value === "name_asc" || value === "name_desc" ? value : "newest";
}

function SearchControl({
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
      <span className="sr-only">جستجوی منطقهٔ ارسال</span>
      <Search
        className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جستجوی نام منطقه…"
        className="ps-9"
      />
    </label>
  );
}

function RegionCodes({ zone }: { zone: ShippingZone }) {
  const visible = zone.region_codes.slice(0, 4);
  const remaining = zone.region_codes.length - visible.length;
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5" dir="ltr">
      {visible.map((code) => (
        <Badge key={code} variant="outline" className="max-w-full font-mono">
          <span className="break-all">{code}</span>
        </Badge>
      ))}
      {remaining > 0 ? (
        <Badge variant="secondary">+{faNum(remaining)}</Badge>
      ) : null}
    </div>
  );
}

function LoadingZones() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری مناطق ارسال"
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="border-hairline space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-9 w-28" />
        </div>
      ))}
    </div>
  );
}

function ZoneActions({
  zone,
  busy,
  pending,
  onToggle,
  onDelete,
}: {
  zone: ShippingZone;
  busy: boolean;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="ghost" size="icon" asChild>
        <Link
          href={`/admin/shipping/${zone.id}`}
          aria-label={`ویرایش منطقهٔ ${zone.name}`}
        >
          <Pencil className="size-4" />
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={busy}
        aria-label={`${zone.is_active ? "غیرفعال" : "فعال"} کردن منطقهٔ ${zone.name}`}
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
        aria-label={`حذف منطقهٔ ${zone.name}`}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function ShippingZonesBoard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = positivePage(searchParams.get("page"));
  const status = zoneStatus(searchParams.get("status"));
  const sort = zoneSort(searchParams.get("sort"));
  const [deleteTarget, setDeleteTarget] = React.useState<ShippingZone | null>(
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
      if (resetPage) params.delete("page");
      const suffix = params.toString();
      const href = suffix ? `${pathname}?${suffix}` : pathname;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router, searchParams],
  );
  const commitSearch = React.useCallback(
    (value: string) => updateURL({ q: value || undefined }, true),
    [updateURL],
  );

  const listQuery: ShippingZoneListQuery = {
    page,
    limit: PAGE_SIZE,
    search: query || undefined,
    ...(status === "active"
      ? { is_active: true }
      : status === "inactive"
        ? { is_active: false }
        : {}),
    ...(sort === "name_asc"
      ? { sortBy: "name", orderBy: "asc" }
      : sort === "name_desc"
        ? { sortBy: "name", orderBy: "desc" }
        : { sortBy: "created_at", orderBy: "desc" }),
  };
  const zones = useAdminShippingZones(listQuery);
  const updateZone = useUpdateAdminShippingZone();
  const deleteZone = useDeleteAdminShippingZone();
  const mutationBusy = updateZone.isPending || deleteZone.isPending;
  const outOfRangePage = Boolean(
    zones.data &&
    zones.data.results.length === 0 &&
    zones.data.pagination.total_items > 0 &&
    page > zones.data.pagination.total_pages,
  );

  React.useEffect(() => {
    if (!outOfRangePage || !zones.data) return;
    const lastPage = zones.data.pagination.total_pages;
    updateURL(
      { page: lastPage > 1 ? String(lastPage) : undefined },
      false,
      true,
    );
  }, [outOfRangePage, updateURL, zones.data]);

  async function toggleZone(zone: ShippingZone) {
    setActionError(null);
    try {
      await updateZone.mutateAsync({
        id: zone.id,
        input: { is_active: !zone.is_active },
      });
      toast.success(
        zone.is_active ? "منطقهٔ ارسال غیرفعال شد" : "منطقهٔ ارسال فعال شد",
      );
    } catch (error) {
      const message =
        error instanceof ShippingApiError
          ? error.message
          : "تغییر وضعیت منطقهٔ ارسال ناموفق بود";
      setActionError(message);
      toast.error(message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteZone.mutateAsync(deleteTarget.id);
      toast.success("منطقه و روش‌های وابسته حذف شدند");
      setDeleteTarget(null);
    } catch (error) {
      const message =
        error instanceof ShippingApiError
          ? error.message
          : "حذف منطقهٔ ارسال ناموفق بود";
      setActionError(message);
      toast.error(message);
    }
  }

  return (
    <AdminPage
      title="ارسال و مناطق پوشش"
      description="محدوده‌های جغرافیایی را جستجو و مرتب کنید و فعال‌بودن گزینه‌های ارسال را مدیریت کنید."
      action={
        <Button size="sm" asChild>
          <Link href="/admin/shipping/new">
            <Plus className="size-4" /> منطقهٔ جدید
          </Link>
        </Button>
      }
      filters={
        <AdminFilterBar
          id="shipping-zones-filter-title"
          title="جستجو و فیلتر مناطق"
          hasFilters={Boolean(query) || status !== "all" || sort !== "newest"}
          onReset={() => router.push(pathname)}
          gridClassName="sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_12rem]"
        >
          <SearchControl
            key={query}
            initialValue={query}
            onCommit={commitSearch}
          />
          <Select
            value={status}
            onValueChange={(value) =>
              updateURL({ status: value === "all" ? undefined : value }, true)
            }
          >
            <SelectTrigger className="h-11 w-full" aria-label="فیلتر وضعیت منطقه">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همهٔ وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) =>
              updateURL({ sort: value === "newest" ? undefined : value }, true)
            }
          >
            <SelectTrigger
              className="h-11 w-full sm:col-span-2 lg:col-span-1"
              aria-label="ترتیب مناطق"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">جدیدترین</SelectItem>
              <SelectItem value="name_asc">نام، صعودی</SelectItem>
              <SelectItem value="name_desc">نام، نزولی</SelectItem>
            </SelectContent>
          </Select>
        </AdminFilterBar>
      }
      pagination={
        zones.data && zones.data.pagination.total_items > 0 ? (
          <ListPagination
            page={zones.data.pagination.page}
            totalPages={zones.data.pagination.total_pages}
            hasPrev={zones.data.pagination.has_prev}
            hasNext={zones.data.pagination.has_next}
            onPrev={() =>
              updateURL({ page: page > 2 ? String(page - 1) : undefined })
            }
            onNext={() => updateURL({ page: String(page + 1) })}
            disabled={zones.isFetching}
            ariaLabel="صفحه‌بندی مناطق ارسال"
            label={
              <>
                {faNum(zones.data.pagination.total_items)} منطقه · صفحهٔ{" "}
                {faNum(zones.data.pagination.page)} از{" "}
                {faNum(zones.data.pagination.total_pages)}
              </>
            }
          />
        ) : null
      }
    >
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {zones.isLoading ? <LoadingZones /> : null}

      {zones.isError && !zones.data ? (
        <div
          role="alert"
          className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-5 py-14 text-center ring-1 ring-foreground/[0.04]"
        >
          <p className="font-medium">بارگذاری مناطق ارسال ناموفق بود</p>
          <Button variant="outline" size="sm" onClick={() => zones.refetch()}>
            <RotateCw className="size-4" /> تلاش مجدد
          </Button>
        </div>
      ) : null}

      {zones.isError && zones.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>
            به‌روزرسانی مناطق ناموفق بود؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی
            باشد.
          </p>
          <Button variant="outline" size="sm" onClick={() => zones.refetch()}>
            <RotateCw className="size-4" /> تلاش مجدد
          </Button>
        </div>
      ) : null}

      {zones.data && zones.data.results.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-5 py-14 text-center ring-1 ring-foreground/[0.04]">
          <MapPinned className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {outOfRangePage
              ? "در حال بازگشت به آخرین صفحه…"
              : query || status !== "all"
                ? "منطقه‌ای با این فیلتر پیدا نشد"
                : "هنوز منطقهٔ ارسالی ساخته نشده است"}
          </p>
        </div>
      ) : null}

      {zones.data && zones.data.results.length > 0 ? (
        <div aria-busy={zones.isFetching || mutationBusy || undefined}>
          <div className="grid gap-3 md:hidden">
            {zones.data.results.map((zone) => {
              const pending =
                updateZone.isPending && updateZone.variables?.id === zone.id;
              return (
                <article
                  key={zone.id}
                  className="border-hairline min-w-0 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/shipping/${zone.id}`}
                        className="rounded-md font-serif text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {zone.name}
                      </Link>
                      {zone.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {zone.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant={zone.is_active ? "default" : "secondary"}>
                      {zone.is_active ? "فعال" : "غیرفعال"}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <RegionCodes zone={zone} />
                  </div>
                  <div className="mt-3 border-t border-border/50 pt-2">
                    <ZoneActions
                      zone={zone}
                      busy={mutationBusy}
                      pending={pending}
                      onToggle={() => void toggleZone(zone)}
                      onDelete={() => setDeleteTarget(zone)}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-hairline hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] md:block">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[28%] text-start">منطقه</TableHead>
                  <TableHead className="w-[34%] text-start">
                    کدهای پوشش
                  </TableHead>
                  <TableHead className="w-[16%] text-start">وضعیت</TableHead>
                  <TableHead className="w-[22%] text-end">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.data.results.map((zone) => {
                  const pending =
                    updateZone.isPending &&
                    updateZone.variables?.id === zone.id;
                  return (
                    <TableRow key={zone.id}>
                      <TableCell className="min-w-0 align-top">
                        <Link
                          href={`/admin/shipping/${zone.id}`}
                          className="rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {zone.name}
                        </Link>
                        {zone.description ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {zone.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <RegionCodes zone={zone} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant={zone.is_active ? "default" : "secondary"}
                        >
                          {zone.is_active ? "فعال" : "غیرفعال"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <ZoneActions
                          zone={zone}
                          busy={mutationBusy}
                          pending={pending}
                          onToggle={() => void toggleZone(zone)}
                          onDelete={() => setDeleteTarget(zone)}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) =>
          !open && !deleteZone.isPending && setDeleteTarget(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف منطقهٔ ارسال</AlertDialogTitle>
            <AlertDialogDescription>
              منطقهٔ {deleteTarget?.name} و همهٔ روش‌های وابسته به آن برای همیشه
              حذف می‌شوند. برای توقف موقت، منطقه را غیرفعال کنید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteZone.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteZone.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteZone.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              حذف منطقه
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
