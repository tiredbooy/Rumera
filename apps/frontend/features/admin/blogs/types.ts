// types/blog.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type BlogStatus = "draft" | "published" | "archived";

// ------------------------------------------------
// Response types (categories)
// ------------------------------------------------

export interface BlogCategoryResponse {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
  parent_id?: number | null;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ------------------------------------------------
// Response types (blog posts)
// ------------------------------------------------

// Base blog fields (shared between list and detail)
export interface BlogResponse {
  id: number;
  author_id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  image_url?: string | null;
  time_to_read: number; // minutes
  total_reads: number;
  status: BlogStatus;
  is_featured: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  published_at?: string | null; // ISO datetime
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// Lightweight blog list item (no full content)
export interface BlogListItem {
  id: number;
  author_id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  image_url?: string | null;
  time_to_read: number;
  total_reads: number;
  status: BlogStatus;
  is_featured: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Full detail response (includes relations)
export interface BlogDetailResponse extends BlogResponse {
  categories: BlogCategoryResponse[];
  product_ids: number[];
  tag_ids: number[];
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface BlogCategoryReq {
  name: string;
  description?: string | null;
  slug?: string | null;
  parent_id?: number | null;
}

export interface BlogReq {
  author_id: number;
  title: string;
  slug?: string;
  content: string;
  excerpt?: string | null;
  image_url?: string | null;
  time_to_read?: number; // default may be set
  status?: BlogStatus;
  is_featured?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  published_at?: string | null; // ISO datetime
  category_ids?: number[];
  product_ids?: number[];
  tag_ids?: number[];
}

export interface BlogUpdateReq {
  title?: string | null;
  slug?: string | null;
  content?: string | null;
  excerpt?: string | null;
  image_url?: string | null;
  time_to_read?: number | null;
  status?: BlogStatus | null;
  is_featured?: boolean | null;
  meta_title?: string | null;
  meta_description?: string | null;
  published_at?: string | null; // ISO datetime
  category_ids?: number[];
  product_ids?: number[];
  tag_ids?: number[];
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface BlogFilter extends BaseFilter {
  status?: BlogStatus;
  is_featured?: boolean;
  category_id?: number; // filter posts by category
}
