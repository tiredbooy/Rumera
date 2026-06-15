package models

import "time"

type Subscription struct {
	ID            int64     `db:"id"`
	UserID        int64     `db:"user_id"`
	Plan          string    `db:"plan"`
	Cadence       string    `db:"cadence"`
	Status        string    `db:"status"`
	AddressID     *int64    `db:"address_id"`
	NextRenewalAt time.Time `db:"next_renewal_at"`
	CreatedAt     time.Time `db:"created_at"`
	UpdatedAt     time.Time `db:"updated_at"`
}

type CreateSubscriptionReq struct {
	Cadence   string `json:"cadence"    validate:"required,oneof=monthly quarterly"`
	AddressID *int64 `json:"address_id" validate:"omitempty,min=1"`
}

// UpdateSubscriptionReq drives lifecycle actions from the account UI.
type UpdateSubscriptionReq struct {
	Action string `json:"action" validate:"required,oneof=pause resume cancel skip"`
}

type SubscriptionResponse struct {
	ID            int64     `json:"id"`
	Plan          string    `json:"plan"`
	Cadence       string    `json:"cadence"`
	Status        string    `json:"status"`
	AddressID     *int64    `json:"address_id,omitempty"`
	NextRenewalAt time.Time `json:"next_renewal_at"`
	CreatedAt     time.Time `json:"created_at"`
}

// NextRenewal advances a date by one billing cadence.
func NextRenewal(from time.Time, cadence string) time.Time {
	if cadence == "quarterly" {
		return from.AddDate(0, 3, 0)
	}
	return from.AddDate(0, 1, 0) // monthly default
}

// DueSubscription is a renewal-due row joined with the customer's email.
type DueSubscription struct {
	ID            int64     `db:"id"`
	UserID        int64     `db:"user_id"`
	Email         string    `db:"email"`
	Cadence       string    `db:"cadence"`
	NextRenewalAt time.Time `db:"next_renewal_at"`
}
