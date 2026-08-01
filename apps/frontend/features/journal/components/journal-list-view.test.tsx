import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalListItem } from "@/features/journal/types";
import type { Pagination } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  listFeatured: vi.fn(),
  listPage: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/journal/api/server", () => ({
  listFeaturedJournalPosts: mocks.listFeatured,
  listJournalPage: mocks.listPage,
}));
vi.mock("./journal-explorer", () => ({
  JournalExplorer: () => <div data-journal-filters />,
}));
vi.mock("./journal-card", () => ({
  JournalCard: ({
    post,
    featured,
    featuredLabel,
  }: {
    post: JournalListItem;
    featured?: boolean;
    featuredLabel?: string;
  }) => (
    <article data-card={post.id} data-featured={featured || undefined}>
      {featuredLabel}
      {post.title}
    </article>
  ),
}));

import { JournalListView } from "./journal-list-view";

function post(
  id: number,
  overrides: Partial<JournalListItem> = {},
): JournalListItem {
  return {
    id,
    author_id: 1,
    title: `نوشته ${id}`,
    slug: `post-${id}`,
    excerpt: null,
    image_url: null,
    image_alt: null,
    time_to_read: 4,
    total_reads: 0,
    status: "published",
    is_featured: false,
    published_at: "2026-07-20T10:00:00Z",
    created_at: "2026-07-19T10:00:00Z",
    updated_at: "2026-07-20T10:00:00Z",
    ...overrides,
  };
}

function pagination(page = 1, totalItems = 2, totalPages = 1): Pagination {
  return {
    page,
    limit: 24,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listFeatured.mockResolvedValue([]);
  mocks.listPage.mockResolvedValue({
    posts: [post(1), post(2)],
    pagination: pagination(),
  });
});

describe("JournalListView", () => {
  it("renders the global editorial lead and excludes it from stable pagination", async () => {
    const featured = post(9, { is_featured: true, title: "منتخب" });
    mocks.listFeatured.mockResolvedValue([featured]);
    mocks.listPage.mockResolvedValue({
      posts: [post(1), post(2)],
      pagination: pagination(1, 4, 2),
    });

    const markup = renderToStaticMarkup(
      await JournalListView({ searchParams: Promise.resolve({}) }),
    );

    expect(mocks.listPage).toHaveBeenCalledWith({
      page: 1,
      limit: 24,
      search: undefined,
      sortBy: "published_at",
      orderBy: "desc",
      exclude_id: 9,
    });
    expect(markup).toContain("نوشتهٔ منتخب");
    expect(markup).toContain('data-featured="true"');
    expect(markup).toContain("۵ نوشته");
    expect(markup).toContain("#journal-results-title");
  });

  it("redirects malformed and out-of-range pages to canonical URLs", async () => {
    await expect(
      JournalListView({ searchParams: Promise.resolve({ page: "1.5" }) }),
    ).rejects.toThrow("redirect:/journal");
    expect(mocks.listPage).not.toHaveBeenCalled();

    mocks.listPage.mockResolvedValue({
      posts: [],
      pagination: pagination(8, 30, 2),
    });
    await expect(
      JournalListView({ searchParams: Promise.resolve({ page: "8" }) }),
    ).rejects.toThrow("redirect:/journal?page=2");
  });

  it("uses server-backed search/sort and a distinct no-match state", async () => {
    mocks.listPage.mockResolvedValue({
      posts: [],
      pagination: pagination(1, 0, 1),
    });
    const markup = renderToStaticMarkup(
      await JournalListView({
        searchParams: Promise.resolve({ q: "مالت", sort: "popular" }),
      }),
    );

    expect(mocks.listFeatured).not.toHaveBeenCalled();
    expect(mocks.listPage).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "مالت",
        sortBy: "total_reads",
        orderBy: "desc",
      }),
    );
    expect(markup).toContain("نوشته‌ای پیدا نشد");
    expect(markup).toContain('href="/journal"');
  });
});
