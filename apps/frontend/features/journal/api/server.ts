import "server-only"

import { isApiNotFoundError } from "@/lib/api/error-semantics"
import { publicRequest } from "@/lib/api/public"
import type { Paginated } from "@/lib/api/types"

import type {
  JournalCategory,
  JournalDetail,
  JournalListItem,
  JournalListQuery,
  JournalPage,
} from "../types"

const PUBLIC_CACHE = {
  cache: "force-cache" as const,
  next: { revalidate: 3600 },
}

export async function listJournalPage(
  options: Pick<JournalListQuery, "page" | "limit"> = {},
): Promise<JournalPage> {
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(100, Math.max(1, options.limit ?? 24))
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const result = await publicRequest<Paginated<JournalListItem>>(
    `/blogs?${query.toString()}`,
    PUBLIC_CACHE,
  )

  return {
    posts: result.results,
    pagination: result.pagination,
  }
}

export async function listJournalPosts(limit = 24): Promise<JournalListItem[]> {
  return (await listJournalPage({ limit })).posts
}

export async function getJournalPostBySlug(
  slug: string,
): Promise<JournalDetail | null> {
  try {
    return await publicRequest<JournalDetail>(
      `/blogs/${encodeURIComponent(slug)}`,
      PUBLIC_CACHE,
    )
  } catch (error) {
    if (isApiNotFoundError(error)) return null
    throw error
  }
}

export async function listJournalCategories(): Promise<JournalCategory[]> {
  return publicRequest<JournalCategory[]>("/blog-categories", PUBLIC_CACHE)
}

export async function listRelatedJournalPosts(
  excludeSlug: string,
  limit = 3,
): Promise<JournalListItem[]> {
  const { posts } = await listJournalPage({ limit: limit + 4 })
  return posts.filter((post) => post.slug !== excludeSlug).slice(0, limit)
}

export async function listJournalSlugs(): Promise<string[]> {
  const { posts } = await listJournalPage({ limit: 100 })
  return posts.map((post) => post.slug)
}
