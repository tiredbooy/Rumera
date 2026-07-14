import type { PaginationQuery } from "@/lib/api/types";

export interface Tag {
  id: number;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/** Reduced tag projection embedded in product responses. */
export interface ProductTag {
  id: number;
  title: string;
}

export interface CreateTagInput {
  title: string;
  description?: string | null;
}

export interface UpdateTagInput {
  title?: string | null;
  description?: string | null;
}

// Used by AttachProductTags / SyncProductTags / DetachProductTags
export interface ProductTagsInput {
  tag_ids: number[];
}

export type TagSortField = "created_at" | "title";
export type TagSortDirection = "asc" | "desc";

export interface TagListQuery extends PaginationQuery {
  sortBy?: TagSortField;
  orderBy?: TagSortDirection;
  search?: string;
}
