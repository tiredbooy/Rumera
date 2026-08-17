import { describe, expect, it } from "vitest";

import {
  parseReviewQueuePage,
  parseReviewQueueTab,
  reviewsQueueHref,
} from "./reviews-queue-params";

describe("reviews queue URL", () => {
  it("defaults to the pending tab and page 1", () => {
    expect(parseReviewQueueTab(null)).toBe("pending");
    expect(parseReviewQueueTab("nope")).toBe("pending");
    expect(parseReviewQueuePage(null)).toBe(1);
    expect(parseReviewQueuePage("0")).toBe(1);
  });

  it("builds the linkable pending page-2 URL", () => {
    expect(reviewsQueueHref("pending", 2)).toBe(
      "/admin/reviews?status=pending&page=2",
    );
    expect(reviewsQueueHref("all")).toBe("/admin/reviews?status=all");
  });
});
