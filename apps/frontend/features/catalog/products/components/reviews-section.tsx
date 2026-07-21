"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  ReviewLoginCta,
  ReviewsSummary,
} from "@/features/catalog/products/components/reviews-section/reviews-summary";
import { ReviewsList } from "@/features/catalog/products/components/reviews-section/reviews-list";
import { WriteReviewDialog } from "@/features/catalog/products/components/reviews-section/write-review-dialog";
import { fetchReviewsPage } from "@/features/reviews/actions";
import { useReactToReview } from "@/features/reviews/hooks";
import type {
  ProductRatingSummary,
  Review,
  ReviewRating,
  ReviewReactionInput,
} from "@/features/reviews/types";

const PAGE_SIZE = 8;

/**
 * PDP reviews orchestration owner. Keeps auth, server-backed filtering and
 * pagination, pending-review visibility, and optimistic reactions together.
 */
export function ReviewsSection({
  productId,
  summary,
  initialReviews,
  initialHasNext,
}: {
  productId: number;
  summary: ProductRatingSummary | null;
  initialReviews: Review[];
  initialHasNext: boolean;
}) {
  const { status } = useSession();
  const authed = status === "authenticated";

  const [reviews, setReviews] = React.useState<Review[]>(initialReviews);
  const [reacted, setReacted] = React.useState<Set<number>>(new Set());
  const [filter, setFilter] = React.useState<ReviewRating | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasNext, setHasNext] = React.useState(initialHasNext);
  const [loading, setLoading] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  // Newly written reviews (pending moderation) are retained across filters so
  // the author sees their submission again when viewing all reviews.
  const [pending, setPendingReviews] = React.useState<Review[]>([]);
  const reactMutation = useReactToReview(productId);

  const total = summary?.total_reviews ?? reviews.length;
  const averageRating = summary?.average_rating ?? 0;

  function applyFilter(rating: ReviewRating | null) {
    if (rating === filter) return;
    setFilter(rating);
    setLoading(true);
    startTransition(async () => {
      const res = await fetchReviewsPage(productId, {
        page: 1,
        limit: PAGE_SIZE,
        ...(rating ? { rating } : {}),
      });
      setReviews(res.reviews);
      setHasNext(res.hasNext);
      setPage(1);
      setLoading(false);
    });
  }

  function loadMore() {
    const next = page + 1;
    setLoading(true);
    startTransition(async () => {
      const res = await fetchReviewsPage(productId, {
        page: next,
        limit: PAGE_SIZE,
        ...(filter ? { rating: filter } : {}),
      });
      setReviews((current) => [...current, ...res.reviews]);
      setHasNext(res.hasNext);
      setPage(next);
      setLoading(false);
    });
  }

  async function react(id: number) {
    if (!authed) {
      toast.info("برای ثبت بازخورد وارد شوید");
      return;
    }
    if (reacted.has(id)) return;

    setReacted((current) => new Set(current).add(id));
    const bump = (delta: number) =>
      setReviews((current) =>
        current.map((review) =>
          review.id === id
            ? { ...review, like_count: review.like_count + delta }
            : review,
        ),
      );
    bump(1);

    try {
      const input: ReviewReactionInput = { like: true };
      await reactMutation.mutateAsync({ id, input });
    } catch {
      bump(-1);
      setReacted((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      toast.error("ثبت بازخورد ناموفق بود");
    }
  }

  // Pending reviews stay above the feed and disappear while a star filter is active.
  const visiblePending = filter ? [] : pending;
  const mergedReviews = [...visiblePending, ...reviews];

  return (
    <section
      aria-labelledby="reviews-heading"
      className="container-px mx-auto max-w-7xl py-16 sm:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-14">
        <ReviewsSummary
          summary={summary}
          total={total}
          averageRating={averageRating}
          filter={filter}
          onFilterChange={applyFilter}
          writeAction={
            authed ? (
              <WriteReviewDialog
                productId={productId}
                onCreated={(review) =>
                  setPendingReviews((current) => [review, ...current])
                }
              />
            ) : (
              <ReviewLoginCta />
            )
          }
        />
        <ReviewsList
          reviews={mergedReviews}
          pendingCount={visiblePending.length}
          filter={filter}
          reacted={reacted}
          hasNext={hasNext}
          loading={loading}
          isPending={isPending}
          onHelpful={react}
          onLoadMore={loadMore}
        />
      </div>
    </section>
  );
}
