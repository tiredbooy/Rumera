import "server-only";

import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { publicRequest } from "@/lib/api/public";
import { buildQuery } from "@/lib/api/qs";
import type { Paginated } from "@/lib/api/types";
import { JOURNAL_CACHE_TAG } from "@/lib/cache-tags";

import type {
  JournalCategory,
  JournalDetail,
  JournalListItem,
  JournalListQuery,
  JournalPage,
} from "../types";

const PUBLIC_CACHE = {
  cache: "force-cache" as const,
  next: { revalidate: 3600, tags: [JOURNAL_CACHE_TAG] },
};

export async function listJournalPage(
  options: JournalListQuery = {},
): Promise<JournalPage> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 24));
  const result = await publicRequest<Paginated<JournalListItem>>(
    `/blogs${buildQuery({ ...options, page, limit })}`,
    PUBLIC_CACHE,
  );

  return {
    posts: result.results,
    pagination: result.pagination,
  };
}

export async function listJournalPosts(limit = 24): Promise<JournalListItem[]> {
  return (await listJournalPage({ limit })).posts;
}

export async function listFeaturedJournalPosts(
  limit = 1,
): Promise<JournalListItem[]> {
  return (
    await listJournalPage({
      is_featured: true,
      limit,
      sortBy: "published_at",
      orderBy: "desc",
    })
  ).posts;
}

export async function getJournalPostBySlug(
  slug: string,
): Promise<JournalDetail | null> {
  try {
    return await publicRequest<JournalDetail>(
      `/blogs/${encodeURIComponent(slug)}`,
      PUBLIC_CACHE,
    );
  } catch (error) {
    if (isApiNotFoundError(error)) return null;
    throw error;
  }
}

export async function listJournalCategories(): Promise<JournalCategory[]> {
  return publicRequest<JournalCategory[]>("/blog-categories", PUBLIC_CACHE);
}

export async function listRelatedJournalPosts(
  post: Pick<JournalDetail, "slug" | "categories">,
  limit = 3,
): Promise<JournalListItem[]> {
  const categoryID = post.categories[0]?.id;
  const primary = await listJournalPage({
    ...(categoryID ? { category_id: categoryID } : {}),
    limit: limit + 1,
  });
  const related = primary.posts.filter((item) => item.slug !== post.slug);
  if (related.length >= limit || categoryID === undefined) {
    return related.slice(0, limit);
  }

  const fallback = await listJournalPage({ limit: limit + 4 });
  const seen = new Set(related.map((item) => item.id));
  return [
    ...related,
    ...fallback.posts.filter(
      (item) => item.slug !== post.slug && !seen.has(item.id),
    ),
  ].slice(0, limit);
}

export async function listJournalSlugs(): Promise<string[]> {
  return (await listAllJournalPosts()).map((post) => post.slug);
}

export async function listAllJournalPosts(): Promise<JournalListItem[]> {
  const posts: JournalListItem[] = [];
  let page = 1;
  while (true) {
    const result = await listJournalPage({ page, limit: 100 });
    posts.push(...result.posts);
    if (!result.pagination.has_next || result.posts.length === 0) return posts;
    page += 1;
  }
}
