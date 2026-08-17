package rbac

// Known panel capability identifiers — keep in sync with
// apps/frontend/lib/rbac/permissions.ts.
//
// Panel role strings must match the users.role column values for admin/staff.
const (
	RoleAdmin = "admin"
	RoleStaff = "staff"

	PermProductsRead   = "products:read"
	PermProductsWrite  = "products:write"
	PermProductsDelete = "products:delete"
	PermTagsManage     = "tags:manage"
	PermInventoryRead  = "inventory:read"
	PermInventoryWrite = "inventory:write"
	PermOrdersRead     = "orders:read"
	PermOrdersWrite    = "orders:write"
	PermOrdersRefund   = "orders:refund"
	PermPaymentsRead   = "payments:read"
	PermCouponsManage  = "coupons:manage"
	PermShippingManage = "shipping:manage"
	PermGiftCardsIssue = "gift-cards:issue"
	PermCustomersRead  = "customers:read"
	PermCustomersWrite = "customers:write"
	PermCustomersBan   = "customers:ban"
	// PermWalletCredit mints ledger money via POST /admin/users/:id/wallet/credit.
	// Isolated from customers:write so the default staff seed cannot print money (PR-040c).
	PermWalletCredit   = "wallet:credit"
	PermReviewsRead    = "reviews:read"
	PermReviewsMod     = "reviews:moderate"
	PermRecipesRead    = "recipes:read"
	PermRecipesWrite   = "recipes:write"
	PermJournalRead    = "journal:read"
	PermJournalWrite   = "journal:write"
	PermHeroManage     = "hero:manage"
	PermAnalyticsRead  = "analytics:read"
	PermRolesManage    = "roles:manage"
	PermSettingsManage = "settings:manage"
)

// IsPanelRole reports whether the role may enter the admin panel
// (subject to capability grants for staff).
func IsPanelRole(role string) bool {
	return role == RoleAdmin || role == RoleStaff
}

// AllKnownPermissions is the closed catalogue used for validation and admin defaults.
func AllKnownPermissions() []string {
	return []string{
		PermProductsRead, PermProductsWrite, PermProductsDelete, PermTagsManage,
		PermInventoryRead, PermInventoryWrite,
		PermOrdersRead, PermOrdersWrite, PermOrdersRefund,
		PermPaymentsRead, PermCouponsManage, PermShippingManage, PermGiftCardsIssue,
		PermCustomersRead, PermCustomersWrite, PermCustomersBan, PermWalletCredit,
		PermReviewsRead, PermReviewsMod,
		PermRecipesRead, PermRecipesWrite,
		PermJournalRead, PermJournalWrite,
		PermHeroManage, PermAnalyticsRead,
		PermRolesManage, PermSettingsManage,
	}
}

// IsKnownPermission reports whether p is in the closed catalogue.
func IsKnownPermission(p string) bool {
	for _, known := range AllKnownPermissions() {
		if known == p {
			return true
		}
	}
	return false
}

// RoleCapabilities is the durable map of a panel role to its capability set.
type RoleCapabilities struct {
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

// UpdateRoleCapabilitiesReq replaces the capability set for a panel role.
type UpdateRoleCapabilitiesReq struct {
	Permissions []string `json:"permissions" validate:"required,min=0,dive,required"`
}

// AuthorizationMatrixResponse is the admin roles + capabilities payload.
// RoleSummaries are filled by the users feature when composing the admin
// roles page; this type is owned by rbac because capabilities are the
// authorization source of truth.
type AuthorizationMatrixResponse struct {
	AuthorizationMode string             `json:"authorization_mode"`
	AdminRoles        []string           `json:"admin_roles"`
	Roles             []RoleSummary      `json:"roles"`
	Capabilities      []RoleCapabilities `json:"capabilities"`
	Catalogue         []string           `json:"catalogue"`
}

// RoleSummary is the role row on the authorization matrix (member counts + flags).
type RoleSummary struct {
	Role              string `json:"role"`
	AdminAccess       bool   `json:"admin_access"`
	Assignable        bool   `json:"assignable"`
	MemberCount       int    `json:"member_count"`
	ActiveMemberCount int    `json:"active_member_count"`
}
