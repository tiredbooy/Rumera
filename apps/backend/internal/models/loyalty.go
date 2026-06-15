package models

import "time"

// Loyalty tiers, ordered by lifetime points earned.
const (
	TierBronze = "bronze"
	TierSilver = "silver"
	TierGold   = "gold"
	TierCellar = "cellar"
)

// TierFor maps lifetime points to a tier name.
func TierFor(lifetime int) string {
	switch {
	case lifetime >= 20000:
		return TierCellar
	case lifetime >= 5000:
		return TierGold
	case lifetime >= 1000:
		return TierSilver
	default:
		return TierBronze
	}
}

type LoyaltyAccount struct {
	UserID         int64     `db:"user_id"`
	PointsBalance  int       `db:"points_balance"`
	LifetimePoints int       `db:"lifetime_points"`
	Tier           string    `db:"tier"`
	TierSince      time.Time `db:"tier_since"`
	UpdatedAt      time.Time `db:"updated_at"`
}

type LoyaltyTransaction struct {
	ID        int64     `db:"id"`
	UserID    int64     `db:"user_id"`
	Delta     int       `db:"delta"`
	Reason    string    `db:"reason"`
	RefType   string    `db:"ref_type"`
	RefID     string    `db:"ref_id"`
	CreatedAt time.Time `db:"created_at"`
}

// ── Responses ────────────────────────────────────────────────────────────────

type LoyaltyResponse struct {
	PointsBalance  int    `json:"points_balance"`
	LifetimePoints int    `json:"lifetime_points"`
	Tier           string `json:"tier"`
	// NextTier / PointsToNext help the UI draw a progress bar (NextTier empty at top).
	NextTier     string `json:"next_tier,omitempty"`
	PointsToNext int    `json:"points_to_next"`
}

type LoyaltyTransactionResponse struct {
	Delta     int       `json:"delta"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

type RedeemPointsReq struct {
	Points int `json:"points" validate:"required,min=1"`
}
