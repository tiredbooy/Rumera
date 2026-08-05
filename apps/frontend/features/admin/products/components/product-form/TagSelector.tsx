"use client";

import * as React from "react";
import { Controller, type Control } from "react-hook-form";
import { Loader2, RotateCw, Search, Tag as TagIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAllTags } from "@/features/admin/tags/api";
import { cn } from "@/lib/utils";
import type { ProductTag, Tag } from "@/features/catalog/tags/types";
import type { ProductFormValues } from "../../validations";

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("fa");
}

export function TagSelector({
  control,
  initialTags = [],
  disabled = false,
  error,
}: {
  control: Control<ProductFormValues>;
  initialTags?: ProductTag[];
  disabled?: boolean;
  error?: string;
}) {
  const query = useAllTags();
  const [search, setSearch] = React.useState("");
  const tagsByID = new Map<number, Tag | ProductTag>();
  for (const tag of initialTags) tagsByID.set(tag.id, tag);
  for (const tag of query.data ?? []) tagsByID.set(tag.id, tag);
  const tags = [...tagsByID.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "fa"),
  );
  const errorId = fieldErrorId("tag_ids");
  const needle = normalizeSearch(search);
  const filtered = needle
    ? tags.filter((tag) => normalizeSearch(tag.title).includes(needle))
    : tags;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
      <legend className="flex items-center gap-1.5 text-sm font-medium">
        <TagIcon className="size-3.5 text-muted-foreground" />
        برچسب‌ها
      </legend>
      <p className="text-xs text-muted-foreground">
        جستجو کنید و برچسب‌های مرتبط را انتخاب کنید. برچسب‌های انتخاب‌شده بالای
        فهرست مشخص‌اند.
      </p>

      {query.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          در حال بارگذاری برچسب‌ها…
        </p>
      ) : null}

      {query.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20"
        >
          <span>بارگذاری فهرست برچسب‌ها ناموفق بود.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching || disabled}
          >
            <RotateCw
              className={query.isFetching ? "size-4 animate-spin" : "size-4"}
            />
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {query.isSuccess && tags.length === 0 ? (
        <p className="rounded-xl bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
          هنوز برچسبی برای انتخاب ثبت نشده است.
        </p>
      ) : null}

      {tags.length > 0 ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled || query.isPending}
            placeholder="جستجوی برچسب…"
            className="h-11 ps-9"
            aria-label="جستجوی برچسب"
          />
        </div>
      ) : null}

      <Controller
        control={control}
        name="tag_ids"
        render={({ field }) => {
          const value = field.value ?? [];
          const selected = value
            .map((id) => tagsByID.get(id))
            .filter((tag): tag is Tag | ProductTag => Boolean(tag));

          return (
            <div className="flex min-w-0 flex-col gap-3">
              {selected.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    انتخاب‌شده:
                  </span>
                  {selected.map((tag) => (
                    <button
                      key={`selected-${tag.id}`}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        field.onChange(value.filter((id) => id !== tag.id))
                      }
                      className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm text-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
                      aria-label={`حذف برچسب ${tag.title}`}
                    >
                      <span className="truncate">{tag.title}</span>
                      <X className="size-3.5 shrink-0" aria-hidden />
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    disabled={disabled || value.length === 0}
                    onClick={() => field.onChange([])}
                  >
                    پاک‌کردن همه
                  </Button>
                </div>
              ) : null}

              <div
                className="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3"
                aria-busy={query.isFetching || undefined}
              >
                {filtered.length === 0 && tags.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    برچسبی با این عبارت پیدا نشد.
                  </p>
                ) : null}
                {filtered.map((t, index) => {
                  const active = value.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={active}
                      aria-invalid={error && index === 0 ? true : undefined}
                      aria-describedby={
                        error && index === 0 ? errorId : undefined
                      }
                      disabled={disabled}
                      onClick={() =>
                        field.onChange(
                          active
                            ? value.filter((id) => id !== t.id)
                            : [...value, t.id],
                        )
                      }
                      className={cn(
                        "min-h-11 max-w-full min-w-0 break-words rounded-full border px-3 text-sm whitespace-normal transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        "focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
