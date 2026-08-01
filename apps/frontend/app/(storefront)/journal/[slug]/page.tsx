import type { Metadata } from "next";

import {
  getJournalPostBySlug,
  listJournalSlugs,
} from "@/features/journal/api/server";
import { JournalDetailView } from "@/features/journal/components/journal-detail-view";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await listJournalSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error(
      "generateStaticParams: failed to load journal slugs",
      getSafeApiErrorContext(error),
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getJournalPostBySlug(slug);
  if (!post)
    return buildMetadata({
      title: "نوشته یافت نشد",
      path: `/journal/${encodeURIComponent(slug)}`,
      index: false,
    });
  const categories = post.categories.map((category) => category.name);
  return buildMetadata({
    title: post.meta_title?.trim() || post.title,
    description:
      post.meta_description?.trim() || post.excerpt?.trim() || undefined,
    path: `/journal/${encodeURIComponent(post.slug)}`,
    type: "article",
    images: post.image_url ? [post.image_url] : undefined,
    article: {
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      section: categories[0],
      tags: categories,
    },
  });
}

export default function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <JournalDetailView params={params} />;
}
