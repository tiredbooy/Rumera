"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  RECIPE_SEARCH_MAX_LENGTH,
  RECIPE_SORT_OPTIONS,
  type RecipeRouteQuery,
} from "@/features/recipes/routing";
import type { RecipeDifficulty } from "@/features/recipes/types";
import { difficultyFa } from "@/features/recipes/utils";
import { cn } from "@/lib/utils";

const RESULTS_ID = "recipe-results-title";
const difficulties: { value: RecipeDifficulty | ""; label: string }[] = [
  { value: "", label: "همه" },
  { value: "easy", label: difficultyFa.easy },
  { value: "medium", label: difficultyFa.medium },
  { value: "hard", label: difficultyFa.hard },
];

export function RecipeFilters({
  query,
}: {
  query: Pick<RecipeRouteQuery, "q" | "difficulty" | "sort">;
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

  const hasFilters =
    Boolean(query.q) || Boolean(query.difficulty) || query.sort !== "new";

  return (
    <div
      className={cn(
        "border-hairline flex flex-col gap-4 rounded-3xl bg-card/90 p-4 shadow-sm shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-sm transition-opacity sm:flex-row sm:items-center sm:p-3",
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
          maxLength={RECIPE_SEARCH_MAX_LENGTH}
          placeholder="جستجوی دستور… (مثلاً موخیتو)"
          className="h-11 ps-9 pe-12"
          aria-label="جستجوی دستورها"
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
            className="absolute top-1/2 end-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="فیلتر سختی دستور"
      >
        {difficulties.map((difficulty) => {
          const active = (query.difficulty ?? "") === difficulty.value;
          return (
            <button
              key={difficulty.value || "all"}
              type="button"
              onClick={() =>
                applyNow({ difficulty: difficulty.value || null })
              }
              aria-pressed={active}
              className={cn(
                "min-h-11 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {difficulty.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label="مرتب‌سازی دستورها"
          value={query.sort}
          onChange={(event) =>
            applyNow({
              sort: event.target.value === "new" ? null : event.target.value,
            })
          }
          className="[&_select]:h-11"
        >
          {RECIPE_SORT_OPTIONS.map((sort) => (
            <NativeSelectOption key={sort.value} value={sort.value}>
              {sort.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              clearSearchTimer();
              appliedSearch.current = "";
              setValue("");
              apply({ q: null, difficulty: null, sort: null });
            }}
            className="min-h-11 cursor-pointer rounded-xl px-3 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            پاک‌سازی
          </button>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? "در حال به‌روزرسانی دستورها" : "دستورها به‌روز شدند"}
      </span>
    </div>
  );
}
