"use client"

import * as React from "react"
import { Search, X, BookOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { BlogCard } from "@/components/journal/blog-card"
import { faNum } from "@/lib/products"
import type { BlogPost } from "@/lib/journal"

const sorts = [
  { value: "new", label: "جدیدترین" },
  { value: "popular", label: "پربازدیدترین" },
] as const

/**
 * JournalExplorer — instant client-side search + sort over the (already
 * server-rendered) post list. No round-trips; all posts stay in the DOM for SEO.
 */
export function JournalExplorer({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<(typeof sorts)[number]["value"]>("new")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = posts.filter((p) =>
      q === ""
        ? true
        : p.title.toLowerCase().includes(q) ||
          (p.excerpt ?? "").toLowerCase().includes(q)
    )
    if (sort === "popular") {
      out.sort((a, b) => b.total_reads - a.total_reads)
    }
    return out
  }, [posts, query, sort])

  return (
    <div>
      <div className="border-hairline flex flex-col gap-4 rounded-3xl bg-card/60 p-4 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در ژورنال…"
            className="h-11 ps-9"
            aria-label="جستجو در ژورنال"
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

        <div className="flex items-center gap-2">
          {sorts.map((s) => {
            const active = sort === s.value
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSort(s.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {filtered.length > 0 ? `${faNum(filtered.length)} نوشته` : null}
      </p>

      {filtered.length === 0 ? (
        <div className="border-hairline mt-2 flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-20 text-center ring-1 ring-foreground/5">
          <BookOpen className="size-10 text-muted-foreground/50" />
          <p className="font-serif text-2xl">نوشته‌ای پیدا نشد</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            عبارت دیگری برای جستجو امتحان کنید.
          </p>
        </div>
      ) : (
        <div className="mt-2 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post, i) => (
            <BlogCard key={post.id} post={post} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
