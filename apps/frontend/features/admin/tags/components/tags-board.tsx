"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Hash,
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
  TagApiError,
  useAdminTags,
  useDeleteTag,
} from "@/features/admin/tags/api";
import type { Tag, TagListQuery } from "@/features/catalog/tags/types";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

const PAGE_SIZE = 20;

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function LoadingCards() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری برچسب‌ها"
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
          <Skeleton className="mt-5 h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

function TagCard({
  tag,
  deleting,
  mutationPending,
  onDelete,
}: {
  tag: Tag;
  deleting: boolean;
  mutationPending: boolean;
  onDelete: () => void;
}) {
  return (
    <article className="border-hairline flex min-w-0 flex-col rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors hover:border-primary/25">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Hash className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/tags/${tag.id}`}
            className="block max-w-full break-words rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tag.title}
          </Link>
          <p
            className="mt-1 truncate text-xs text-muted-foreground"
            dir="auto"
            title={tag.slug}
          >
            {tag.slug}
          </p>
        </div>
      </div>

      <p className="mt-4 min-h-10 break-words text-sm leading-6 text-muted-foreground">
        {tag.description || "برای این برچسب توضیحی ثبت نشده است."}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground">
          ویرایش {faDate(tag.updated_at)}
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`/admin/tags/${tag.id}`}
              aria-label={`ویرایش ${tag.title}`}
            >
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={mutationPending}
            aria-label={`حذف ${tag.title}`}
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function TagsBoard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = positivePage(searchParams.get("page"));
  const [search, setSearch] = React.useState(query);
  const [lastQuery, setLastQuery] = React.useState(query);
  const [deleteTarget, setDeleteTarget] = React.useState<Tag | null>(null);

  if (query !== lastQuery) {
    setLastQuery(query);
    setSearch(query);
  }

  const updateURL = React.useCallback(
    (updates: Record<string, string | undefined>, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
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
      () => updateURL({ q: search.trim() || undefined, page: undefined }),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [query, search, updateURL]);

  const listQuery: TagListQuery = {
    page,
    limit: PAGE_SIZE,
    search: query || undefined,
    sortBy: "updated_at",
    orderBy: "desc",
  };
  const tags = useAdminTags(listQuery);
  const removeTag = useDeleteTag();
  const outOfRange = Boolean(
    tags.data &&
    tags.data.results.length === 0 &&
    tags.data.pagination.total_items > 0 &&
    page > tags.data.pagination.total_pages,
  );

  React.useEffect(() => {
    if (!outOfRange || !tags.data) return;
    const lastPage = tags.data.pagination.total_pages;
    updateURL({ page: lastPage > 1 ? String(lastPage) : undefined }, true);
  }, [outOfRange, tags.data, updateURL]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await removeTag.mutateAsync(deleteTarget.id);
      toast.success("برچسب حذف شد");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof TagApiError ? error.message : "حذف برچسب ناموفق بود",
      );
    }
  }

  const mutationError = removeTag.error
    ? removeTag.error instanceof TagApiError
      ? removeTag.error.message
      : "حذف برچسب ناموفق بود"
    : null;
  const listError =
    tags.error instanceof TagApiError
      ? tags.error.message
      : "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";

  return (
    <>
      <PageHeader
        title="برچسب‌ها"
        description="برچسب‌های کاتالوگ و ارتباط آن‌ها با محصولات را مدیریت کنید."
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/tags/new">
              <Plus className="size-4" /> برچسب جدید
            </Link>
          </Button>
        }
      />

      <label className="relative mb-4 block max-w-xl">
        <span className="sr-only">جستجوی برچسب</span>
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="جستجو در نام، نامک یا توضیحات…"
          className="ps-9"
          disabled={removeTag.isPending}
        />
      </label>

      {mutationError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {mutationError}
        </p>
      ) : null}

      {tags.isLoading ? <LoadingCards /> : null}

      {tags.isError && !tags.data ? (
        <div
          role="alert"
          className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]"
        >
          <p className="font-medium">بارگذاری برچسب‌ها ناموفق بود</p>
          <p className="max-w-sm text-sm text-muted-foreground">{listError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => tags.refetch()}
            disabled={tags.isFetching}
          >
            <RotateCw
              className={tags.isFetching ? "size-4 animate-spin" : "size-4"}
            />
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {tags.isError && tags.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <div>
            <p>
              به‌روزرسانی برچسب‌ها ناموفق بود؛ اطلاعات نمایش‌داده‌شده ممکن است
              قدیمی باشد.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{listError}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => tags.refetch()}
            disabled={tags.isFetching}
          >
            <RotateCw
              className={tags.isFetching ? "size-4 animate-spin" : "size-4"}
            />
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {tags.data && tags.data.results.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <Hash className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {outOfRange
              ? "در حال بازگشت به آخرین صفحه…"
              : query
                ? "برچسبی با این جستجو پیدا نشد"
                : "هنوز برچسبی ثبت نشده است"}
          </p>
          {!query && !outOfRange ? (
            <Button size="sm" asChild>
              <Link href="/admin/tags/new">
                <Plus className="size-4" /> ساخت اولین برچسب
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {tags.data && tags.data.results.length > 0 ? (
        <div
          role="list"
          aria-busy={tags.isFetching || removeTag.isPending || undefined}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {tags.data.results.map((tag) => (
            <div key={tag.id} role="listitem">
              <TagCard
                tag={tag}
                deleting={removeTag.isPending && removeTag.variables === tag.id}
                mutationPending={removeTag.isPending}
                onDelete={() => setDeleteTarget(tag)}
              />
            </div>
          ))}
        </div>
      ) : null}

      {tags.data && tags.data.pagination.total_items > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {faNum(tags.data.pagination.total_items)} برچسب · صفحهٔ{" "}
            {faNum(tags.data.pagination.page)} از{" "}
            {faNum(tags.data.pagination.total_pages)}
            {tags.isFetching ? (
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
              disabled={!tags.data.pagination.has_prev || tags.isFetching}
              onClick={() =>
                updateURL({ page: page > 2 ? String(page - 1) : undefined })
              }
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!tags.data.pagination.has_next || tags.isFetching}
              onClick={() => updateURL({ page: String(page + 1) })}
            >
              بعدی
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeTag.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف برچسب</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title}» از محصولات و محتوای مرتبط نیز جدا می‌شود.
              این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTag.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeTag.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {removeTag.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              حذف برچسب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
