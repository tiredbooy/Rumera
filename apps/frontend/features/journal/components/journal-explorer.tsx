"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  JOURNAL_SEARCH_MAX_LENGTH,
  JOURNAL_SORT_OPTIONS,
  type JournalRouteQuery,
} from "@/features/journal/routing";
import { cn } from "@/lib/utils";

const RESULTS_ID = "journal-results-title";

export function JournalExplorer({
  query,
}: {
  query: Pick<JournalRouteQuery, "q" | "sort">;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState(query.q ?? "");
  const committedParams = searchParams.toString();
  const optimisticParams = React.useRef(committedParams);
  const searchTimer = React.useRef<number | null>(null);
  const appliedSearch = React.useRef(query.q ?? "");

  React.useEffect(() => {
    optimisticParams.current = committedParams;
  }, [committedParams]);

  const clearSearchTimer = React.useCallback(() => {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }, []);

  const apply = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(optimisticParams.current);
      for (const [key, nextValue] of Object.entries(patch)) {
        if (!nextValue) params.delete(key);
        else params.set(key, nextValue);
      }
      params.delete("page");
      const next = params.toString();
      optimisticParams.current = next;
      startTransition(() => {
        router.replace(
          `${next ? `${pathname}?${next}` : pathname}#${RESULTS_ID}`,
          { scroll: false },
        );
      });
    },
    [pathname, router],
  );

  React.useEffect(() => {
    const normalized = value.trim();
    if (normalized === (query.q ?? "") || normalized === appliedSearch.current) {
      return;
    }
    clearSearchTimer();
    searchTimer.current = window.setTimeout(
      () => {
        appliedSearch.current = normalized;
        apply({ q: normalized || null });
      },
      350,
    );
    return clearSearchTimer;
  }, [apply, clearSearchTimer, query.q, value]);

  const applyNow = (patch: Record<string, string | null>) => {
    clearSearchTimer();
    const normalized = value.trim();
    appliedSearch.current = normalized;
    apply({ ...patch, q: normalized || null });
  };

  return (
    <div
      className={cn(
        "border-hairline flex flex-col gap-4 rounded-3xl bg-card/80 p-4 shadow-sm shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-sm transition-opacity sm:flex-row sm:items-center sm:p-3",
        isPending && "opacity-60",
      )}
      aria-busy={isPending}
    >
      <form
        className="relative flex-1"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          applyNow({});
        }}
      >
        <Search
          className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={JOURNAL_SEARCH_MAX_LENGTH}
          placeholder="جستجو در ژورنال…"
          className="h-11 ps-9 pe-12"
          aria-label="جستجو در همهٔ نوشته‌های ژورنال"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              clearSearchTimer();
              appliedSearch.current = "";
              setValue("");
              apply({ q: null });
            }}
            aria-label="پاک کردن جستجو"
            className="absolute top-1/2 end-0 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="مرتب‌سازی ژورنال"
      >
        {JOURNAL_SORT_OPTIONS.map((option) => {
          const active = query.sort === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                applyNow({
                  sort: option.value === "new" ? null : option.value,
                })
              }
              aria-pressed={active}
              className={cn(
                "min-h-11 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? "در حال به‌روزرسانی نوشته‌ها" : "نوشته‌ها به‌روز شدند"}
      </span>
    </div>
  );
}
