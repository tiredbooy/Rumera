"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Check,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  parseReviewQueuePage,
  parseReviewQueueTab,
  reviewsQueueHref,
} from "@/features/admin/reviews/reviews-queue-params";
import {
  AdminFilterBar,
  AdminPage,
} from "@/features/dashboard/components/admin-page";
import {
  useAdminReviews,
  useModerateReview,
} from "@/features/reviews/hooks";
import { REVIEW_STATUS_FA } from "@/features/reviews/labels";
import { ReviewStatusBadge } from "@/features/reviews/review-status-badge";
import type {
  AdminReview,
  ReviewStatus,
} from "@/features/reviews/types";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${faNum(rating)} از ۵`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            "size-3.5",
            index < rating ? "fill-gold text-gold" : "fill-muted text-muted",
          )}
        />
      ))}
    </span>
  );
}

const TABS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "pending", label: REVIEW_STATUS_FA.pending },
  { value: "approved", label: REVIEW_STATUS_FA.approved },
  { value: "rejected", label: REVIEW_STATUS_FA.rejected },
];

const PAGE_SIZE = 20;

type ReviewProductFields = {
  product_title?: string | null;
  product_slug?: string | null;
};

function reviewProductLabel(review: AdminReview): string {
  const extra = review as AdminReview & ReviewProductFields;
  const title = extra.product_title?.trim();
  if (title) {
    return title;
  }
  const slug = extra.product_slug?.trim();
  if (slug) {
    return slug;
  }
  return `محصول #${faNum(review.product_id)}`;
}

export function ReviewsQueue({
  canModerate,
}: {
  canModerate: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseReviewQueueTab(searchParams.get("status"));
  const page = parseReviewQueuePage(searchParams.get("page"));
  const reviewsQuery = useAdminReviews({
    page,
    limit: PAGE_SIZE,
    sortBy: "created_at",
    orderBy: "desc",
    ...(tab === "all" ? {} : { status: tab }),
  });
  const moderate = useModerateReview();
  const rows = reviewsQuery.data?.results ?? [];
  const showInitialLoading = reviewsQuery.isLoading && !reviewsQuery.data;

  async function changeStatus(review: AdminReview, status: ReviewStatus) {
    try {
      await moderate.mutateAsync({
        id: review.id,
        productId: review.product_id,
        input: { status },
      });
      toast.success(status === "approved" ? "دیدگاه تأیید شد" : "دیدگاه رد شد");
    } catch {
      toast.error("به‌روزرسانی دیدگاه ناموفق بود");
    }
  }

  return (
    <AdminPage
      title="دیدگاه‌ها"
      description="بازبینی و تأیید نظرهای مشتریان."
      filters={
        <AdminFilterBar
          id="reviews-filter-title"
          title="فیلتر دیدگاه‌ها"
          hasFilters={tab !== "all"}
          resetHref={reviewsQueueHref("all", 1, pathname)}
        >
          <Tabs value={tab}>
            <TabsList>
              {TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value} asChild>
                  <Link href={reviewsQueueHref(item.value, 1, pathname)}>
                    {item.label}
                  </Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </AdminFilterBar>
      }
      pagination={
        reviewsQuery.data ? (
          <ListPagination
            page={reviewsQuery.data.pagination.page}
            totalPages={reviewsQuery.data.pagination.total_pages}
            hasPrev={reviewsQuery.data.pagination.has_prev}
            hasNext={reviewsQuery.data.pagination.has_next}
            prevHref={reviewsQueueHref(tab, page - 1, pathname)}
            nextHref={reviewsQueueHref(tab, page + 1, pathname)}
            disabled={reviewsQuery.isFetching}
            ariaLabel="صفحه‌بندی دیدگاه‌ها"
          />
        ) : null
      }
    >
      <div className="flex flex-col gap-5">
      {showInitialLoading ? (
        <div
          className="border-hairline flex min-h-64 items-center justify-center rounded-2xl bg-card text-muted-foreground"
          role="status"
        >
          <Loader2 className="me-2 size-5 animate-spin" aria-hidden />
          در حال دریافت دیدگاه‌ها…
        </div>
      ) : reviewsQuery.isError && !reviewsQuery.data ? (
        <div
          className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center text-sm text-destructive"
          role="alert"
          aria-busy={reviewsQuery.isFetching}
        >
          <p>خطا در دریافت دیدگاه‌ها.</p>
          <Button
            variant="outline"
            size="sm"
            disabled={reviewsQuery.isFetching}
            onClick={() => void reviewsQuery.refetch()}
          >
            {reviewsQuery.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {reviewsQuery.isFetching ? "در حال تلاش…" : "تلاش دوباره"}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="border-hairline flex flex-col items-center justify-center gap-3 rounded-2xl border-dashed bg-card/40 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border/60">
            <Star className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">دیدگاهی در این بخش نیست.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((review) => (
            <li
              key={review.id}
              className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors hover:ring-foreground/[0.08]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary ring-1 ring-primary/15">
                    {(review.user_full_name.trim() || "ک").charAt(0)}
                  </span>
                  <div className="leading-tight">
                    <p className="font-medium">
                      {review.user_full_name.trim() || "کاربر"}
                    </p>
                    <Link
                      href={`/admin/products/${review.product_id}`}
                      className="text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {reviewProductLabel(review)}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Stars rating={review.rating} />
                  <ReviewStatusBadge status={review.status} />
                </div>
              </div>

              <p className="mt-3 font-medium">{review.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {review.content}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {faDate(review.created_at)}
                </span>
                {canModerate ? (
                  <div className="flex items-center gap-2">
                    {review.status !== "approved" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={moderate.isPending}
                        className="text-success hover:text-success"
                        onClick={() => changeStatus(review, "approved")}
                      >
                        {moderate.isPending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Check className="size-4" aria-hidden />
                        )}
                        تأیید
                      </Button>
                    ) : null}
                    {review.status !== "rejected" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={moderate.isPending}
                        onClick={() => changeStatus(review, "rejected")}
                      >
                        <X className="size-4" aria-hidden /> رد
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </AdminPage>
  );
}
