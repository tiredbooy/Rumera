"use client";

import * as React from "react";
import Link from "next/link";
import {
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OptionApiError,
  useDeleteOptionType,
  useOptionCatalog,
} from "@/features/admin/options/api";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { faNum } from "@/lib/products";

function LoadingCards() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری ویژگی‌ها"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-24" />
          <Skeleton className="mt-5 h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

function OptionTypeCard({
  group,
  canWrite,
  deleting,
  mutationPending,
  onDelete,
}: {
  group: ProductOptionGroup;
  canWrite: boolean;
  deleting: boolean;
  mutationPending: boolean;
  onDelete: () => void;
}) {
  const valuePreview = group.values
    .slice(0, 6)
    .map((v) => v.value)
    .join(" · ");

  return (
    <article className="border-hairline flex min-w-0 flex-col rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors hover:border-primary/25">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Layers className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/options/${group.id}`}
            className="block max-w-full break-words rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {group.display_name}
          </Link>
          <p
            className="mt-1 truncate font-mono text-xs text-muted-foreground"
            dir="ltr"
            title={group.title}
          >
            {group.title}
          </p>
        </div>
      </div>

      <p className="mt-4 min-h-10 break-words text-sm leading-6 text-muted-foreground">
        {group.values.length === 0
          ? "هنوز مقداری ثبت نشده — برای استفاده در محصولات، مقادیر را اضافه کنید."
          : valuePreview}
        {group.values.length > 6 ? " …" : null}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground">
          {faNum(group.values.length)} مقدار
        </p>
        {canWrite ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link
                href={`/admin/options/${group.id}`}
                aria-label={`ویرایش ${group.display_name}`}
              >
                <Pencil className="size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              disabled={mutationPending}
              aria-label={`حذف ${group.display_name}`}
              onClick={onDelete}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function OptionsBoard({ canWrite }: { canWrite: boolean }) {
  const catalog = useOptionCatalog();
  const deleteType = useDeleteOptionType();
  const [pendingDelete, setPendingDelete] =
    React.useState<ProductOptionGroup | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteType.mutateAsync(pendingDelete.id);
      toast.success(`ویژگی «${pendingDelete.display_name}» حذف شد`);
      setPendingDelete(null);
    } catch (error) {
      const message =
        error instanceof OptionApiError
          ? error.message
          : "حذف ویژگی انجام نشد.";
      toast.error(message);
    }
  }

  return (
    <AdminPage
      title="ویژگی‌های تنوع"
      description="یک‌بار تعریف کنید (مثل حجم یا رنگ) و در همهٔ محصولات دوباره استفاده کنید — نیازی به ساخت مجدد نیست."
      action={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={catalog.isFetching}
            onClick={() => catalog.refetch()}
          >
            {catalog.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCw className="size-4" />
            )}
            تازه‌سازی
          </Button>
          {canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/options/new">
                <Plus className="size-4" />
                ویژگی جدید
              </Link>
            </Button>
          ) : null}
        </>
      }
    >
      {catalog.isLoading ? <LoadingCards /> : null}

      {catalog.isError ? (
        <div
          role="alert"
          className="border-hairline rounded-2xl bg-destructive/5 px-5 py-8 text-center text-sm text-destructive"
        >
          بارگذاری ویژگی‌ها ناموفق بود.
          <div className="mt-4">
            <Button variant="outline" onClick={() => catalog.refetch()}>
              تلاش دوباره
            </Button>
          </div>
        </div>
      ) : null}

      {!catalog.isLoading && !catalog.isError && catalog.data?.length === 0 ? (
        <div className="border-hairline flex flex-col items-center rounded-2xl bg-card/50 px-6 py-14 text-center ring-1 ring-foreground/[0.04]">
          <Layers className="mb-4 size-8 text-muted-foreground" />
          <p className="font-serif text-lg">هنوز ویژگی‌ای ندارید</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            مثلاً «حجم» با مقادیر ۷۵۰ml و ۱L بسازید. بعد در فرم محصول همان‌ها را
            برای هر SKU انتخاب می‌کنید.
          </p>
          {canWrite ? (
            <Button asChild className="mt-6 h-11">
              <Link href="/admin/options/new">ساخت اولین ویژگی</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {catalog.data && catalog.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.data.map((group) => (
            <OptionTypeCard
              key={group.id}
              group={group}
              canWrite={canWrite}
              deleting={
                deleteType.isPending &&
                deleteType.variables === group.id
              }
              mutationPending={deleteType.isPending}
              onDelete={() => setPendingDelete(group)}
            />
          ))}
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف ویژگی؟</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingDelete?.display_name}» و مقادیرش حذف می‌شوند. محصولاتی که
              از این مقادیر استفاده کرده‌اند ممکن است تنوع ناقص نشان دهند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
