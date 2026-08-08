import { ShieldCheck, ThumbsUp } from "lucide-react";

import {
  formatReviewDate,
  ReviewStars,
} from "@/features/catalog/products/components/reviews-section/review-display";
import type { Review } from "@/features/reviews/types";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

export function ReviewCard({
  review,
  isPending,
  reacted,
  onHelpful,
}: {
  review: Review;
  isPending: boolean;
  reacted: boolean;
  onHelpful: (id: number) => void;
}) {
  return (
    <li className="border-hairline rounded-2xl bg-card/50 p-5 ring-1 ring-foreground/5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReviewStars value={review.rating} />
        <span className="text-xs text-muted-foreground">
          {formatReviewDate(review.created_at)}
        </span>
      </div>
      {review.title ? (
        <h3 className="mt-3 font-serif text-lg leading-tight">
          {review.title}
        </h3>
      ) : null}
      {review.content ? (
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {review.content}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isPending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            در انتظار تأیید
          </span>
        ) : review.verified_purchase ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> خرید تأییدشده
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            بازدیدکننده
          </span>
        )}
        {!isPending ? (
          <button
            type="button"
            onClick={() => onHelpful(review.id)}
            disabled={reacted}
            className={cn(
              "ms-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-default disabled:opacity-60",
              reacted && "border-primary/40 text-primary",
            )}
            aria-label="این نظر مفید بود"
          >
            <ThumbsUp className="size-3.5" /> مفید بود
            {review.like_count > 0 ? (
              <span>({faNum(review.like_count)})</span>
            ) : null}
          </button>
        ) : null}
      </div>
    </li>
  );
}
