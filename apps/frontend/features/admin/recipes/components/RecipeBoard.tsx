"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Plus, Pencil, BookOpen, Clock, Users, AlertCircle, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import { formatDuration, difficultyFa } from "@/lib/recipes"
import { listAdminRecipes, type RecipeStatus } from "@/lib/api/admin-client"
import { Button } from "@/components/ui/button"
import { OptimizedImage } from "@/components/admin/optimized-image"

/**
 * Live recipes board — the editorial grid for the recipes admin. Fetches the
 * admin listing (drafts included) via TanStack Query and renders skeleton,
 * empty, and error states. Each card links to its editor; the trailing tile
 * starts a new recipe.
 */

const STATUS: Record<RecipeStatus, { label: string; cls: string; dot: string }> = {
  published: {
    label: "منتشرشده",
    cls: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  draft: {
    label: "پیش‌نویس",
    cls: "bg-muted text-muted-foreground ring-border/60",
    dot: "bg-muted-foreground/50",
  },
  archived: {
    label: "بایگانی‌شده",
    cls: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
}

function StatusPill({ status }: { status: RecipeStatus }) {
  const s = STATUS[status] ?? STATUS.draft
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
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "recipes", "list"],
    queryFn: () => listAdminRecipes({ limit: 60, sortBy: "created_at", orderBy: "desc" }),
  })

  if (isLoading) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    )
  }

  if (isError) {
    return (
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
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          تلاش دوباره
        </Button>
      </div>
    )
  }

  const recipes = data?.results ?? []

  if (recipes.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center gap-4 rounded-2xl border-dashed bg-card/40 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border/60">
          <BookOpen className="size-7" />
        </span>
        <div>
          <p className="font-serif text-lg">هنوز دستوری ثبت نشده است</p>
          <p className="mt-1 text-sm text-muted-foreground">
            نخستین کوکتل یا محتوای آموزشی خود را بنویسید.
          </p>
        </div>
        {canWrite ? (
          <Button asChild>
            <Link href="/admin/recipes/new">
              <Plus className="size-4" /> دستور جدید
            </Link>
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => {
        const href = `/admin/recipes/${recipe.id}`
        const status: RecipeStatus = recipe.published_at ? "published" : "draft"
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
                  <StatusPill status={status} />
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
  )
}
