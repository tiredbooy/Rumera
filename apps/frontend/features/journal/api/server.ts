import "server-only"

import { publicRequest } from "@/lib/api/public"
import type { Paginated, Pagination } from "@/lib/api/types"

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

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_prev: false,
}

type PartialPaginated<T> = Partial<Paginated<T>>

async function readPublicJournal<T>(path: string): Promise<T | null> {
  try {
    return await publicRequest<T>(path, PUBLIC_CACHE)
  } catch {
    return null
  }
}

export async function listJournalPage(
  options: Pick<JournalListQuery, "page" | "limit"> = {}
): Promise<JournalPage> {
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(100, Math.max(1, options.limit ?? 24))
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  const result = await readPublicJournal<PartialPaginated<JournalListItem>>(
    `/blogs?${query.toString()}`
  )

  return {
    posts: result?.results ?? [],
    pagination: result?.pagination ?? { ...EMPTY_PAGINATION, page, limit },
  }
}

export async function listJournalPosts(limit = 24): Promise<JournalListItem[]> {
  return (await listJournalPage({ limit })).posts
}

export async function getJournalPostBySlug(
  slug: string
): Promise<JournalDetail | null> {
  const post = await readPublicJournal<JournalDetail>(
    `/blogs/${encodeURIComponent(slug)}`
  )
  return post?.id ? post : null
}

export async function listJournalCategories(): Promise<JournalCategory[]> {
  return (await readPublicJournal<JournalCategory[]>("/blog-categories")) ?? []
}

export async function listRelatedJournalPosts(
  excludeSlug: string,
  limit = 3
): Promise<JournalListItem[]> {
  const { posts } = await listJournalPage({ limit: limit + 4 })
  return posts.filter((post) => post.slug !== excludeSlug).slice(0, limit)
}

export async function listJournalSlugs(): Promise<string[]> {
  const { posts } = await listJournalPage({ limit: 100 })
  return posts.map((post) => post.slug)
}
