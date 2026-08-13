package recommendations

import "time"

// InteractionType is the kind of implicit-feedback signal a user generates.
type InteractionType string

const (
	InteractionView        InteractionType = "view"
	InteractionAddToCart   InteractionType = "add_to_cart"
	InteractionPurchase    InteractionType = "purchase"
	InteractionWishlist    InteractionType = "wishlist"
	InteractionReview      InteractionType = "review"
	InteractionRecipeView  InteractionType = "recipe_view"
	InteractionSearchClick InteractionType = "search_click"
)

// DefaultInteractionWeights encode how strong each signal is. Tuned in code (not
// the DB) so weighting can evolve without a migration. A purchase is worth far
// more than a view.
var DefaultInteractionWeights = map[InteractionType]float64{
	InteractionView:        1.0,
	InteractionSearchClick: 1.5,
	InteractionRecipeView:  2.0,
	InteractionAddToCart:   4.0,
	InteractionWishlist:    5.0,
	InteractionReview:      6.0,
	InteractionPurchase:    10.0,
}

// WeightFor returns the configured weight for a signal, defaulting to 1.0.
func (t InteractionType) WeightFor() float64 {
	if w, ok := DefaultInteractionWeights[t]; ok {
		return w
	}
	return 1.0
}

func (t InteractionType) Valid() bool {
	_, ok := DefaultInteractionWeights[t]
	return ok
}

// ── Entities ──────────────────────────────────────────────────────────────────

type UserProductInteraction struct {
	ID              int64           `json:"id"`
	UserID          int64           `json:"user_id"`
	ProductID       int64           `json:"product_id"`
	InteractionType InteractionType `json:"interaction_type"`
	Weight          float64         `json:"weight"`
	Source          *string         `json:"source"`
	Metadata        map[string]any  `json:"metadata"`
	CreatedAt       time.Time       `json:"created_at"`
}

// AffinityScore is one ranked preference entry inside a user profile (a category,
// brand, or tag id with its accumulated score).
type AffinityScore struct {
	ID    int64   `json:"id"`
	Score float64 `json:"score"`
}

type UserRecommendationProfile struct {
	UserID            int64           `json:"user_id"`
	TopCategories     []AffinityScore `json:"top_categories"`
	TopBrands         []AffinityScore `json:"top_brands"`
	TopTags           []AffinityScore `json:"top_tags"`
	PreferredPriceMin *float64        `json:"preferred_price_min"`
	PreferredPriceMax *float64        `json:"preferred_price_max"`
	EngagementScore   float64         `json:"engagement_score"`
	LastInteractionAt *time.Time      `json:"last_interaction_at"`
	ComputedAt        time.Time       `json:"computed_at"`
}

// HasSignal reports whether the profile carries enough data to personalise.
func (p *UserRecommendationProfile) HasSignal() bool {
	return p != nil && (len(p.TopCategories) > 0 || len(p.TopBrands) > 0 || len(p.TopTags) > 0)
}

// ── Requests ──────────────────────────────────────────────────────────────────

type InteractionReq struct {
	ProductID       int64           `json:"product_id"       validate:"required,min=1"`
	InteractionType InteractionType `json:"interaction_type" validate:"required,oneof=view add_to_cart purchase wishlist review recipe_view search_click"`
	Source          *string         `json:"source" validate:"omitempty,max=40"`
	Metadata        map[string]any  `json:"metadata"`
}

// RecommendationQuery is the shared tuning for any recommendation read.
type RecommendationQuery struct {
	Limit      int    `query:"limit"`
	CategoryID *int64 `query:"category_id"`
	WindowDays int    `query:"window_days"`
}

// RecommendationOpsStats is a read-only operator summary for admin dashboards.
// Counts come from first-party interaction rows and stored user profiles.
type RecommendationOpsStats struct {
	WindowDays           int            `json:"window_days"`
	InteractionTotal     int64          `json:"interaction_total"`
	UniqueUsers          int64          `json:"unique_users"`
	ProfilesTotal        int64          `json:"profiles_total"`
	InteractionsByType   map[string]int64 `json:"interactions_by_type"`
	GeneratedAt          time.Time      `json:"generated_at"`
}

func (q *RecommendationQuery) Defaults() {
	if q.Limit <= 0 || q.Limit > 50 {
		q.Limit = 12
	}
	if q.WindowDays <= 0 || q.WindowDays > 365 {
		q.WindowDays = 30
	}
}

// ── Responses ─────────────────────────────────────────────────────────────────

// RecommendationItem is a product card enriched with a relevance score and a
// machine-readable reason, so the frontend can render "Because you bought X".
type RecommendationItem struct {
	ProductID  int64   `json:"product_id"`
	Title      string  `json:"title"`
	Slug       *string `json:"slug,omitempty"`
	BrandID    *int64  `json:"brand_id,omitempty"`
	Brand      *string `json:"brand,omitempty"`
	CategoryID *int64  `json:"category_id,omitempty"`
	MinPrice   float64 `json:"min_price"`
	MaxPrice   float64 `json:"max_price"`
	ImageURL   *string `json:"image_url,omitempty"`
	Score      float64 `json:"score"`
	Reason     string  `json:"reason,omitempty"`
}
