"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { difficultyFa, type RecipeDifficulty } from "@/lib/recipes"

const difficulties: { value: RecipeDifficulty | ""; label: string }[] = [
  { value: "", label: "همه" },
  { value: "easy", label: difficultyFa.easy },
  { value: "medium", label: difficultyFa.medium },
  { value: "hard", label: difficultyFa.hard },
]

const sorts: { value: string; label: string }[] = [
  { value: "new", label: "جدیدترین" },
  { value: "popular", label: "محبوب‌ترین" },
  { value: "quick", label: "سریع‌ترین" },
]

/**
 * Recipe filter bar — search + difficulty + sort, synced to the URL so results
 * are shareable and SEO-friendly. Uppdates run inside a transition for a smooth,
 * non-blocking feel; the search input is debounced.
 */
export function RecipeFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const q = searchParams.get("q") ?? ""
  const difficulty = searchParams.get("difficulty") ?? ""
  const sort = searchParams.get("sort") ?? "new"

  // Local input state, kept in sync with the URL value via the render-time
  // adjustment pattern (so external changes — clear button, back/forward —
  // reflect immediately without a setState-in-effect).
  const [query, setQuery] = React.useState(q)
  const [prevQ, setPrevQ] = React.useState(q)
  if (q !== prevQ) {
    setPrevQ(q)
    setQuery(q)
  }

  const apply = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key)
        else params.set(key, value)
      }
      // Any filter change resets pagination.
      params.delete("page")
      const qs = params.toString()
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
    },
    [pathname, router, searchParams]
  )

  // Debounce free-text search.
  React.useEffect(() => {
    if (query === q) return
    const id = window.setTimeout(() => apply({ q: query || null }), 350)
    return () => window.clearTimeout(id)
  }, [query, q, apply])

  const hasFilters = q !== "" || difficulty !== "" || sort !== "new"

  return (
    <div
      className={cn(
        "border-hairline flex flex-col gap-4 rounded-3xl bg-card/60 p-4 ring-1 ring-foreground/5 transition-opacity sm:flex-row sm:items-center sm:p-3",
        isPending && "opacity-60"
      )}
    >
      {/* Search */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی دستور… (مثلاً موخیتو)"
          className="h-11 ps-9"
          aria-label="جستجوی دستورها"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="پاک کردن جستجو"
            className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Difficulty chips */}
      <div className="flex flex-wrap items-center gap-2">
        {difficulties.map((d) => {
          const active = difficulty === d.value
          return (
            <button
              key={d.value || "all"}
              type="button"
              onClick={() => apply({ difficulty: d.value || null })}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              )}
            >
              {d.label}
            </button>
          )
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label="مرتب‌سازی"
          value={sort}
          onChange={(e) => apply({ sort: e.target.value === "new" ? null : e.target.value })}
        >
          {sorts.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            پاک‌سازی
          </button>
        ) : null}
      </div>
    </div>
  )
}
