import type { ReviewStatus } from "@/features/reviews/types";

export type ReviewQueueTab = ReviewStatus | "all";

export function parseReviewQueueTab(value: string | null): ReviewQueueTab {
  if (
    value === "all" ||
    value === "pending" ||
    value === "approved" ||
    value === "rejected"
  ) {
    return value;
  }
  return "pending";
}

export function parseReviewQueuePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function reviewsQueueHref(
  tab: ReviewQueueTab,
  page = 1,
  pathname = "/admin/reviews",
): string {
  const params = new URLSearchParams();
  params.set("status", tab);
  if (page > 1) params.set("page", String(page));
  return `${pathname}?${params.toString()}`;
}
