// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  listQuery: vi.fn(),
  remove: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/tags",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/tags/api", () => ({
  TagApiError: class TagApiError extends Error {},
  useAdminTags: (query: unknown) => {
    mocks.listQuery(query);
    return mocks.query();
  },
  useDeleteTag: () => ({
    mutateAsync: mocks.remove,
    isPending: false,
    variables: undefined,
    error: null,
  }),
}));

import { TagsBoard } from "./tags-board";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
  mocks.remove.mockResolvedValue(undefined);
});

describe("TagsBoard", () => {
  it("shows a retryable error without plausible tag cards", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      data: undefined,
      error: new Error("offline"),
      refetch: mocks.refetch,
    });

    render(<TagsBoard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "بارگذاری برچسب‌ها ناموفق بود",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("keeps retained cards visible after a failed background refresh", () => {
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      error: new Error("offline"),
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 7,
            title: "هدیه",
            slug: "gift",
            created_at: "2026-07-18T00:00:00Z",
            updated_at: "2026-07-19T00:00:00Z",
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });

    render(<TagsBoard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد",
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "هدیه" })).toBeInTheDocument();
  });

  it("queries the exact page and exposes keyboard-operable edit/delete controls", async () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams("page=2&q=gift"));
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [
          {
            id: 7,
            title: "هدیه",
            slug: "gift",
            description: "برای هدیه",
            created_at: "2026-07-18T00:00:00Z",
            updated_at: "2026-07-19T00:00:00Z",
          },
        ],
        pagination: {
          page: 2,
          limit: 20,
          total_items: 21,
          total_pages: 2,
          has_next: false,
          has_prev: true,
        },
      },
    });

    render(<TagsBoard />);

    expect(mocks.listQuery).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: "gift",
      sortBy: "updated_at",
      orderBy: "desc",
    });
    expect(screen.getByRole("link", { name: "هدیه" })).toHaveAttribute(
      "href",
      "/admin/tags/7",
    );
    fireEvent.click(screen.getByRole("button", { name: "حذف هدیه" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف برچسب" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(7));
  });

  it("distinguishes an empty catalogue from an empty search", () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams("q=missing"));
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
      data: {
        results: [],
        pagination: {
          page: 1,
          limit: 20,
          total_items: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    });

    render(<TagsBoard />);

    expect(
      screen.getByText("برچسبی با این جستجو پیدا نشد"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "ساخت اولین برچسب" }),
    ).not.toBeInTheDocument();
  });
});
