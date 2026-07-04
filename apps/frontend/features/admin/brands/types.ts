// types/brand.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Response type (matches JSON tags)
// ------------------------------------------------

export interface BrandResponse {
  id: number;
  title: string;
  country?: string | null;
  founded_year?: number | null;
  image_url?: string | null;
  description?: string | null;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface CreateBrandReq {
  title: string;
  country?: string | null;
  founded_year?: number | null;
  image_url?: string | null;
  description?: string | null;
}

export interface UpdateBrandReq {
  title?: string | null;
  country?: string | null;
  founded_year?: number | null;
  image_url?: string | null;
  description?: string | null;
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface BrandFilter extends BaseFilter {
  country?: string;
  founded_from?: number; // year (int)
  founded_to?: number; // year (int)
}
