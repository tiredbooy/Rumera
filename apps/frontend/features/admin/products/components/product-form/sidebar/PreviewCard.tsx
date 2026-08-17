"use client";

import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/optimized-image";

export function PreviewCard({
  imageUrl,
  title,
  brandName,
  isActive,
  mode,
}: {
  imageUrl?: string | null;
  title: string;
  brandName?: string;
  isActive: boolean;
  mode: "create" | "edit";
}) {
  return (
    <div className="border-hairline rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/[0.04]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">پیش‌نمایش</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            isActive
              ? "bg-success/12 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isActive ? "منتشر" : "پیش‌نویس"}
        </span>
      </div>

      <span className="relative mx-auto flex aspect-[4/5] w-32 items-end justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/[0.04]">
        <OptimizedImage
          src={imageUrl}
          alt={title || "تصویر محصول"}
          width={256}
          className="h-full w-full"
        />
      </span>

      <p className="mt-4 truncate font-medium">{title || "نام محصول"}</p>
      <p className="text-xs text-muted-foreground">
        {brandName ?? (mode === "create" ? "برند" : "بدون برند")}
      </p>
    </div>
  );
}
