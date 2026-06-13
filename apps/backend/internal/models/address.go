// internal/models/address.go
package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type Address struct {
	ID     int64 `db:"id"`
	UserID int64 `db:"user_id"`

	Title *string `db:"title"`

	FullName    string  `db:"full_name"`
	PhoneNumber *string `db:"phone_number"`

	AddressLine1 string  `db:"address_line1"`
	AddressLine2 *string `db:"address_line2"`

	City          string  `db:"city"`
	StateProvince *string `db:"state_province"`
	PostalCode    string  `db:"postal_code"`
	Country       string  `db:"country"`

	IsDefault bool `db:"is_default"`

	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateAddressReq struct {
	Title         *string `json:"title"`
	FullName      string  `json:"full_name"      validate:"required"`
	PhoneNumber   *string `json:"phone_number"`
	AddressLine1  string  `json:"address_line1"  validate:"required"`
	AddressLine2  *string `json:"address_line2"`
	City          string  `json:"city"           validate:"required"`
	StateProvince *string `json:"state_province"`
	PostalCode    string  `json:"postal_code"    validate:"required"`
	Country       string  `json:"country"        validate:"required"`
	IsDefault     bool    `json:"is_default"`
}

type UpdateAddressReq struct {
	Title         *string `json:"title"`
	FullName      *string `json:"full_name"`
	PhoneNumber   *string `json:"phone_number"`
	AddressLine1  *string `json:"address_line1"`
	AddressLine2  *string `json:"address_line2"`
	City          *string `json:"city"`
	StateProvince *string `json:"state_province"`
	PostalCode    *string `json:"postal_code"`
	Country       *string `json:"country"`
	IsDefault     *bool   `json:"is_default"`
}

// ─────────────────────────────────────────────────────────────
// Response
// ─────────────────────────────────────────────────────────────

type AddressResponse struct {
	ID            int64   `json:"id"`
	Title         *string `json:"title,omitempty"`
	FullName      string  `json:"full_name"`
	PhoneNumber   *string `json:"phone_number,omitempty"`
	AddressLine1  string  `json:"address_line1"`
	AddressLine2  *string `json:"address_line2,omitempty"`
	City          string  `json:"city"`
	StateProvince *string `json:"state_province,omitempty"`
	PostalCode    string  `json:"postal_code"`
	Country       string  `json:"country"`
	IsDefault     bool    `json:"is_default"`
}
