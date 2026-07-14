"use client";

import { Controller, type Control } from "react-hook-form";
import { Tag as TagIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Tag } from "@/features/catalog/tags/types";
import type { ProductFormValues } from "../../validations";

export function TagSelector({
  control,
  tags,
}: {
  control: Control<ProductFormValues>;
  tags: Tag[];
}) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <TagIcon className="size-3.5 text-muted-foreground" />
        برچسب‌ها
      </span>
      <Controller
        control={control}
        name="tag_ids"
        render={({ field }) => (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const active = field.value.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    field.onChange(
                      active
                        ? field.value.filter((id) => id !== t.id)
                        : [...field.value, t.id],
                    )
                  }
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm transition-colors",
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
    </div>
  );
}
