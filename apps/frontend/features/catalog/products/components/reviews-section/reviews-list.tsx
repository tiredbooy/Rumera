import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReviewCard } from "@/features/catalog/products/components/reviews-section/review-card";
import type { Review, ReviewRating } from "@/features/reviews/types";
import { faNum } from "@/lib/products";

export function ReviewsList({
  reviews,
  pendingCount,
  filter,
  reacted,
  hasNext,
  loading,
  isPending,
  onHelpful,
  onLoadMore,
}: {
  reviews: Review[];
  pendingCount: number;
  filter: ReviewRating | null;
  reacted: ReadonlySet<number>;
  hasNext: boolean;
  loading: boolean;
  isPending: boolean;
  onHelpful: (id: number) => void;
  onLoadMore: () => void;
}) {
  return (
    <div aria-busy={loading || isPending}>
      {reviews.length === 0 ? (
        <div className="border-hairline flex flex-col items-center rounded-3xl bg-card/40 px-6 py-16 text-center ring-1 ring-foreground/5">
          <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <MessageSquare className="size-6" />
          </span>
          <p className="font-medium">
            {filter
              ? `نظری با ${faNum(filter)} ستاره یافت نشد`
              : "هنوز نظری ثبت نشده"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter
              ? "پالایش را بردارید تا همهٔ نظرها را ببینید."
              : "اولین نفری باشید که تجربه‌اش را می‌نویسد."}
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {reviews.map((review, index) => {
            const isPendingRow = index < pendingCount;

            return (
              <ReviewCard
                key={`${isPendingRow ? "p" : "r"}-${review.id}`}
                review={review}
                isPending={isPendingRow}
                reacted={reacted.has(review.id)}
                onHelpful={onHelpful}
              />
            );
          })}
        </ul>
      )}

      {hasNext ? (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading || isPending}
          >
            {loading || isPending ? <Loader2 className="animate-spin" /> : null}
            نمایش نظرهای بیشتر
          </Button>
        </div>
      ) : null}
    </div>
  );
}
