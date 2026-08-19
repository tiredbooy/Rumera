import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import {
  getJournalPostBySlug,
  listJournalSlugs,
} from "@/features/journal/api/server";
import { JournalDetailView } from "@/features/journal/components/journal-detail-view";
import { publicRequest } from "@/lib/api/public";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { JOURNAL_CACHE_TAG } from "@/lib/cache-tags";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * A slug retired by a rename keeps its inbound links: the backend holds a
 * redirect record keyed on the old slug. Reached only after the live lookup
 * missed, so a live slug always outranks a record, and a lookup failure degrades
 * to the normal 404 rather than a 500.
 */
async function renamedJournalSlug(slug: string): Promise<string | null> {
  try {
    const { slug: target } = await publicRequest<{ slug: string }>(
      `/blogs/${encodeURIComponent(slug)}/redirect`,
      {
        cache: "force-cache",
        next: { revalidate: 3600, tags: [JOURNAL_CACHE_TAG] },
      },
    );
    return target?.trim() || null;
  } catch {
    return null;
  }
}

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
  // CE-10: the dedicated social crop wins; the cover is the fallback.
  const socialImage = post.og_image_url ?? post.image_url ?? null;
  return buildMetadata({
    title: post.meta_title?.trim() || post.title,
    description:
      post.meta_description?.trim() || post.excerpt?.trim() || undefined,
    path: `/journal/${encodeURIComponent(post.slug)}`,
    type: "article",
    // undefined, not []: an empty array suppressed the site-wide default too,
    // so a post with neither crop nor cover lost og:image entirely.
    images: socialImage ? [socialImage] : undefined,
    article: {
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      section: categories[0],
      tags: categories,
    },
  });
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The detail fetch is memoised, so the happy path costs nothing extra here.
  // 308 rather than 301: it is the only permanent redirect a server component
  // can issue, and for a GET page crawlers treat the two identically — with the
  // bonus that 308 cannot silently turn a request into a GET.
  if (!(await getJournalPostBySlug(slug))) {
    const target = await renamedJournalSlug(slug);
    if (target && target !== slug) {
      permanentRedirect(`/journal/${encodeURIComponent(target)}`);
    }
  }
  return <JournalDetailView params={params} />;
}
