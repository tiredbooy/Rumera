// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAdminReviews: vi.fn(),
  useModerateReview: vi.fn(),
}));

vi.mock("@/features/reviews/hooks", () => ({
  useAdminReviews: mocks.useAdminReviews,
  useModerateReview: mocks.useModerateReview,
}));

import { ReviewsQueue } from "./ReviewsQueue";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReviewsQueue failure state", () => {
  it("hides review rows and retries the failed query", () => {
    mocks.useAdminReviews.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    mocks.useModerateReview.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });

    render(<ReviewsQueue canModerate />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "خطا در دریافت دیدگاه‌ها",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
