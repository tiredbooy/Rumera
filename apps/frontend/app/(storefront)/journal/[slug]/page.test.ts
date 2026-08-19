import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalDetail } from "@/features/journal/types";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  listSlugs: vi.fn(),
  view: vi.fn(() => null),
  publicRequest: vi.fn(),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/features/journal/api/server", () => ({
  getJournalPostBySlug: mocks.getPost,
  listJournalSlugs: mocks.listSlugs,
}));
vi.mock("@/features/journal/components/journal-detail-view", () => ({
  JournalDetailView: mocks.view,
}));
vi.mock("@/lib/api/public", () => ({ publicRequest: mocks.publicRequest }));
vi.mock("next/navigation", () => ({
  permanentRedirect: mocks.permanentRedirect,
}));

import JournalPostPage, {
  generateMetadata,
  generateStaticParams,
} from "./page";

const post: JournalDetail = {
  id: 1,
  author_id: 4,
  title: "راهنمای سرو",
  slug: "guide",
  excerpt: "خلاصه",
  image_url: "/media/journal/1/cover.webp",
  image_alt: "کاور",
  og_image_url: null,
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
  mocks.publicRequest.mockRejectedValue(new Error("no redirect record"));
  mocks.permanentRedirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
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

  it("prefers the dedicated OG image over the cover, and falls back to it", async () => {
    // CE-10. The social crop is 1.91:1; the cover is a 4:3 hero.
    const withOG = { ...post, og_image_url: "/media/journal/1/og.webp" };
    mocks.getPost.mockResolvedValue(withOG);
    const shared = await generateMetadata({
      params: Promise.resolve({ slug: post.slug }),
    });
    expect(
      JSON.stringify(shared.openGraph?.images ?? shared.twitter?.images),
    ).toContain("/media/journal/1/og.webp");

    mocks.getPost.mockResolvedValue(post);
    const fallback = await generateMetadata({
      params: Promise.resolve({ slug: post.slug }),
    });
    expect(
      JSON.stringify(fallback.openGraph?.images ?? fallback.twitter?.images),
    ).toContain("/media/journal/1/cover.webp");
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

describe("journal slug redirect record", () => {
  it("permanently redirects a slug retired by a rename", async () => {
    mocks.getPost.mockResolvedValue(null);
    mocks.publicRequest.mockResolvedValue({ slug: "guide" });

    await expect(
      JournalPostPage({ params: Promise.resolve({ slug: "old-guide" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/journal/guide");

    expect(mocks.publicRequest).toHaveBeenCalledWith(
      "/blogs/old-guide/redirect",
      expect.objectContaining({ cache: "force-cache" }),
    );
  });

  it("lets a live slug win over any redirect record", async () => {
    await JournalPostPage({ params: Promise.resolve({ slug: post.slug }) });

    expect(mocks.publicRequest).not.toHaveBeenCalled();
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });

  it("still renders the 404 view when nothing claims the slug", async () => {
    mocks.getPost.mockResolvedValue(null);

    const rendered = await JournalPostPage({
      params: Promise.resolve({ slug: "unknown" }),
    });

    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
    // Falls through to the journal detail view, which is what calls notFound().
    expect(rendered.type).toBe(mocks.view);
  });
});
