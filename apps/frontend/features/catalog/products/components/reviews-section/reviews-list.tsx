import { Loader2, MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
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
        <EmptyState
          icon={MessageSquare}
          title={
            filter
              ? `نظری با ${faNum(filter)} ستاره یافت نشد`
              : "هنوز نظری ثبت نشده"
          }
          description={
            filter
              ? "پالایش را بردارید تا همهٔ نظرها را ببینید."
              : "تجربه‌تان را بنویسید — خریداران با نشان ویژه مشخص می‌شوند."
          }
        />
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
