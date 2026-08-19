"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toAsciiDigits } from "@/lib/normalize-digits";

/** Idle time before a typed query is written to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * One filter-bar behaviour for the whole console (S-3). A filter change
 * rewrites the query string in place — `replace`, not `push`, because status
 * triage is a toggling loop and must not leave a history entry per hop — and
 * returns to page 1 so the operator never lands past the end of the new result
 * set. Params the list does not own (campaign, attribution, a deep link's own
 * state) survive because the string is rebuilt from the live `searchParams`.
 *
 * The one exception is an explicit `page`: that is the pager, not a filter.
 *
 * No «اعمال» button anywhere — dropdowns apply on change, text applies after a
 * short pause.
 */
export function useFilterParams() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (!("page" in updates)) params.delete("page");
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      React.startTransition(() => router.replace(href));
    },
    [pathname, router, searchParams],
  );
}

/**
 * Debounced search box. Owns its draft so typing stays smooth while the list
 * behind it re-fetches, and re-syncs when the URL changes underneath it.
 */
export function FilterSearchInput({
  id,
  label,
  placeholder,
  value,
  param = "q",
  numeric = false,
  disabled,
}: {
  id: string;
  label: string;
  placeholder?: string;
  /** Current committed value, from the URL. */
  value: string;
  param?: string;
  /**
   * Id-style field: digits only. Eastern digits are folded and everything else
   * is dropped as it is typed, so a half-typed id is a *narrower* query rather
   * than a wrong one — which is what let the «اعمال» buttons go away.
   */
  numeric?: boolean;
  disabled?: boolean;
}) {
  const setFilters = useFilterParams();
  const [draft, setDraft] = React.useState(value);
  const [committed, setCommitted] = React.useState(value);

  // Re-sync when the URL moves for any other reason (reset, back button).
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  React.useEffect(() => {
    if (draft.trim() === value) return;
    const timer = window.setTimeout(
      () => setFilters({ [param]: draft.trim() || undefined }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [draft, param, setFilters, value]);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {numeric ? null : (
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
        )}
        <Input
          id={id}
          type="search"
          inputMode={numeric ? "numeric" : undefined}
          dir={numeric ? "ltr" : undefined}
          value={draft}
          disabled={disabled}
          onChange={(event) =>
            setDraft(
              numeric
                ? toAsciiDigits(event.target.value).replace(/\D/g, "")
                : event.target.value,
            )
          }
          placeholder={placeholder}
          className={numeric ? "h-9" : "h-9 ps-9"}
        />
      </div>
    </div>
  );
}

/** Dropdown filter that applies on change. `""` means “no filter”. */
export function FilterSelect({
  id,
  label,
  param,
  value,
  options,
  clears,
  disabled,
}: {
  id: string;
  label: string;
  param: string;
  value: string;
  /** `value: ""` renders the “all” entry. */
  options: readonly { value: string; label: string }[];
  /** Legacy aliases for the same filter, dropped whenever this one changes. */
  clears?: readonly string[];
  disabled?: boolean;
}) {
  const setFilters = useFilterParams();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          setFilters({
            ...Object.fromEntries(
              (clears ?? []).map((alias) => [alias, undefined]),
            ),
            [param]: event.target.value || undefined,
          })
        }
        className="w-full [&_[data-slot=native-select]]:h-9"
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

/**
 * The filter params one list owns, param name → Persian label. Declared once
 * per list and handed to both the chips and the saved-view menu, so the two
 * can never drift apart.
 */
export type FilterParamLabels = Readonly<Record<string, string>>;

/** One active filter, as the list wants it read back to the operator. */
export type FilterChip = {
  /** Param(s) this chip owns; removing it clears all of them. */
  param: string | readonly string[];
  /** Already-localised, e.g. «وضعیت: در حال ارسال». */
  label: string;
};

function chipParams(chip: FilterChip): readonly string[] {
  return typeof chip.param === "string" ? [chip.param] : chip.param;
}

/**
 * Active filters, each individually clearable.
 *
 * Also the honest end of the saved-view story: a param that is present in the
 * URL but that the list's parser refused (a status that was renamed since the
 * view was saved, a stale id) produces no chip of its own, so it is surfaced
 * here as an “ignored” chip instead of silently narrowing — or failing to
 * narrow — the list with no explanation.
 */
export function AdminFilterChips({
  params,
  chips,
}: {
  params: FilterParamLabels;
  chips: readonly FilterChip[];
}) {
  const setFilters = useFilterParams();
  const searchParams = useSearchParams();

  const claimed = new Set(chips.flatMap(chipParams));
  const ignored = Object.keys(params).filter(
    (param) => !claimed.has(param) && (searchParams.get(param) ?? "") !== "",
  );

  if (chips.length === 0 && ignored.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li key={chipParams(chip).join(",")}>
          <Badge variant="outline" className="h-7 gap-1 ps-2.5 pe-1 text-xs">
            {chip.label}
            <button
              type="button"
              aria-label={`حذف فیلتر ${chip.label}`}
              onClick={() =>
                setFilters(
                  Object.fromEntries(
                    chipParams(chip).map((param) => [param, undefined]),
                  ),
                )
              }
              className="flex size-5 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
      {ignored.map((param) => (
        <li key={param}>
          <Badge
            variant="outline"
            tone="warning"
            className="h-7 gap-1 ps-2.5 pe-1 text-xs"
          >
            {params[param]}: مقدار نامعتبر، اعمال نشد
            <button
              type="button"
              aria-label={`حذف فیلتر نامعتبر ${params[param]}`}
              onClick={() => setFilters({ [param]: undefined })}
              className="flex size-5 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-warning/20 focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

type SavedView = { name: string; query: string };

/** Room for a shift's worth of views without letting the menu grow unbounded. */
const SAVED_VIEWS_LIMIT = 12;

function viewsStorageKey(list: string): string {
  return `rumera:admin-views:${list}`;
}

/**
 * ponytail: localStorage, per browser profile. A saved view is one operator's
 * scratch preference over params that already live in a shareable URL, so it
 * buys nothing from a table and a migration. Move it server-side when views
 * need to be shared between operators, and not before.
 */
function readSavedViews(list: string): SavedView[] {
  try {
    const raw = window.localStorage.getItem(viewsStorageKey(list));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedView =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as SavedView).name === "string" &&
          typeof (item as SavedView).query === "string",
      )
      .slice(0, SAVED_VIEWS_LIMIT);
  } catch {
    // Private mode, quota, or a hand-edited value — views are a convenience.
    return [];
  }
}

function writeSavedViews(list: string, views: SavedView[]): void {
  try {
    window.localStorage.setItem(viewsStorageKey(list), JSON.stringify(views));
  } catch {
    /* see readSavedViews */
  }
}

/**
 * Persist a filter combination and come back to it later.
 *
 * Only the params the list declares are stored, so a saved view never carries
 * a page number or somebody else's campaign param, and applying one clears
 * every declared param first — otherwise a leftover filter would quietly
 * intersect with the view.
 */
export function AdminSavedViews({
  list,
  params,
}: {
  /** Storage namespace — the list's route segment, e.g. `"orders"`. */
  list: string;
  params: FilterParamLabels;
}) {
  const setFilters = useFilterParams();
  const searchParams = useSearchParams();
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [name, setName] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const keys = Object.keys(params);
  const current = new URLSearchParams();
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) current.set(key, value);
  }
  const currentQuery = current.toString();

  function persist(next: SavedView[]) {
    setViews(next);
    writeSavedViews(list, next);
  }

  function save() {
    const label = name.trim();
    if (!label || !currentQuery) return;
    persist(
      [
        { name: label, query: currentQuery },
        ...views.filter((view) => view.name !== label),
      ].slice(0, SAVED_VIEWS_LIMIT),
    );
    setName("");
    setOpen(false);
  }

  function apply(view: SavedView) {
    const saved = new URLSearchParams(view.query);
    setFilters(
      Object.fromEntries(
        keys.map((key) => [key, saved.get(key) || undefined]),
      ),
    );
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Read on open rather than on mount: localStorage does not exist during
        // the server render, and this also picks up a view saved in another tab.
        if (next) setViews(readSavedViews(list));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 shrink-0">
          <Bookmark className="size-4" aria-hidden /> نماهای ذخیره‌شده
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        {views.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {views.map((view) => (
              <li key={view.name} className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => apply(view)}
                  className="h-8 min-w-0 flex-1 justify-start font-normal"
                >
                  <span className="truncate">{view.name}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`حذف نمای ${view.name}`}
                  onClick={() =>
                    persist(views.filter((item) => item.name !== view.name))
                  }
                  className="size-8 shrink-0"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            هنوز نمایی ذخیره نشده است. فیلترها را تنظیم کنید و اینجا نام
            بگذارید.
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="flex items-end gap-2 border-t border-border/60 pt-3"
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor={`saved-view-name-${list}`} className="text-xs">
              ذخیرهٔ فیلترهای فعلی
            </Label>
            <Input
              id={`saved-view-name-${list}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="نام نما"
              disabled={!currentQuery}
              className="mt-1 h-8"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!currentQuery || !name.trim()}
            className="h-8 shrink-0"
          >
            ذخیره
          </Button>
        </form>
        {currentQuery ? null : (
          <p className="text-xs text-muted-foreground">
            برای ذخیره، دست‌کم یک فیلتر را اعمال کنید.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
