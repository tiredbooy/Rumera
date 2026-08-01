import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductDetail } from "@/features/catalog/products/types";
import type { JournalDetail } from "@/features/journal/types";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  getProduct: vi.fn(),
  listRelated: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
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
vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));
vi.mock("@/features/catalog/products/api/public", () => ({
  getProductById: mocks.getProduct,
}));
vi.mock("@/features/journal/api/server", () => ({
  getJournalPostBySlug: mocks.getPost,
  listRelatedJournalPosts: mocks.listRelated,
}));
vi.mock("./article-product-card", () => ({
  ArticleProductCard: ({ product }: { product: ProductDetail }) => (
    <article data-product={product.id}>{product.title}</article>
  ),
}));
vi.mock("./journal-card", () => ({
  JournalCard: () => <article data-related-card="true" />,
}));
vi.mock("./share-links", () => ({
  ShareLinks: () => <div data-share-links />,
}));

import { JournalDetailView } from "./journal-detail-view";

const post: JournalDetail = {
  id: 1,
  author_id: 2,
  title: "راهنمای کامل",
  slug: "guide",
  excerpt: "خلاصه",
  image_url: null,
  image_alt: null,
  time_to_read: 5,
  total_reads: 10,
  status: "published",
  is_featured: false,
  published_at: "2026-07-20T10:00:00Z",
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-21T10:00:00Z",
  content: "<h1>عنوان داخلی</h1><p>متن مقاله</p>",
  meta_title: null,
  meta_description: null,
  categories: [],
  product_ids: [7, 7, 8],
  tag_ids: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPost.mockResolvedValue(post);
  mocks.listRelated.mockRejectedValue(new Error("optional rail unavailable"));
  mocks.getProduct.mockImplementation(async (id: number) => {
    if (id === 8) throw new Error("temporary product failure");
    return {
      id,
      title: "محصول مرتبط",
      slug: "related",
      is_active: true,
      variants: [],
    } satisfies ProductDetail;
  });
});

describe("JournalDetailView", () => {
  it("keeps the article available when optional products or related posts fail", async () => {
    const markup = renderToStaticMarkup(
      await JournalDetailView({ params: Promise.resolve({ slug: "guide" }) }),
    );

    expect(mocks.getProduct).toHaveBeenCalledTimes(2);
    expect(markup).toContain(
      '<article aria-labelledby="journal-article-title"',
    );
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain("<h2>عنوان داخلی</h2>");
    expect(markup).toContain('data-product="7"');
    expect(markup).not.toContain("data-related-card");
    expect(markup).toContain("نوشته‌های پیشنهادی موقتاً در دسترس نیستند");
    expect(markup).toContain("اطلاعات برخی محصولات معرفی‌شده کامل دریافت نشد");
    expect(markup).toContain('"@type":"BlogPosting"');
  });

  it("shows a truthful linked-product state when none can be rendered", async () => {
    mocks.getProduct.mockRejectedValue(new Error("unavailable"));
    const markup = renderToStaticMarkup(
      await JournalDetailView({ params: Promise.resolve({ slug: "guide" }) }),
    );
    expect(markup).toContain(
      "دریافت محصولات معرفی‌شده موقتاً کامل نشد",
    );
  });

  it("distinguishes missing linked products from request failures", async () => {
    mocks.getProduct.mockResolvedValue(null);
    const markup = renderToStaticMarkup(
      await JournalDetailView({ params: Promise.resolve({ slug: "guide" }) }),
    );
    expect(markup).toContain(
      "محصولات معرفی‌شده در این نوشته هم‌اکنون در فروشگاه در دسترس نیستند",
    );
  });

  it("uses the route not-found boundary for a missing post", async () => {
    mocks.getPost.mockResolvedValue(null);
    await expect(
      JournalDetailView({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow("not-found");
  });
});
