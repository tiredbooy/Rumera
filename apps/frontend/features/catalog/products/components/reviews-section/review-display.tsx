import { Star } from "lucide-react";

import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function ReviewStars({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${faNum(value)} از ۵ ستاره`}
    >
      {STAR_VALUES.map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            "size-4",
            star <= Math.round(value)
              ? "fill-primary text-primary"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

export function formatReviewDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
