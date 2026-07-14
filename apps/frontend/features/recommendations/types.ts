export type RecommendationInteractionType =
  | "view"
  | "add_to_cart"
  | "purchase"
  | "wishlist"
  | "review"
  | "recipe_view"
  | "search_click";

export interface RecommendationInteractionInput {
  product_id: number;
  interaction_type: Exclude<
    RecommendationInteractionType,
    "add_to_cart" | "purchase"
  >;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RecommendationQuery {
  limit?: number;
  category_id?: number;
  window_days?: number;
}

export interface RecommendationItem {
  product_id: number;
  title: string;
  slug?: string;
  brand_id?: number;
  brand?: string;
  category_id?: number;
  min_price: number;
  max_price: number;
  image_url?: string;
  score: number;
  reason?: string;
}

export interface RecommendationAffinity {
  id: number;
  score: number;
}

export interface RecommendationProfile {
  user_id: number;
  top_categories: RecommendationAffinity[];
  top_brands: RecommendationAffinity[];
  top_tags: RecommendationAffinity[];
  preferred_price_min: number | null;
  preferred_price_max: number | null;
  engagement_score: number;
  last_interaction_at: string | null;
  computed_at: string;
}
