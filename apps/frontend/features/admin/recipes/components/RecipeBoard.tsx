"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Plus,
  Pencil,
  BookOpen,
  Clock,
  Users,
  AlertCircle,
  Star,
  Search,
  RotateCw,
} from "lucide-react"

import { ListPagination } from "@/components/list-pagination"
import { OptimizedImage } from "@/components/optimized-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PUBLICATION_KIND_FA,
  publicationKind,
  type PublicationKind,
} from "@/features/admin/shared/publication"
import {
  AdminFilterBar,
  AdminPage,
} from "@/features/dashboard/components/admin-page"
import { listAdminRecipes } from "@/features/recipes/api/client"
import type { AdminRecipeListQuery, RecipeStatus } from "@/features/recipes/types"
import { difficultyFa, formatDuration } from "@/features/recipes/utils"
import { faNum } from "@/lib/products"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 18

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 1
}

function statusValue(value: string | null): RecipeStatus | undefined {
  return value === "draft" || value === "published" || value === "archived"
    ? value
    : undefined
}

/**
 * Live recipes board — the editorial grid for the recipes admin. Fetches the
 * admin listing (drafts included) via TanStack Query and renders skeleton,
 * empty, and error states. Each card links to its editor; the trailing tile
 * starts a new recipe.
 */

const STATUS: Record<PublicationKind, { label: string; cls: string; dot: string }> = {
  published: {
    label: PUBLICATION_KIND_FA.published,
    cls: "bg-success/12 text-success ring-success/25",
    dot: "bg-success",
  },
  scheduled: {
    label: PUBLICATION_KIND_FA.scheduled,
    cls: "bg-info/12 text-info ring-info/25",
    dot: "bg-info",
  },
  draft: {
    label: PUBLICATION_KIND_FA.draft,
    cls: "bg-muted text-muted-foreground ring-border/60",
    dot: "bg-muted-foreground/50",
  },
  archived: {
    label: PUBLICATION_KIND_FA.archived,
    cls: "bg-warning/12 text-warning ring-warning/25",
    dot: "bg-warning",
  },
}

function StatusPill({
  status,
  publishedAt,
}: {
  status: RecipeStatus
  publishedAt?: string | null
}) {
  const s = STATUS[publicationKind(status, publishedAt)] ?? STATUS.draft
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset backdrop-blur-sm",
        s.cls
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  )
}

function CardSkeleton() {
  return (
    <li className="border-hairline overflow-hidden rounded-2xl bg-card">
      <div className="h-32 animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </li>
  )
}

