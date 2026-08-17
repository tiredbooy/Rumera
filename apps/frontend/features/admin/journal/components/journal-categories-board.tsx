"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminFilterBar,
  AdminPage,
} from "@/features/dashboard/components/admin-page";
import {
  JournalApiError,
  useAdminJournalCategories,
  useDeleteJournalCategory,
} from "@/features/journal/api/client";
import type { JournalCategory } from "@/features/journal/types";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

function LoadingCategories() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری دسته‌های ژورنال"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-3 h-4 w-24" />
          <Skeleton className="mt-5 h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

export function JournalCategoriesBoard({ canWrite }: { canWrite: boolean }) {
  const categories = useAdminJournalCategories();
  const removeCategory = useDeleteJournalCategory();
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(
    search.trim().toLocaleLowerCase("fa"),
  );
  const [deleteTarget, setDeleteTarget] =
    React.useState<JournalCategory | null>(null);
  const all = categories.data ?? [];
  const byID = new Map(all.map((category) => [category.id, category]));
  const childCounts = new Map<number, number>();
  for (const category of all) {
    if (!category.parent_id) continue;
    childCounts.set(
      category.parent_id,
      (childCounts.get(category.parent_id) ?? 0) + 1,
    );
  }
  const visible = deferredSearch
    ? all.filter((category) =>
        [category.name, category.slug ?? "", category.description ?? ""]
          .join(" ")
          .toLocaleLowerCase("fa")
          .includes(deferredSearch),
      )
    : all;

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await removeCategory.mutateAsync(deleteTarget.id);
      toast.success("دستهٔ ژورنال حذف شد");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof JournalApiError
          ? error.message
          : "حذف دسته ناموفق بود",
      );
    }
  }

  const listError =
    categories.error instanceof JournalApiError
      ? categories.error.message
      : "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";

  return (
    <AdminPage
      breadcrumb={[
        { label: "پنل مدیریت", href: "/admin" },
        { label: "ژورنال", href: "/admin/journal" },
      ]}
      title="دسته‌های ژورنال"
      description="ساختار موضوعی نوشته‌ها و رابطهٔ دسته‌های مادر و فرزند را مدیریت کنید."
      action={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/journal">
              <ArrowRight className="size-4" /> بازگشت به ژورنال
            </Link>
          </Button>
          {canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/journal/categories/new">
                <Plus className="size-4" /> دستهٔ جدید
              </Link>
            </Button>
          ) : null}
        </>
      }
      filters={
        <AdminFilterBar
          id="journal-categories-filter-title"
          title="جستجوی دسته‌ها"
          hasFilters={Boolean(search)}
          onReset={() => setSearch("")}
          gridClassName="max-w-xl"
        >
          <label className="relative block">
            <span className="sr-only">جستجوی دستهٔ ژورنال</span>
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو در نام، نامک یا توضیحات…"
              className="h-11 ps-9"
              disabled={removeCategory.isPending}
            />
          </label>
        </AdminFilterBar>
      }
    >
      {removeCategory.error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {removeCategory.error instanceof Error
            ? removeCategory.error.message
            : "حذف دسته ناموفق بود"}
        </p>
      ) : null}

      {categories.isLoading ? <LoadingCategories /> : null}

      {categories.isError && !categories.data ? (
        <div
          role="alert"
          className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]"
        >
          <p className="font-serif text-lg">بارگذاری دسته‌ها ناموفق بود</p>
          <p className="max-w-sm text-sm text-muted-foreground">{listError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => categories.refetch()}
            disabled={categories.isFetching}
          >
            <RotateCw
              className={
                categories.isFetching ? "size-4 animate-spin" : "size-4"
              }
            />
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {categories.isError && categories.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>
            به‌روزرسانی دسته‌ها ناموفق بود؛ اطلاعات فعلی ممکن است قدیمی باشد.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => categories.refetch()}
            disabled={categories.isFetching}
          >
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {categories.data && visible.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <FolderTree className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {deferredSearch
              ? "دسته‌ای با این جستجو پیدا نشد"
              : "هنوز دسته‌ای ثبت نشده است"}
          </p>
          {canWrite && !deferredSearch ? (
            <Button asChild>
              <Link href="/admin/journal/categories/new">
                <Plus className="size-4" /> ساخت اولین دسته
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {visible.length ? (
        <div
          role="list"
          aria-busy={
            categories.isFetching || removeCategory.isPending || undefined
          }
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {visible.map((category) => {
            const childCount = childCounts.get(category.id) ?? 0;
            const parent = category.parent_id
              ? byID.get(category.parent_id)
              : undefined;
            return (
              <article
                key={category.id}
                role="listitem"
                className="border-hairline flex min-w-0 flex-col rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors hover:border-primary/25"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <FolderTree className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/journal/categories/${category.id}`}
                      className="block break-words rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {category.name}
                    </Link>
                    <p
                      className="mt-1 truncate text-xs text-muted-foreground"
                      dir="auto"
                    >
                      {category.slug || "بدون نامک"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 min-h-10 break-words text-sm leading-6 text-muted-foreground">
                  {category.description || "برای این دسته توضیحی ثبت نشده است."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>مادر: {parent?.name ?? "بدون دستهٔ مادر"}</span>
                  <span>·</span>
                  <span>{faNum(childCount)} زیر‌دسته</span>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
                  <p className="text-xs text-muted-foreground">
                    ویرایش {faDate(category.updated_at)}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        href={`/admin/journal/categories/${category.id}`}
                        aria-label={`ویرایش ${category.name}`}
                      >
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={removeCategory.isPending || childCount > 0}
                        onClick={() => setDeleteTarget(category)}
                        aria-label={
                          childCount > 0
                            ? `حذف ${category.name} پس از جابه‌جایی زیر‌دسته‌ها ممکن است`
                            : `حذف ${category.name}`
                        }
                        title={
                          childCount > 0
                            ? "ابتدا زیر‌دسته‌ها را جابه‌جا کنید"
                            : undefined
                        }
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {removeCategory.isPending &&
                        removeCategory.variables === category.id ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeCategory.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دستهٔ ژورنال</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» از نوشته‌های مرتبط جدا می‌شود. خود نوشته‌ها
              حذف نمی‌شوند، اما این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeCategory.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeCategory.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {removeCategory.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" />
              )}
              حذف دسته
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
