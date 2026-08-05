"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TagOption = { id: number; title: string };

/**
 * Shared searchable multi-select for admin tag lists (recipe, journal, …).
 */
export function MultiTagPicker({
  options,
  value,
  onChange,
  disabled = false,
  label = "برچسب‌ها",
  emptyLabel = "برچسبی ثبت نشده است.",
}: {
  options: TagOption[];
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  label?: string;
  emptyLabel?: string;
}) {
  const [search, setSearch] = React.useState("");
  const byId = new Map(options.map((o) => [o.id, o]));
  const needle = search.trim().toLocaleLowerCase("fa");
  const filtered = needle
    ? options.filter((o) => o.title.toLocaleLowerCase("fa").includes(needle))
    : options;
  const selected = value
    .map((id) => byId.get(id))
    .filter((t): t is TagOption => Boolean(t));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={disabled}
              placeholder="جستجوی برچسب…"
              className="h-11 ps-9"
              aria-label="جستجوی برچسب"
            />
          </div>
          {selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {selected.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((id) => id !== tag.id))}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm text-primary"
                  aria-label={`حذف ${tag.title}`}
                >
                  {tag.title}
                  <X className="size-3.5" aria-hidden />
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange([])}
              >
                پاک‌کردن همه
              </Button>
            </div>
          ) : null}
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">موردی یافت نشد.</p>
            ) : (
              filtered.map((tag) => {
                const active = value.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() =>
                      onChange(
                        active
                          ? value.filter((id) => id !== tag.id)
                          : [...value, tag.id],
                      )
                    }
                    className={cn(
                      "min-h-10 rounded-full border px-3 text-sm",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tag.title}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </fieldset>
  );
}
