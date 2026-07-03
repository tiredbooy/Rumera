package models

import (
	"time"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────
// Core DB Model  —  maps 1-to-1 with the users table
// ─────────────────────────────────────────────────────────────

type User struct {
	ID     int64     `db:"id"`
	UserID uuid.UUID `db:"user_id"`

	FirstName *string `db:"first_name"`
	LastName  *string `db:"last_name"`

	Email        string  `db:"email"`
	PasswordHash *string `db:"password_hash"`

	Phone        *string `db:"phone"`
	NationalCode *string `db:"national_code"`

	BirthDate *time.Time `db:"birth_date"`
	Gender    *string    `db:"gender"`

	OAuthProvider *string `db:"oauth_provider"`
	OAuthID       *string `db:"oauth_id"`

	Role     string `db:"role"`
	IsActive bool   `db:"is_active"`
	IsBanned bool   `db:"is_banned"`

	EmailVerifiedAt *time.Time `db:"email_verified_at"`
	LastLoginAt     *time.Time `db:"last_login_at"`

	BannedAt  *time.Time `db:"banned_at"`
	CreatedAt time.Time  `db:"created_at"`
	UpdatedAt time.Time  `db:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests  —  what the handler binds from the HTTP body
// ─────────────────────────────────────────────────────────────

type CreateUserReq struct {
	FirstName    *string    `json:"first_name"`
	LastName     *string    `json:"last_name"`
	Email        string     `json:"email"         validate:"required,email"`
	Password     string     `json:"password"      validate:"required,min=8"`
	Phone        *string    `json:"phone"`
	NationalCode *string    `json:"national_code"`
	BirthDate    *time.Time `json:"birth_date"`
	Gender       *string    `json:"gender"        validate:"omitempty,oneof=male female other"`
	Role         string     `json:"role"          validate:"omitempty,oneof=customer admin vendor"`
}

type UpdateUserReq struct {
	FirstName    *string    `json:"first_name"`
	LastName     *string    `json:"last_name"`
	Phone        *string    `json:"phone"`
	PasswordHash *string    `json:"password_hash"`
	NationalCode *string    `json:"national_code"`
	BirthDate    *time.Time `json:"birth_date"`
	Gender       *string    `json:"gender"    validate:"omitempty,oneof=male female other"`
}

// AdminUpdateUserReq is the body for PATCH /admin/users/:userID. It carries the
// same editable profile fields as UpdateUserReq plus the two privileged,
// admin-only fields — role and is_active — which must NEVER be bindable on the
// self-service /auth/me route. Both privileged fields are optional pointers so
// an admin can patch profile data without touching access control.
type AdminUpdateUserReq struct {
	UpdateUserReq
	Role     *string `json:"role"      validate:"omitempty,oneof=customer admin vendor"`
	IsActive *bool   `json:"is_active"`
}

type OAuthReq struct {
	Email         string  `json:"email"          validate:"required,email"`
	FirstName     *string `json:"first_name"`
	LastName      *string `json:"last_name"`
	OAuthProvider string  `json:"oauth_provider" validate:"required"`
	OAuthID       string  `json:"oauth_id"       validate:"required"`
}

// ─────────────────────────────────────────────────────────────
// Responses  —  what the handler serialises back to the client
// ─────────────────────────────────────────────────────────────

type UserResponse struct {
	UserID    uuid.UUID  `json:"user_id"`
	FirstName *string    `json:"first_name,omitempty"`
	LastName  *string    `json:"last_name,omitempty"`
	Email     string     `json:"email"`
	Phone     *string    `json:"phone,omitempty"`
	BirthDate *time.Time `json:"birth_date,omitempty"`
	Gender    *string    `json:"gender,omitempty"`
	Role      string     `json:"role"`
	CreatedAt time.Time  `json:"created_at"`
}

type UserAdminResponse struct {
	UserResponse
	NationalCode    *string    `json:"national_code,omitempty"`
	OAuthProvider   *string    `json:"oauth_provider,omitempty"`
	IsActive        bool       `json:"is_active"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type UserListItem struct {
	UserID    uuid.UUID `json:"user_id"`
	// FirstName *string   `json:"first_name,omitempty"`
	// LastName  *string   `json:"last_name,omitempty"`
	FullName  string    `json:"full_name"`
	Email     string    `json:"email"`
	Phone     *string   `json:"phone,omitempty"`
	Role      string    `json:"role"`
	TotalOrders int       `json:"total_orders"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// ─────────────────────────────────────────────────────────────
// Filter  —  used by the repository List method
// ─────────────────────────────────────────────────────────────

type UserFilter struct {
	BaseFilter // Page, Limit, Offset(), SortBy, OrderBy, Search

	// user-specific
	Role        *string    `query:"role"         validate:"omitempty,oneof=customer admin vendor"`
	IsActive    *bool      `query:"is_active"`
	Gender      *string    `query:"gender"       validate:"omitempty,oneof=male female other"`
	CreatedFrom *time.Time `query:"created_from"`
	CreatedTo   *time.Time `query:"created_to"`
}

func (f *UserFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
