package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	UserRoleCustomer = "customer"
	UserRoleVendor   = "vendor"
	UserRoleAdmin    = "admin"
)

func IsAssignableUserRole(role string) bool {
	switch role {
	case UserRoleCustomer, UserRoleVendor, UserRoleAdmin:
		return true
	default:
		return false
	}
}

func AssignableUserRoles() []string {
	return []string{UserRoleCustomer, UserRoleVendor, UserRoleAdmin}
}

func IsUserGender(gender string) bool {
	switch gender {
	case "male", "female", "other":
		return true
	default:
		return false
	}
}

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

// AuthUser is the minimal live account projection required by authentication
// middleware after a token has been cryptographically validated.
type AuthUser struct {
	ID       int64     `db:"id"`
	UserID   uuid.UUID `db:"user_id"`
	Role     string    `db:"role"`
	IsActive bool      `db:"is_active"`
	IsBanned bool      `db:"is_banned"`
}

// ─────────────────────────────────────────────────────────────
// Requests  —  what the handler binds from the HTTP body
// ─────────────────────────────────────────────────────────────

// SignUpInput is the public POST /auth/register body. Role is accepted for
// request compatibility but ignored: every self-registered account is a
// customer.
type SignUpInput struct {
	FirstName    *string    `json:"first_name"`
	LastName     *string    `json:"last_name"`
	Email        string     `json:"email"         validate:"required,email"`
	Password     string     `json:"password"      validate:"required,min=8,max=72"`
	Phone        *string    `json:"phone"`
	NationalCode *string    `json:"national_code"`
	BirthDate    *time.Time `json:"birth_date"`
	Gender       *string    `json:"gender"        validate:"omitempty,oneof=male female other"`
	Role         string     `json:"role"          validate:"omitempty,oneof=customer admin vendor"`
}

// CreateUserReq is the internal service/repository command produced from a
// validated SignUpInput. UserService always forces its role to customer.
type CreateUserReq struct {
	FirstName    *string    `json:"first_name"`
	LastName     *string    `json:"last_name"`
	Email        string     `json:"email"         validate:"required,email"`
	Password     string     `json:"password"      validate:"required,min=8,max=72"`
	Phone        *string    `json:"phone"`
	NationalCode *string    `json:"national_code"`
	BirthDate    *time.Time `json:"birth_date"`
	Gender       *string    `json:"gender"        validate:"omitempty,oneof=male female other"`
	Role         string     `json:"role"          validate:"omitempty,oneof=customer admin vendor"`
}

// AdminCreateUserReq is the body for POST /admin/users. Password is accepted
// only at this boundary and is replaced by a server-generated hash before the
// repository is called.
type AdminCreateUserReq struct {
	FirstName    *string    `json:"first_name"    validate:"omitempty,max=100"`
	LastName     *string    `json:"last_name"     validate:"omitempty,max=100"`
	Email        string     `json:"email"         validate:"required,email,max=255"`
	Password     string     `json:"password"      validate:"required,min=8,max=72"`
	Phone        *string    `json:"phone"          validate:"omitempty,max=20"`
	NationalCode *string    `json:"national_code" validate:"omitempty,max=20"`
	BirthDate    *time.Time `json:"birth_date"`
	Gender       *string    `json:"gender"        validate:"omitempty,oneof=male female other"`
	Role         *string    `json:"role"          validate:"omitempty,oneof=customer vendor admin"`
	IsActive     *bool      `json:"is_active"`
}

// AdminCreateUserParams is the persistence command produced after defaults and
// password hashing. It intentionally contains no plaintext password.
type AdminCreateUserParams struct {
	FirstName    *string
	LastName     *string
	Email        string
	Phone        *string
	NationalCode *string
	BirthDate    *time.Time
	Gender       *string
	Role         string
	IsActive     bool
}

// UpdateProfileInput is the public PATCH /auth/me body. Email, password, role,
// and account status are intentionally absent from the self-service contract.
type UpdateProfileInput struct {
	FirstName    *string    `json:"first_name"`
	LastName     *string    `json:"last_name"`
	Phone        *string    `json:"phone"`
	NationalCode *string    `json:"national_code"`
	BirthDate    *time.Time `json:"birth_date"`
	Gender       *string    `json:"gender" validate:"omitempty,oneof=male female other"`
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

// AdminUpdateUserReq is the body for PATCH /admin/users/:userID. NullablePatch
// distinguishes an omitted profile field from an explicit JSON null clear.
type AdminUpdateUserReq struct {
	FirstName    NullablePatch[string]    `json:"first_name"`
	LastName     NullablePatch[string]    `json:"last_name"`
	Phone        NullablePatch[string]    `json:"phone"`
	NationalCode NullablePatch[string]    `json:"national_code"`
	BirthDate    NullablePatch[time.Time] `json:"birth_date"`
	Gender       NullablePatch[string]    `json:"gender"`
	Role         NullablePatch[string]    `json:"role"`
	IsActive     NullablePatch[bool]      `json:"is_active"`
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

// AdminUser is the full user projection returned by the admin detail and update
// endpoints. It intentionally excludes password and internal database fields.
type AdminUser struct {
	UserResponse
	NationalCode    *string    `json:"national_code,omitempty"`
	OAuthProvider   *string    `json:"oauth_provider,omitempty"`
	IsActive        bool       `json:"is_active"`
	IsBanned        bool       `json:"is_banned"`
	BannedAt        *time.Time `json:"banned_at,omitempty"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type UserListItem struct {
	UserID      uuid.UUID `json:"user_id"`
	FullName    string    `json:"full_name"`
	Email       string    `json:"email"`
	Phone       *string   `json:"phone,omitempty"`
	Role        string    `json:"role"`
	TotalOrders int       `json:"total_orders"`
	IsActive    bool      `json:"is_active"`
	IsBanned    bool      `json:"is_banned"`
	CreatedAt   time.Time `json:"created_at"`
}

type UserRoleCounts struct {
	MemberCount       int64
	ActiveMemberCount int64
}

type AdminRoleSummary struct {
	Role              string `json:"role"`
	AdminAccess       bool   `json:"admin_access"`
	Assignable        bool   `json:"assignable"`
	MemberCount       int64  `json:"member_count"`
	ActiveMemberCount int64  `json:"active_member_count"`
}

type AdminRolesResponse struct {
	AuthorizationMode string             `json:"authorization_mode"`
	AdminRoles        []string           `json:"admin_roles"`
	Roles             []AdminRoleSummary `json:"roles"`
}

type AdminUserAuditAction string

const (
	AdminUserAuditCreated     AdminUserAuditAction = "user.created"
	AdminUserAuditUpdated     AdminUserAuditAction = "user.updated"
	AdminUserAuditDeactivated AdminUserAuditAction = "user.deactivated"
)

type AdminUserAuditChange struct {
	Before any `json:"before"`
	After  any `json:"after"`
}

type AdminUserAuditEvent struct {
	EventID       uuid.UUID                       `json:"event_id"`
	ActorUserID   uuid.UUID                       `json:"actor_user_id"`
	ActorEmail    string                          `json:"actor_email"`
	TargetUserID  uuid.UUID                       `json:"target_user_id"`
	Action        AdminUserAuditAction            `json:"action"`
	ChangedFields []string                        `json:"changed_fields"`
	Changes       map[string]AdminUserAuditChange `json:"changes"`
	CreatedAt     time.Time                       `json:"created_at"`
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

type AdminUserAuditFilter struct {
	PaginationParams
}

func (f *AdminUserAuditFilter) Defaults() {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
}
