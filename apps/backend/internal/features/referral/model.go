package referral

import "time"

type ReferralStatus string

const (
	ReferralStatusPending   ReferralStatus = "pending"
	ReferralStatusCompleted ReferralStatus = "completed"
)

// Referral is the persistence model for a referral relationship. It is not an
// API response; customer endpoints expose ReferralResponse instead.
type Referral struct {
	ID             int64          `db:"id"`
	ReferrerUserID int64          `db:"referrer_user_id"`
	RefereeUserID  int64          `db:"referee_user_id"`
	Status         ReferralStatus `db:"status"`
	RewardPoints   int            `db:"reward_points"`
	CreatedAt      time.Time      `db:"created_at"`
	CompletedAt    *time.Time     `db:"completed_at"`
}

// ReferralResponse is the customer-facing view of their referral standing.
type ReferralResponse struct {
	Code      string `json:"code"`
	Pending   int    `json:"pending"`
	Completed int    `json:"completed"`
	// Reward is the points each side earns when a referral completes.
	Reward int `json:"reward"`
}

type ClaimReferralInput struct {
	Code string `json:"code" validate:"required"`
}
