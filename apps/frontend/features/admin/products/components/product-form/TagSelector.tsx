"use client";

import { Controller, type Control } from "react-hook-form";
import { Loader2, RotateCw, Tag as TagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAllTags } from "@/features/admin/tags/api";
import { cn } from "@/lib/utils";
import type { ProductTag, Tag } from "@/features/catalog/tags/types";
import type { ProductFormValues } from "../../validations";

export function TagSelector({
  control,
  initialTags = [],
  disabled = false,
}: {
  control: Control<ProductFormValues>;
  initialTags?: ProductTag[];
  disabled?: boolean;
}) {
  const query = useAllTags();
  const tagsByID = new Map<number, Tag | ProductTag>();
  for (const tag of initialTags) tagsByID.set(tag.id, tag);
  for (const tag of query.data ?? []) tagsByID.set(tag.id, tag);
  const tags = [...tagsByID.values()];

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
      <legend className="flex items-center gap-1.5 text-sm font-medium">
        <TagIcon className="size-3.5 text-muted-foreground" />
        برچسب‌ها
      </legend>
      <p className="text-xs text-muted-foreground">
        برچسب‌های مرتبط با محصول را انتخاب کنید.
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

      <Controller
        control={control}
        name="tag_ids"
        render={({ field }) => (
          <div
            className="flex flex-wrap gap-2"
            aria-busy={query.isFetching || undefined}
          >
            {tags.map((t) => {
              const value = field.value ?? [];
              const active = value.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
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
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
        )}
      />
    </fieldset>
  );
}
