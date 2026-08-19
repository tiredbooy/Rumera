"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listBrands } from "@/features/admin/brands/client";
import { cn } from "@/lib/utils";

export type BrandOption = { id: number; title: string };

/**
 * What a brand is called when it cannot be labelled — deleted, or the lookup
 * failed. Never «انتخاب برند»: an operator reading "no brand" over a product
 * that *has* one will helpfully «fix» it and overwrite the real value (PE-4).
 */
export const unknownBrandLabel = (id: number) =>
  // An id is an identifier, not a quantity: no thousands separator.
  `برند ${id.toLocaleString("fa-IR", { useGrouping: false })}`;

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 20;

/**
 * Brand picker for the product form. Unlike `SearchableIdSelect` it never holds
 * the whole catalogue: the query goes to the server, and the product's own
 * brand is seeded by id so it reads true no matter which page it would land on.
 */
export function BrandSelect({
  id,
  value,
  selectedBrand,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: {
  id?: string;
  /** Stringified brand id, or "" — matches the react-hook-form string field. */
  value: string;
  /** The product's current brand, fetched by id on the server. */
  selectedBrand?: BrandOption | null;
  onChange: (next: string, brand: BrandOption | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BrandOption[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [attempt, setAttempt] = React.useState(0);
  // Every brand this control has picked, so a selection keeps its name after
  // the result list moves on to another search. The seeded brand is consulted
  // separately below rather than copied in, which would need an effect.
  const [labels, setLabels] = React.useState<Record<number, string>>({});

  // Server-side search. Filtering a client-side page of 100 hid every brand
  // past #100 behind «موردی یافت نشد» and made them unassignable (PE-4).
  React.useEffect(() => {
    if (!open) return;
    const needle = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        setStatus("loading");
        void listBrands({
          page: 1,
          limit: SEARCH_LIMIT,
          sortBy: "title",
          orderBy: "asc",
          ...(needle ? { search: needle } : {}),
        })
          .then((page) => {
            if (cancelled) return;
            const options = (page.results ?? []).map((brand) => ({
              id: brand.id,
              title: brand.title,
            }));
            setResults(options);
            setLabels((current) => ({
              ...current,
              ...Object.fromEntries(
                options.map((option) => [option.id, option.title]),
              ),
            }));
            setStatus("idle");
          })
          .catch(() => {
            if (!cancelled) setStatus("error");
          });
      },
      needle ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt, open, query]);

  const selectedId = value ? Number(value) : 0;
  const selectedLabel = selectedId
    ? (labels[selectedId] ??
      (selectedBrand?.id === selectedId ? selectedBrand.title : undefined) ??
      unknownBrandLabel(selectedId))
    : null;

  function pick(option: BrandOption | null) {
    onChange(option ? String(option.id) : "", option);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setResults([]);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between font-normal",
            !selectedLabel && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selectedLabel ?? "انتخاب برند"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b border-border/60 p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجوی برند…"
              className="h-10 ps-8"
              aria-label="جستجوی برند"
              autoFocus
            />
          </div>
        </div>
        <ul
          role="listbox"
          aria-label="انتخاب برند"
          aria-live="polite"
          className="max-h-60 overflow-y-auto p-1"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm",
                !value
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/70",
              )}
              onClick={() => pick(null)}
            >
              <Check
                className={cn("size-4", value ? "opacity-0" : "opacity-100")}
                aria-hidden
              />
              بدون برند
            </button>
          </li>
          {status === "loading" ? (
            <li
              role="status"
              className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden /> در حال
              جستجو…
            </li>
          ) : status === "error" ? (
            <li className="flex flex-col items-center gap-2 px-3 py-4 text-center text-sm text-muted-foreground">
              بارگذاری برندها ناموفق بود.
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAttempt((current) => current + 1)}
              >
                تلاش دوباره
              </Button>
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              موردی یافت نشد.
            </li>
          ) : (
            results.map((option) => {
              const active = value === String(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/70",
                    )}
                    onClick={() => pick(option)}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{option.title}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
