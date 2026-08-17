// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRecipeListItem } from "@/features/recipes/types";
import type { Paginated } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/recipes",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/features/recipes/api/client", () => ({
  listAdminRecipes: (...args: unknown[]) => mocks.list(...args),
}));

vi.mock("@/components/optimized-image", () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { RecipesBoard } from "./RecipeBoard";

const recipe: AdminRecipeListItem = {
  id: 11,
  title: "موهیتو",
  slug: "mojito",
  excerpt: null,
  difficulty: "easy",
  total_time_minutes: 8,
  servings: 1,
  image_url: null,
  image_alt: null,
  cocktail_type: null,
  is_featured: false,
  view_count: 4,
  published_at: null,
  status: "published",
  created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-19T00:00:00Z",
};

function pageOf(
  results: AdminRecipeListItem[],
  pagination: Partial<Paginated<AdminRecipeListItem>["pagination"]> = {},
): Paginated<AdminRecipeListItem> {
  return {
    results,
    pagination: {
      page: 1,
      limit: 18,
      total_items: results.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
      ...pagination,
    },
  };
}

function renderBoard(canWrite = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RecipesBoard canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams.mockReturnValue(new URLSearchParams());
  mocks.list.mockResolvedValue(pageOf([recipe]));
});

describe("RecipesBoard", () => {
  it("queries page, search, and status from the URL", async () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("page=2&q=mojito&status=draft"),
    );
    mocks.list.mockResolvedValue(
      pageOf([recipe], {
        page: 2,
        total_items: 19,
        total_pages: 2,
        has_prev: true,
      }),
    );

    renderBoard();

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith({
        page: 2,
        limit: 18,
        search: "mojito",
        status: "draft",
        sortBy: "created_at",
        orderBy: "desc",
      }),
    );
    expect(await screen.findByText("موهیتو")).toBeInTheDocument();
  });

  it("ignores junk page and unknown status", async () => {
    mocks.searchParams.mockReturnValue(
      new URLSearchParams("page=2junk&status=scheduled"),
    );

    renderBoard();

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith({
        page: 1,
        limit: 18,
        search: undefined,
        status: undefined,
        sortBy: "created_at",
        orderBy: "desc",
      }),
    );
  });

  it("labels a future published_at as scheduled, not live", async () => {
    mocks.list.mockResolvedValue(
      pageOf([
        {
          ...recipe,
          published_at: "2099-01-01T09:00:00Z",
        },
      ]),
    );

    renderBoard();

    expect(await screen.findByText("زمان‌بندی‌شده")).toBeInTheDocument();
    expect(screen.queryByText("منتشرشده")).not.toBeInTheDocument();
  });

  it("distinguishes an empty catalogue from an empty search", async () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams("q=missing"));
    mocks.list.mockResolvedValue(pageOf([]));

    renderBoard();

    expect(
      await screen.findByText("دستوری با این فیلتر پیدا نشد"),
    ).toBeInTheDocument();
    // An empty *search* must not answer with “create one”. The page-level
    // primary action in the AdminPage header is a separate, always-on affordance.
    expect(
      screen.queryByRole("link", { name: /ساخت اولین دستور/ }),
    ).not.toBeInTheDocument();
  });

  it("pages through the URL instead of stopping at sixty items", async () => {
    mocks.list.mockResolvedValue(
      pageOf([recipe], {
        page: 1,
        total_items: 40,
        total_pages: 3,
        has_next: true,
      }),
    );

    renderBoard();

    expect(await screen.findByLabelText("صفحه‌بندی دستورها")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "صفحهٔ بعدی" }));
    expect(mocks.push).toHaveBeenCalledWith("/admin/recipes?page=2");
  });

  it("shows a retryable error without plausible recipe cards", async () => {
    mocks.list.mockRejectedValue(new Error("offline"));

    renderBoard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "بارگذاری دستورها ناموفق بود",
    );
    expect(screen.queryByText("موهیتو")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تلاش دوباره/ }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  });
});
