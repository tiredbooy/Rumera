import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalDetail } from "@/features/journal/types";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  listSlugs: vi.fn(),
  view: vi.fn(() => null),
}));

vi.mock("@/features/journal/api/server", () => ({
  getJournalPostBySlug: mocks.getPost,
  listJournalSlugs: mocks.listSlugs,
}));
vi.mock("@/features/journal/components/journal-detail-view", () => ({
  JournalDetailView: mocks.view,
}));

import { generateMetadata, generateStaticParams } from "./page";

const post: JournalDetail = {
  id: 1,
  author_id: 4,
  title: "راهنمای سرو",
  slug: "guide",
  excerpt: "خلاصه",
  image_url: "/media/journal/1/cover.webp",
  image_alt: "کاور",
  time_to_read: 5,
  total_reads: 3,
  status: "published",
  is_featured: false,
  published_at: "2026-07-20T10:00:00Z",
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-21T10:00:00Z",
  content: "<p>متن</p>",
  meta_title: "  عنوان سئو  ",
  meta_description: "  توضیح سئو  ",
  categories: [
    {
      id: 2,
      name: "راهنما",
      description: null,
      slug: "guide",
      parent_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  product_ids: [],
  tag_ids: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPost.mockResolvedValue(post);
  mocks.listSlugs.mockResolvedValue(["one", "two"]);
});

describe("journal detail route", () => {
  it("uses trimmed SEO fields and backend article dates", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: post.slug }),
    });
    expect(metadata.title).toBe("عنوان سئو");
    expect(metadata.description).toBe("توضیح سئو");
    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/journal/guide",
    );
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      section: "راهنما",
    });
  });

  it("keeps a missing post noindexed at the requested encoded path", async () => {
    mocks.getPost.mockResolvedValue(null);
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "گم شده / ?" }),
    });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe(
      `http://localhost:3000/journal/${encodeURIComponent("گم شده / ?")}`,
    );
  });

  it("discovers every slug returned by the paginated API helper", async () => {
    await expect(generateStaticParams()).resolves.toEqual([
      { slug: "one" },
      { slug: "two" },
    ]);
  });
});
