// types/heroSlide.ts

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type HeroTheme = "light" | "dark";

// ------------------------------------------------
// Response type (same as DB model, exposed via API)
// ------------------------------------------------

export interface HeroSlideResponse {
  id: number;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  badge?: string | null;

  image_url: string;
  mobile_image_url?: string | null;
  image_alt?: string | null;

  cta_label?: string | null;
  cta_href?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_href?: string | null;

  theme: HeroTheme; // "light" or "dark"
  sort_order: number;
  is_active: boolean;

  starts_at?: string | null; // ISO datetime
  ends_at?: string | null; // ISO datetime

  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface HeroSlideReq {
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  badge?: string | null;

  image_url: string;
  mobile_image_url?: string | null;
  image_alt?: string | null;

  cta_label?: string | null;
  cta_href?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_href?: string | null;

  theme?: HeroTheme; // defaults to "light" if not provided
  sort_order?: number | null;
  is_active?: boolean;

  starts_at?: string | null;
  ends_at?: string | null;
}

export interface HeroSlideUpdateReq {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;

  image_url?: string | null;
  mobile_image_url?: string | null;
  image_alt?: string | null;

  cta_label?: string | null;
  cta_href?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_href?: string | null;

  theme?: HeroTheme | null;
  sort_order?: number | null;
  is_active?: boolean;

  starts_at?: string | null;
  ends_at?: string | null;
}
