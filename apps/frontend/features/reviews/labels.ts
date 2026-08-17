import type { ReviewStatus } from "./types";

/** One wording per review status — shopper and moderator see the same record. */
export const REVIEW_STATUS_FA: Record<ReviewStatus, string> = {
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
};
