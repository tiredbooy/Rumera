package subscription

import "time"

type SubscriptionCadence = string
type SubscriptionStatus string
type SubscriptionAction string

const (
	SubscriptionCadenceMonthly   SubscriptionCadence = "monthly"
	SubscriptionCadenceQuarterly SubscriptionCadence = "quarterly"
)

const (
	SubscriptionStatusActive    SubscriptionStatus = "active"
	SubscriptionStatusPaused    SubscriptionStatus = "paused"
	SubscriptionStatusCancelled SubscriptionStatus = "cancelled"
)

const (
	SubscriptionActionPause  SubscriptionAction = "pause"
	SubscriptionActionResume SubscriptionAction = "resume"
	SubscriptionActionCancel SubscriptionAction = "cancel"
	SubscriptionActionSkip   SubscriptionAction = "skip"
)

type Subscription struct {
	ID            int64               `db:"id"`
	UserID        int64               `db:"user_id"`
	Plan          string              `db:"plan"`
	Cadence       SubscriptionCadence `db:"cadence"`
	Status        SubscriptionStatus  `db:"status"`
	AddressID     *int64              `db:"address_id"`
	NextRenewalAt time.Time           `db:"next_renewal_at"`
	CreatedAt     time.Time           `db:"created_at"`
	UpdatedAt     time.Time           `db:"updated_at"`
}

type CreateSubscriptionReq struct {
	Cadence   SubscriptionCadence `json:"cadence"    validate:"required,oneof=monthly quarterly"`
	AddressID *int64              `json:"address_id" validate:"omitempty,min=1"`
}

// UpdateSubscriptionReq is a PATCH body. action is required only for a
// lifecycle change; address_id may be sent alone or together with action.
// Address-book ownership is enforced in Service (caller-owned GetByID).
type UpdateSubscriptionReq struct {
	Action    SubscriptionAction `json:"action"     validate:"omitempty,oneof=pause resume cancel skip"`
	AddressID *int64             `json:"address_id" validate:"omitempty,min=1"`
}

// HasPatch reports whether the body has a lifecycle action and/or a ship-to id.
func (r UpdateSubscriptionReq) HasPatch() bool {
	return r.Action != "" || r.AddressID != nil
}

type SubscriptionResponse struct {
	ID            int64               `json:"id"`
	Plan          string              `json:"plan"`
	Cadence       SubscriptionCadence `json:"cadence"`
	Status        SubscriptionStatus  `json:"status"`
	AddressID     *int64              `json:"address_id,omitempty"`
	NextRenewalAt time.Time           `json:"next_renewal_at"`
	CreatedAt     time.Time           `json:"created_at"`
}

// PlanCellarBox is the only subscription product. It is a recurring physical
// curated box ("باکس سرداب"), not digital catalog access or SaaS seats.
const PlanCellarBox = "cellar-box"

// NextRenewal advances a date by one box cadence (calendar months).
// monthly → +1 month; quarterly → +3 months.
func NextRenewal(from time.Time, cadence SubscriptionCadence) time.Time {
	if cadence == SubscriptionCadenceQuarterly {
		return from.AddDate(0, 3, 0)
	}
	return from.AddDate(0, 1, 0) // monthly default
}

// AllowedAction reports whether a lifecycle action is valid for the current status.
//
//	pause  — active only
//	resume — paused or cancelled (reactivate)
//	cancel — active or paused
//	skip   — active only (push next_renewal_at by one cadence; no charge)
func AllowedAction(status SubscriptionStatus, action SubscriptionAction) bool {
	switch action {
	case SubscriptionActionPause:
		return status == SubscriptionStatusActive
	case SubscriptionActionResume:
		return status == SubscriptionStatusPaused || status == SubscriptionStatusCancelled
	case SubscriptionActionCancel:
		return status == SubscriptionStatusActive || status == SubscriptionStatusPaused
	case SubscriptionActionSkip:
		return status == SubscriptionStatusActive
	default:
		return false
	}
}

// DueSubscription is a renewal-due row joined with the customer's email.
type DueSubscription struct {
	ID            int64               `db:"id"`
	UserID        int64               `db:"user_id"`
	Email         string              `db:"email"`
	Cadence       SubscriptionCadence `db:"cadence"`
	NextRenewalAt time.Time           `db:"next_renewal_at"`
}