export function RecipesBoard({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get("q")?.trim() ?? ""
  const page = positivePage(searchParams.get("page"))
  const status = statusValue(searchParams.get("status"))
  const [searchState, setSearchState] = React.useState({
    source: query,
    value: query,
  })
  const search = searchState.source === query ? searchState.value : query
  const deferredSearch = React.useDeferredValue(search.trim())

  function updateURL(
    updates: Record<string, string | undefined>,
    replace = false,
  ) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const suffix = params.toString()
    const href = suffix ? `${pathname}?${suffix}` : pathname
    React.startTransition(() => {
      if (replace) router.replace(href)
      else router.push(href)
    })
  }

  React.useEffect(() => {
    if (deferredSearch === query) return
    updateURL({ q: deferredSearch || undefined, page: undefined }, true)
    // updateURL intentionally reflects the latest searchParams snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, query])

  const listQuery: AdminRecipeListQuery = {
    page,
    limit: PAGE_SIZE,
    search: query || undefined,
    status,
    sortBy: "created_at",
    orderBy: "desc",
  }
  const recipesQuery = useQuery({
    queryKey: ["admin", "recipes", "list", listQuery],
    queryFn: () => listAdminRecipes(listQuery),
  })
  const outOfRange = Boolean(
    recipesQuery.data &&
      recipesQuery.data.results.length === 0 &&
      recipesQuery.data.pagination.total_items > 0 &&
      page > recipesQuery.data.pagination.total_pages,
  )

  React.useEffect(() => {
    if (!outOfRange || !recipesQuery.data) return
    const finalPage = recipesQuery.data.pagination.total_pages
    updateURL({ page: finalPage > 1 ? String(finalPage) : undefined }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfRange, recipesQuery.data])

  const recipes = recipesQuery.data?.results ?? []
  const filteredEmpty = Boolean(query || status)

  return (
    <AdminPage
      title="دستورها"
      description="دستورهای کوکتل و محتوای آموزشی فروشگاه"
      action={
        canWrite ? (
          <Button size="sm" asChild>
            <Link href="/admin/recipes/new">
              <Plus className="size-4" /> دستور جدید
            </Link>
          </Button>
        ) : null
      }
      filters={
        <AdminFilterBar
          id="recipes-filter-title"
          title="جستجو و فیلتر دستورها"
          hasFilters={filteredEmpty}
          onReset={() => router.push(pathname)}
          gridClassName="sm:grid-cols-[minmax(0,1fr)_220px]"
        >
          <label className="relative block">
            <span className="sr-only">جستجوی دستور</span>
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
          >
            <SelectTrigger aria-label="فیلتر وضعیت انتشار" className="min-h-11 w-full">
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
        recipesQuery.data && recipesQuery.data.pagination.total_items > 0 ? (
          <ListPagination
            page={recipesQuery.data.pagination.page}
            totalPages={recipesQuery.data.pagination.total_pages}
            hasPrev={recipesQuery.data.pagination.has_prev}
            hasNext={recipesQuery.data.pagination.has_next}
            onPrev={() =>
              updateURL({ page: page > 2 ? String(page - 1) : undefined })
            }
            onNext={() => updateURL({ page: String(page + 1) })}
            disabled={recipesQuery.isFetching}
            ariaLabel="صفحه‌بندی دستورها"
            label={
              <>
                {faNum(recipesQuery.data.pagination.total_items)} دستور · صفحهٔ{" "}
                {faNum(recipesQuery.data.pagination.page)} از{" "}
                {faNum(recipesQuery.data.pagination.total_pages)}
              </>
            }
          />
        ) : null
      }
    >
      {recipesQuery.isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </ul>
      ) : null}

      {recipesQuery.isError && !recipesQuery.data ? (
        <div
          role="alert"
          className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <AlertCircle className="size-6" />
          </span>
          <div>
            <p className="font-medium">بارگذاری دستورها ناموفق بود</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ارتباط با سرور برقرار نشد. دوباره تلاش کنید.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recipesQuery.refetch()}
            disabled={recipesQuery.isFetching}
          >
            <RotateCw
              className={recipesQuery.isFetching ? "size-4 animate-spin" : "size-4"}
            />{" "}
            تلاش دوباره
          </Button>
        </div>
      ) : null}

      {recipesQuery.isError && recipesQuery.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>به‌روزرسانی دستورها ناموفق بود؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recipesQuery.refetch()}
            disabled={recipesQuery.isFetching}
          >
            تلاش دوباره
          </Button>
        </div>
      ) : null}

      {recipesQuery.data && recipes.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-4 rounded-2xl border-dashed bg-card/40 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border/60">
            <BookOpen className="size-7" />
          </span>
          <div>
            <p className="font-serif text-lg">
              {outOfRange
                ? "در حال بازگشت به آخرین صفحه…"
                : filteredEmpty
                  ? "دستوری با این فیلتر پیدا نشد"
                  : "هنوز دستوری ثبت نشده است"}
            </p>
            {!filteredEmpty ? (
              <p className="mt-1 text-sm text-muted-foreground">
                نخستین کوکتل یا محتوای آموزشی خود را بنویسید.
              </p>
            ) : null}
          </div>
          {canWrite && !filteredEmpty ? (
            <Button asChild>
              <Link href="/admin/recipes/new">
                <Plus className="size-4" /> ساخت اولین دستور
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {recipes.length > 0 ? (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy={recipesQuery.isFetching || undefined}
        >
          {recipes.map((recipe) => {
        const href = `/admin/recipes/${recipe.id}`
        return (
          <li
            key={recipe.id}
            className="border-hairline hover-lift group overflow-hidden rounded-2xl bg-card"
          >
            <Link href={href} className="block focus-visible:outline-none">
              <div className="relative h-32 overflow-hidden">
                <OptimizedImage
                  src={recipe.image_url}
                  alt={recipe.title}
                  width={480}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute end-3 top-3">
                  <StatusPill
                    status={recipe.status}
                    publishedAt={recipe.published_at}
                  />
                </div>
                {recipe.is_featured ? (
                  <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold/90 px-2 py-0.5 text-xs font-medium text-gold-foreground">
                    <Star className="size-3" aria-hidden /> ویژه
                  </span>
                ) : null}
              </div>
            </Link>
            <div className="p-5">
              <Link href={href} className="focus-visible:outline-none">
                <p className="line-clamp-2 font-serif text-base leading-snug transition-colors group-hover:text-primary">
                  {recipe.title}
                </p>
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{difficultyFa[recipe.difficulty]}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {formatDuration(recipe.total_time_minutes)}
                </span>
                {recipe.servings ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" aria-hidden />
                    {faNum(recipe.servings)}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                <span className="text-xs text-muted-foreground">
                  {faNum(recipe.view_count)} بازدید
                </span>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="-me-2 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Link href={href} aria-label={`ویرایش «${recipe.title}»`}>
                      <Pencil className="size-4" /> ویرایش
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}

      {canWrite ? (
        <li>
          <Link
            href="/admin/recipes/new"
            className="border-hairline flex h-full min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border/60">
              <Plus className="size-5" />
            </span>
            <span className="text-sm">دستور جدید</span>
          </Link>
        </li>
      ) : null}
        </ul>
      ) : null}

    </AdminPage>
  )
}
