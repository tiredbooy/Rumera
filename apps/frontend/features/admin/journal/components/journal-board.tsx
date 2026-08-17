"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Eye,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { SmartImage } from "@/components/smart-image";
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
  AdminFilterBar,
  AdminPage,
} from "@/features/dashboard/components/admin-page";
import {
  JournalApiError,
  useAdminJournalPosts,
  useDeleteJournalPost,
  useUpdateJournalPost,
} from "@/features/journal/api/client";
import {
  PUBLICATION_KIND_FA,
  publicationKind,
} from "@/features/admin/shared/publication";
import { JOURNAL_STATUS_FA } from "@/features/journal/labels";
import type {
  AdminJournalListQuery,
  JournalListItem,
  JournalStatus,
} from "@/features/journal/types";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

const PAGE_SIZE = 18;

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

function statusValue(value: string | null): JournalStatus | undefined {
  return value === "draft" || value === "published" || value === "archived"
    ? value
    : undefined;
}

function statusVariant(status: JournalStatus) {
  if (status === "published") return "default" as const;
  if (status === "archived") return "outline" as const;
  return "secondary" as const;
}

function LoadingCards() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری نوشته‌های ژورنال"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function JournalCard({
  post,
  canWrite,
  busy,
  publishing,
  deleting,
  onPublish,
  onDelete,
}: {
  post: JournalListItem;
  canWrite: boolean;
  busy: boolean;
  publishing: boolean;
  deleting: boolean;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const href = `/admin/journal/${post.id}`;
  return (
    <article className="border-hairline group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-e1 motion-reduce:transform-none">
      <Link
        href={href}
        className="relative block aspect-[16/9] overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <SmartImage
          src={post.image_url}
          alt={post.image_alt || `تصویر شاخص ${post.title}`}
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 100vw"
        />
        <span className="absolute end-3 top-3">
          <Badge
            variant={
              publicationKind(post.status, post.published_at) === "scheduled"
                ? "outline"
                : statusVariant(post.status)
            }
          >
            {
              PUBLICATION_KIND_FA[
                publicationKind(post.status, post.published_at)
              ]
            }
          </Badge>
        </span>
        {post.is_featured ? (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold/90 px-2.5 py-1 text-xs font-medium text-gold-foreground">
            <Star className="size-3" aria-hidden /> ویژه
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link
          href={href}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="line-clamp-2 font-serif text-lg leading-7 transition-colors group-hover:text-primary">
            {post.title}
          </h2>
        </Link>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-6 text-muted-foreground">
          {post.excerpt || "برای این نوشته خلاصه‌ای ثبت نشده است."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-3.5" aria-hidden /> {faNum(post.total_reads)}{" "}
            بازدید
          </span>
          <span>{faNum(post.time_to_read)} دقیقه مطالعه</span>
          <span>{faDate(post.updated_at)}</span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
          {canWrite && post.status !== "published" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onPublish}
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {post.status === "archived" ? "بازنشر" : "انتشار"}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={href}
              aria-label={`${canWrite ? "ویرایش" : "مشاهده"} ${post.title}`}
            >
              <Pencil className="size-4" aria-hidden />{" "}
              {canWrite ? "ویرایش" : "مشاهده"}
            </Link>
          </Button>
          {canWrite ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy}
              onClick={onDelete}
              aria-label={`حذف ${post.title}`}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function JournalBoard({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = positivePage(searchParams.get("page"));
  const status = statusValue(searchParams.get("status"));
  const [searchState, setSearchState] = React.useState({
    source: query,
    value: query,
  });
  const search = searchState.source === query ? searchState.value : query;
  const deferredSearch = React.useDeferredValue(search.trim());
  const [deleteTarget, setDeleteTarget] =
    React.useState<JournalListItem | null>(null);

  function updateURL(
    updates: Record<string, string | undefined>,
    replace = false,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const suffix = params.toString();
    const href = suffix ? `${pathname}?${suffix}` : pathname;
    React.startTransition(() => {
      if (replace) router.replace(href);
      else router.push(href);
    });
  }

  React.useEffect(() => {
    if (deferredSearch === query) return;
    updateURL({ q: deferredSearch || undefined, page: undefined }, true);
    // updateURL intentionally reflects the latest searchParams snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, query]);

  const listQuery: AdminJournalListQuery = {
    page,
    limit: PAGE_SIZE,
    search: query || undefined,
    status,
    sortBy: "updated_at",
    orderBy: "desc",
  };
  const posts = useAdminJournalPosts(listQuery);
  const publishPost = useUpdateJournalPost();
  const removePost = useDeleteJournalPost();
  const mutationPending = publishPost.isPending || removePost.isPending;
  const outOfRange = Boolean(
    posts.data &&
    posts.data.results.length === 0 &&
    posts.data.pagination.total_items > 0 &&
    page > posts.data.pagination.total_pages,
  );

  React.useEffect(() => {
    if (!outOfRange || !posts.data) return;
    const finalPage = posts.data.pagination.total_pages;
    updateURL({ page: finalPage > 1 ? String(finalPage) : undefined }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfRange, posts.data]);

  async function publish(post: JournalListItem) {
    try {
      await publishPost.mutateAsync({
        id: post.id,
        input: { status: "published" },
      });
      toast.success(`«${post.title}» منتشر شد`);
    } catch (error) {
      toast.error(
        error instanceof JournalApiError
          ? error.message
          : "انتشار نوشته ناموفق بود",
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await removePost.mutateAsync(deleteTarget.id);
      toast.success("نوشته حذف شد");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof JournalApiError
          ? error.message
          : "حذف نوشته ناموفق بود",
      );
    }
  }

  const listError =
    posts.error instanceof JournalApiError
      ? posts.error.message
      : "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
  const mutationError = publishPost.error ?? removePost.error;

  return (
    <AdminPage
      title="ژورنال"
      description="نوشته‌های آموزشی و روایی رومرا را از پیش‌نویس تا انتشار مدیریت کنید."
      action={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/journal/categories">
              <FolderTree className="size-4" /> دسته‌های ژورنال
            </Link>
          </Button>
          {canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/journal/new">
                <Plus className="size-4" /> نوشتهٔ جدید
              </Link>
            </Button>
          ) : null}
        </>
      }
      filters={
        <AdminFilterBar
          id="journal-filter-title"
          title="جستجو و فیلتر نوشته‌ها"
          hasFilters={Boolean(query) || Boolean(status)}
          onReset={() => router.push(pathname)}
          gridClassName="sm:grid-cols-[minmax(0,1fr)_220px]"
        >
          <label className="relative block">
            <span className="sr-only">جستجوی نوشته</span>
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) =>
                setSearchState({ source: query, value: event.target.value })
              }
              placeholder="جستجو در عنوان و خلاصه…"
              className="h-11 ps-9"
              disabled={mutationPending}
            />
          </label>
          <Select
            value={status ?? "all"}
            onValueChange={(value) =>
              updateURL({
                status: value === "all" ? undefined : value,
                page: undefined,
              })
            }
            disabled={mutationPending}
          >
            <SelectTrigger
              aria-label="فیلتر وضعیت انتشار"
              className="min-h-11 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همهٔ وضعیت‌ها</SelectItem>
              <SelectItem value="draft">پیش‌نویس</SelectItem>
              <SelectItem value="published">منتشرشده</SelectItem>
              <SelectItem value="archived">بایگانی‌شده</SelectItem>
            </SelectContent>
          </Select>
        </AdminFilterBar>
      }
      pagination={
        posts.data && posts.data.pagination.total_items > 0 ? (
          <ListPagination
            page={posts.data.pagination.page}
            totalPages={posts.data.pagination.total_pages}
            hasPrev={posts.data.pagination.has_prev}
            hasNext={posts.data.pagination.has_next}
            onPrev={() =>
              updateURL({ page: page > 2 ? String(page - 1) : undefined })
            }
            onNext={() => updateURL({ page: String(page + 1) })}
            disabled={posts.isFetching || mutationPending}
            ariaLabel="صفحه‌بندی نوشته‌ها"
            label={
              <>
                {faNum(posts.data.pagination.total_items)} نوشته · صفحهٔ{" "}
                {faNum(posts.data.pagination.page)} از{" "}
                {faNum(posts.data.pagination.total_pages)}
              </>
            }
          />
        ) : null
      }
    >
      {mutationError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {mutationError instanceof Error
            ? mutationError.message
            : "عملیات نوشته ناموفق بود"}
        </p>
      ) : null}

      {posts.isLoading ? <LoadingCards /> : null}

      {posts.isError && !posts.data ? (
        <div
          role="alert"
          className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]"
        >
          <p className="font-serif text-lg">بارگذاری نوشته‌ها ناموفق بود</p>
          <p className="max-w-sm text-sm text-muted-foreground">{listError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => posts.refetch()}
            disabled={posts.isFetching}
          >
            <RotateCw
              className={posts.isFetching ? "size-4 animate-spin" : "size-4"}
            />{" "}
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {posts.isError && posts.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <div>
            <p>
              به‌روزرسانی نوشته‌ها ناموفق بود؛ اطلاعات نمایش‌داده‌شده ممکن است
              قدیمی باشد.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{listError}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => posts.refetch()}
            disabled={posts.isFetching}
          >
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {posts.data && posts.data.results.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <BookOpen className="size-10 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-serif text-lg">
              {outOfRange
                ? "در حال بازگشت به آخرین صفحه…"
                : query || status
                  ? "نوشته‌ای با این فیلتر پیدا نشد"
                  : "هنوز نوشته‌ای ثبت نشده است"}
            </p>
            {!query && !status ? (
              <p className="mt-1 text-sm text-muted-foreground">
                نخستین راهنما یا روایت رومرا را به‌صورت پیش‌نویس آغاز کنید.
              </p>
            ) : null}
          </div>
          {canWrite && !query && !status ? (
            <Button asChild>
              <Link href="/admin/journal/new">
                <Plus className="size-4" /> ساخت اولین نوشته
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {posts.data && posts.data.results.length > 0 ? (
        <div
          aria-busy={posts.isFetching || mutationPending || undefined}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {posts.data.results.map((post) => (
            <JournalCard
              key={post.id}
              post={post}
              canWrite={canWrite}
              busy={mutationPending}
              publishing={
                publishPost.isPending && publishPost.variables?.id === post.id
              }
              deleting={
                removePost.isPending && removePost.variables === post.id
              }
              onPublish={() => void publish(post)}
              onDelete={() => setDeleteTarget(post)}
            />
          ))}
        </div>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removePost.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نوشته</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title}» از ژورنال حذف می‌شود و تصویر محلی آن نیز
              پاک خواهد شد. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removePost.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removePost.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {removePost.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" />
              )}
              حذف نوشته
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
