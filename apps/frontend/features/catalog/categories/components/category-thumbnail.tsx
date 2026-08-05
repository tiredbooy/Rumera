import { StorefrontMedia } from "@/components/storefront-media";
import { cn } from "@/lib/utils";

import type { CategoryTree } from "../types";

interface CategoryThumbnailProps {
  category: CategoryTree;
  active?: boolean;
  size?: "sm" | "md";
}

export function CategoryThumbnail({
  category,
  active = false,
  size = "md",
}: CategoryThumbnailProps) {
  const initial = category.title.trim().charAt(0) || "ر";

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg ring-1 ring-border/60",
        size === "sm" ? "size-8" : "size-10",
      )}
    >
      <StorefrontMedia
        slot="category-thumb"
        src={category.image_url}
        alt={`تصویر دسته‌بندی ${category.title}`}
        monogram={initial}
        className="transition-transform duration-300 group-hover/category:scale-105"
        fallbackClassName={cn(
          "gap-0 transition-colors",
          active && "from-primary/25 via-primary/10 to-secondary",
          size === "sm" ? "[&_span]:size-8 [&_span]:text-sm" : "[&_span]:size-10 [&_span]:text-base",
        )}
      />
    </span>
  );
}
