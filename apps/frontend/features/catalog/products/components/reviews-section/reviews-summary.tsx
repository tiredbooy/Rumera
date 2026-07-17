import type { ReactNode } from "react";
import Link from "next/link";
import { MessageSquare, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReviewStars } from "@/features/catalog/products/components/reviews-section/review-display";
import type {
  ProductRatingSummary,
  ReviewRating,
  ReviewRatingKey,
} from "@/features/reviews/types";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

const RATING_FILTERS: ReviewRating[] = [5, 4, 3, 2, 1];

export function ReviewLoginCta() {
  return (
    <Button asChild variant="outline" className="w-full">
      <Link href="/login">برای ثبت نظر وارد شوید</Link>
    </Button>
  );
}

export function ReviewsSummary({
  summary,
  total,
  averageRating,
  filter,
  onFilterChange,
  writeAction,
}: {
  summary: ProductRatingSummary | null;
  total: number;
  averageRating: number;
  filter: ReviewRating | null;
  onFilterChange: (rating: ReviewRating | null) => void;
  writeAction: ReactNode;
}) {
  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <p className="eyebrow mb-3">
        <MessageSquare className="size-3.5" /> نظرات خریداران
      </p>
      <div className="flex items-end gap-3">
        <span className="font-serif text-5xl text-foil">
          {faNum(Number(averageRating.toFixed(1)))}
        </span>
        <div className="pb-1.5">
          <ReviewStars value={averageRating} />
          <p className="mt-1 text-sm text-muted-foreground">
            {faNum(total)} نظر
          </p>
        </div>
      </div>

      {summary && total > 0 ? (
        <div
          className="mt-6 space-y-1.5"
          role="group"
          aria-label="پالایش بر اساس امتیاز"
        >
          {RATING_FILTERS.map((star) => {
            const count =
              summary.distribution[String(star) as ReviewRatingKey] ?? 0;
            const percentage =
              total > 0 ? Math.round((count / total) * 100) : 0;
            const isActive = filter === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => onFilterChange(isActive ? null : star)}
                aria-pressed={isActive}
                disabled={count === 0}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors enabled:cursor-pointer enabled:hover:bg-secondary/60 disabled:opacity-50",
                  isActive && "bg-secondary",
                )}
              >
                <span className="w-3 text-end tabular-nums">{faNum(star)}</span>
                <Star
                  className="size-3 fill-primary/70 text-primary/70"
                  aria-hidden
                />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ width: `${percentage}%` }}
                  />
                </span>
                <span className="w-8 text-start tabular-nums">
                  {faNum(count)}
                </span>
              </button>
            );
          })}
          {filter ? (
            <button
              type="button"
              onClick={() => onFilterChange(null)}
              className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline"
            >
              <X className="size-3" /> حذف پالایش
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        {writeAction}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          فقط خریداران می‌توانند برای این محصول نظر ثبت کنند.
        </p>
      </div>
    </div>
  );
}
