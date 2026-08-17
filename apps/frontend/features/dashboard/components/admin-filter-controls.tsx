"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

/** Idle time before a typed query is pushed to the URL. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * One filter-bar behaviour for the whole console: a filter change rewrites the
 * query string and always returns to page 1. No «اعمال» button — dropdowns
 * apply on change, search applies after a short pause.
 */
export function useFilterNav() {
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
      params.delete("page");
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
  disabled,
}: {
  id: string;
  label: string;
  placeholder?: string;
  /** Current committed value, from the URL. */
  value: string;
  param?: string;
  disabled?: boolean;
}) {
  const navigate = useFilterNav();
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
      () => navigate({ [param]: draft.trim() || undefined }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [draft, navigate, param, value]);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="h-9 ps-9"
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
  disabled,
}: {
  id: string;
  label: string;
  param: string;
  value: string;
  /** `value: ""` renders the “all” entry. */
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
}) {
  const navigate = useFilterNav();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          navigate({ [param]: event.target.value || undefined })
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
