// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { publishMock, removeMock, refetchMock } = vi.hoisted(() => ({
  publishMock: vi.fn(),
  removeMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/journal",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("@/features/journal/api/client", () => ({
  JournalApiError: class JournalApiError extends Error {},
  useAdminJournalPosts: () => ({
    data: {
      results: [
        {
          id: 11,
          author_id: 4,
          title: "راهنمای انتخاب",
          slug: "guide",
          excerpt: "خلاصه",
          image_url: null,
          image_alt: null,
          time_to_read: 5,
          total_reads: 12,
          status: "draft",
          is_featured: false,
          published_at: null,
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-01T10:00:00Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 18,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: refetchMock,
  }),
  useUpdateJournalPost: () => ({
    mutateAsync: publishMock,
    isPending: false,
    variables: undefined,
    error: null,
  }),
  useDeleteJournalPost: () => ({
    mutateAsync: removeMock,
    isPending: false,
    variables: undefined,
    error: null,
  }),
}));

import { JournalBoard } from "./journal-board";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  publishMock.mockResolvedValue({ id: 11, status: "published" });
});

describe("JournalBoard", () => {
  it("publishes a draft through the supported status update", async () => {
    render(<JournalBoard canWrite />);
    fireEvent.click(screen.getByRole("button", { name: "انتشار" }));
    await waitFor(() =>
      expect(publishMock).toHaveBeenCalledWith({
        id: 11,
        input: { status: "published" },
      }),
    );
  });

  it("hides write actions from read-only presentation", () => {
    render(<JournalBoard canWrite={false} />);
    expect(
      screen.queryByRole("link", { name: /نوشتهٔ جدید/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "انتشار" })).not.toBeInTheDocument();
  });
});
