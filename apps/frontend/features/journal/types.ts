import type { Pagination, PaginationQuery } from "@/lib/api/types";

export type JournalStatus = "draft" | "published" | "archived";

/** Category projection returned by public and admin journal endpoints. */
export interface JournalCategory {
  id: number;
  name: string;
  description: string | null;
  slug: string | null;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight public journal projection used by lists and cards. */
export interface JournalListItem {
  id: number;
  author_id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  time_to_read: number;
  total_reads: number;
  status: JournalStatus;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Full projection shared by public-by-slug and admin-by-id reads. */
export interface JournalDetail extends JournalListItem {
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  categories: JournalCategory[];
  product_ids: number[];
  tag_ids: number[];
}

export interface CreateJournalPostInput {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string | null;
  image_url?: string | null;
  time_to_read?: number;
  status?: JournalStatus;
  is_featured?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  published_at?: string | null;
  category_ids?: number[];
  product_ids?: number[];
  tag_ids?: number[];
}

export interface UpdateJournalPostInput {
  title?: string | null;
  slug?: string | null;
  content?: string | null;
  excerpt?: string | null;
  image_url?: string | null;
  time_to_read?: number | null;
  status?: JournalStatus | null;
  is_featured?: boolean | null;
  meta_title?: string | null;
  meta_description?: string | null;
  published_at?: string | null;
  category_ids?: number[] | null;
  product_ids?: number[] | null;
  tag_ids?: number[] | null;
}

export interface CreateJournalCategoryInput {
  name: string;
  description?: string | null;
  slug?: string | null;
  parent_id?: number | null;
}

// The backend currently uses the same required-name payload for both mutations.
export type UpdateJournalCategoryInput = CreateJournalCategoryInput;

export type JournalSortField =
  | "published_at"
  | "created_at"
  | "updated_at"
  | "title"
  | "total_reads";

export type JournalSortDirection = "asc" | "desc";

/** Effective query contract for the published-only public journal list. */
export interface JournalListQuery extends PaginationQuery {
  search?: string;
  is_featured?: boolean;
  category_id?: number;
  sortBy?: JournalSortField;
  orderBy?: JournalSortDirection;
}

export interface JournalPage {
  posts: JournalListItem[];
  pagination: Pagination;
}
