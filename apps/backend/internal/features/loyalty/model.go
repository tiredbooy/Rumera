package loyalty

import "time"

type LoyaltyTier string

// Loyalty tiers, ordered by lifetime points earned.
const (
	TierBronze LoyaltyTier = "bronze"
	TierSilver LoyaltyTier = "silver"
	TierGold   LoyaltyTier = "gold"
	TierCellar LoyaltyTier = "cellar"
)

// TierFor maps lifetime points to a tier name.
func TierFor(lifetime int) LoyaltyTier {
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

type LoyaltyTransactionReason string

const (
	LoyaltyReasonOrderPaid       LoyaltyTransactionReason = "order_paid"
	LoyaltyReasonSignup          LoyaltyTransactionReason = "signup"
	LoyaltyReasonRedeem          LoyaltyTransactionReason = "redeem"
	LoyaltyReasonRedeemReversal  LoyaltyTransactionReason = "redeem_reversal"
	LoyaltyReasonReferral        LoyaltyTransactionReason = "referral"
	LoyaltyReasonReferralWelcome LoyaltyTransactionReason = "referral_welcome"
	LoyaltyReasonReview          LoyaltyTransactionReason = "review"
	LoyaltyReasonBirthday        LoyaltyTransactionReason = "birthday"
	LoyaltyReasonAdminAdjust     LoyaltyTransactionReason = "admin_adjust"
	LoyaltyReasonOrderClawback   LoyaltyTransactionReason = "order_clawback"
)

type LoyaltyAccount struct {
	UserID         int64       `db:"user_id"`
	PointsBalance  int         `db:"points_balance"`
	LifetimePoints int         `db:"lifetime_points"`
	Tier           LoyaltyTier `db:"tier"`
	TierSince      time.Time   `db:"tier_since"`
	UpdatedAt      time.Time   `db:"updated_at"`
}

type LoyaltyTransaction struct {
	ID        int64                    `db:"id"`
	UserID    int64                    `db:"user_id"`
	Delta     int                      `db:"delta"`
	Reason    LoyaltyTransactionReason `db:"reason"`
	RefType   string                   `db:"ref_type"`
	RefID     string                   `db:"ref_id"`
	CreatedAt time.Time                `db:"created_at"`
}

// ── Responses ────────────────────────────────────────────────────────────────

type LoyaltyResponse struct {
	PointsBalance  int         `json:"points_balance"`
	LifetimePoints int         `json:"lifetime_points"`
	Tier           LoyaltyTier `json:"tier"`
	// NextTier is omitted at the top tier; PointsToNext is then zero.
	NextTier     LoyaltyTier `json:"next_tier,omitempty"`
	PointsToNext int         `json:"points_to_next"`
}

type LoyaltyTransactionResponse struct {
	Delta     int                      `json:"delta"`
	Reason    LoyaltyTransactionReason `json:"reason"`
	CreatedAt time.Time                `json:"created_at"`
}

type RedeemPointsRequest struct {
	Points int `json:"points" validate:"required,min=1"`
}

// ProgrammeTier is a read-only tier threshold for admin/ops (PH-040d).
type ProgrammeTier struct {
	ID                string `json:"id"`
	MinLifetimePoints int    `json:"min_lifetime_points"`
}

// ProgrammeResponse is the effective Cellar Club configuration for admin.
// Rates come from process env (not DB); Editable is always false until a
// future DB-backed rates task.
type ProgrammeResponse struct {
	ConfigSource   string          `json:"config_source"` // "env"
	Editable       bool            `json:"editable"`
	EarnDivisor    float64         `json:"earn_divisor"`
	RedeemValue    float64         `json:"redeem_value"`
	SignupBonus    int             `json:"signup_bonus"`
	ReviewBonus    int             `json:"review_bonus"`
	BirthdayBonus  int             `json:"birthday_bonus"`
	BirthdayTZ     string          `json:"birthday_tz"`
	ReferralReward int             `json:"referral_reward"`
	Tiers          []ProgrammeTier `json:"tiers"`
	// Runbook is a short operator note (Persian-safe ASCII/Persian).
	Runbook string `json:"runbook"`
}
