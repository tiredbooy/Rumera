"use client";

import * as React from "react";
import { Search, X, BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { JournalCard } from "@/features/journal/components/journal-card";
import { faNum } from "@/lib/products";
import type { JournalListItem } from "@/features/journal/types";

const sorts = [
  { value: "new", label: "جدیدترین" },
  { value: "popular", label: "پربازدیدترین" },
] as const;

/**
 * JournalExplorer — instant client-side search + sort over the (already
 * server-rendered) post list. No round-trips; all posts stay in the DOM for SEO.
 */
export function JournalExplorer({ posts }: { posts: JournalListItem[] }) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] =
    React.useState<(typeof sorts)[number]["value"]>("new");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = posts.filter((p) =>
      q === ""
        ? true
        : p.title.toLowerCase().includes(q) ||
          (p.excerpt ?? "").toLowerCase().includes(q),
    );
    if (sort === "popular") {
      out.sort((a, b) => b.total_reads - a.total_reads);
    }
    return out;
  }, [posts, query, sort]);

  return (
    <div>
      <div className="border-hairline flex flex-col gap-4 rounded-3xl bg-card/80 p-4 shadow-sm shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-sm sm:flex-row sm:items-center sm:p-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
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
              className="absolute top-1/2 end-3 -translate-y-1/2 cursor-pointer rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {sorts.map((s) => {
            const active = sort === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSort(s.value)}
                aria-pressed={active}
                className={cn(
                  "cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <p
        className="mt-6 text-sm text-muted-foreground"
        aria-live="polite"
        role="status"
      >
        {filtered.length > 0
          ? `${faNum(filtered.length)} نوشته`
          : "نوشته‌ای مطابق جستجو نیست"}
      </p>

      {filtered.length === 0 ? (
        <div className="border-hairline mt-2 flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-20 text-center ring-1 ring-foreground/5">
          <BookOpen className="size-10 text-muted-foreground/50" aria-hidden />
          <p className="font-serif text-2xl">نوشته‌ای پیدا نشد</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            عبارت دیگری برای جستجو امتحان کنید.
          </p>
        </div>
      ) : (
        <ul
          className="mt-2 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3"
          data-journal-grid
        >
          {filtered.map((post, i) => (
            <li key={post.id} className="contents">
              <JournalCard post={post} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
