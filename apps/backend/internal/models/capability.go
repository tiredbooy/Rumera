package models

// Known panel capability identifiers — keep in sync with apps/frontend/lib/rbac/permissions.ts.
const (
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

// AllKnownPermissions is the closed catalogue used for validation and admin defaults.
func AllKnownPermissions() []string {
	return []string{
		PermProductsRead, PermProductsWrite, PermProductsDelete, PermTagsManage,
		PermInventoryRead, PermInventoryWrite,
		PermOrdersRead, PermOrdersWrite, PermOrdersRefund,
		PermPaymentsRead, PermCouponsManage, PermShippingManage, PermGiftCardsIssue,
		PermCustomersRead, PermCustomersWrite, PermCustomersBan,
		PermReviewsRead, PermReviewsMod,
		PermRecipesRead, PermRecipesWrite,
		PermJournalRead, PermJournalWrite,
		PermHeroManage, PermAnalyticsRead,
		PermRolesManage, PermSettingsManage,
	}
}

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
type AuthorizationMatrixResponse struct {
	AuthorizationMode string              `json:"authorization_mode"`
	AdminRoles        []string            `json:"admin_roles"`
	Roles             []AdminRoleSummary  `json:"roles"`
	Capabilities      []RoleCapabilities  `json:"capabilities"`
	Catalogue         []string            `json:"catalogue"`
}
