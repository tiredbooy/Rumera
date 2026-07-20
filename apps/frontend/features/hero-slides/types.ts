export type HeroTheme = "light" | "dark";

export interface PublicHeroSlide {
  id: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image_url: string;
  mobile_image_url: string | null;
  image_alt: string | null;
  cta_label: string | null;
  cta_href: string | null;
  secondary_cta_label: string | null;
  secondary_cta_href: string | null;
  theme: HeroTheme;
  sort_order: number;
}

/** Full admin projection returned by list, detail, create, and update routes. */
export interface AdminHeroSlide extends Omit<PublicHeroSlide, "image_url"> {
  image_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHeroSlideInput {
  eyebrow?: string | null;
  title: string;
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
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

/** Null pointer fields currently have omission semantics in the Go repository. */
export interface UpdateHeroSlideInput {
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
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
}
