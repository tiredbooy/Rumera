// types/brand.ts
import { BaseFilter } from "@/lib/types/filters";

// ─────────────────────────────────────────────
// Core Brand
// ─────────────────────────────────────────────

export interface Brand {
  id: number;
  title: string;
  country?: string | null;
  founded_year?: number | null;
  image_url?: string | null;
  description?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string;
}

// ─────────────────────────────────────────────
// Request payloads
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Filters (extends BaseFilter)
// ─────────────────────────────────────────────

export interface BrandFilter extends BaseFilter {
  country?: string;
  founded_from?: number;
  founded_to?: number;
}
