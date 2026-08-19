// Package routes is the single HTTP composition root for the API.
//
// Pattern (feature-based):
//
//	features/<domain>/routes.go  →  owns that domain's paths
//	internal/routes/routes.go    →  only builds trust groups and calls Register*
//
// Each feature exposes:
//
//	RegisterPublic(v1, handler, ...)
//	RegisterCustomer(authenticatedGroup, handler)
//	RegisterAdmin(adminGroup, handler)
//
// No business paths live in this file — only trust-tier composition.
//
// Trust tiers:
//
//	public    — no JWT
//	customer  — mw.Auth (any live user)
//	admin     — mw.Auth + panel role (admin|staff) + per-surface capabilities
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/features/alerts"
	featanalytics "github.com/tiredbooy/internal/features/analytics"
	authfeat "github.com/tiredbooy/internal/features/auth"
	"github.com/tiredbooy/internal/features/blog"
	"github.com/tiredbooy/internal/features/cart"
	"github.com/tiredbooy/internal/features/catalog/brand"
	"github.com/tiredbooy/internal/features/catalog/category"
	"github.com/tiredbooy/internal/features/catalog/option"
	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/tag"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/coupons"
	"github.com/tiredbooy/internal/features/giftcard"
	"github.com/tiredbooy/internal/features/hero"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/loyalty"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/internal/features/orders"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/rbac"
	"github.com/tiredbooy/internal/features/recipes"
	"github.com/tiredbooy/internal/features/recommendations"
	"github.com/tiredbooy/internal/features/referral"
	"github.com/tiredbooy/internal/features/reviews"
	"github.com/tiredbooy/internal/features/shipping"
	"github.com/tiredbooy/internal/features/site_settings"
	"github.com/tiredbooy/internal/features/subscription"
	"github.com/tiredbooy/internal/features/taste"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/internal/features/wishlist"
	"github.com/tiredbooy/internal/handlers"
	mw "github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/token"
)

// Setup wires the full API surface by composing feature route modules.
//
// webhookIdem: payment webhook policy (AllowAutoKey=true).
// moneyIdem: authenticated money POSTs (AllowAutoKey=false; optional key until FE ready).
// Either may be nil to skip platform cache on that tier (tests).
func Setup(r *gin.Engine, h *handlers.Handler, jwt token.Manager, store cache.Store, webhookIdem, moneyIdem gin.HandlerFunc) {
	// ── Cross-cutting (not owned by a single business feature) ─────────────
	r.GET("/health", func(c *gin.Context) {
		response.OK(c, gin.H{"status": "ok"})
	})
	// On-the-fly image transform (outside /api/v1).
	media.RegisterPublicRoot(r, h.MediaHTTP)

	v1 := r.Group("/api/v1")

	// ── Public tier ────────────────────────────────────────────────────────
	registerPublic(v1, h, jwt, store, webhookIdem)

	// ── Customer tier (any authenticated live user) ────────────────────────
	customer := v1.Group("")
	customer.Use(mw.Auth(jwt, h.User))
	registerCustomer(customer, h, moneyIdem)

	// ── Admin tier (panel roles; capability gates inside registerAdmin) ─────
	admin := v1.Group("/admin")
	admin.Use(
		mw.Auth(jwt, h.User),
		mw.RequireRole(users.UserRoleAdmin, users.UserRoleStaff),
	)
	registerAdmin(admin, h, moneyIdem)

	r.NoRoute(func(c *gin.Context) {
		response.Error(c, response.ErrNotFound)
	})
}

// registerPublic mounts feature public routes (and special-cased auth/me).
func registerPublic(v1 *gin.RouterGroup, h *handlers.Handler, jwt token.Manager, store cache.Store, webhookIdem gin.HandlerFunc) {
	// Identity
	authfeat.RegisterPublic(v1, h.Auth, jwt, store)

	// Content / storefront
	site_settings.RegisterPublic(v1, h.SiteSettingsHTTP)
	hero.RegisterPublic(v1, h.HeroSlides)
	blog.RegisterPublic(v1, h.Blogs)
	recipes.RegisterPublic(v1, h.Recipes)
	reviews.RegisterPublic(v1, h.Reviews)
	recommendations.RegisterPublic(v1, h.Recommendations)

	// Catalogue
	category.RegisterPublic(v1, h.Categories)
	brand.RegisterPublic(v1, h.Brands)
	tag.RegisterPublic(v1, h.Tags)
	product.RegisterPublic(v1, h.Products)
	variant.RegisterPublic(v1, h.Variants)

	// Commerce (public reads / webhooks)
	shipping.RegisterPublic(v1, h.Shippings)
	// Payment webhooks: unauthenticated but signature-verified + idempotent.
	payments.RegisterPublic(v1, h.Payments, webhookIdem)

	// Authenticated /auth/* (me) shares the auth path prefix but needs JWT.
	// Mounted here so the path stays /api/v1/auth/me without nesting under
	// the catch-all customer group twice.
	authMe := v1.Group("/auth")
	authMe.Use(mw.Auth(jwt, h.User))
	authfeat.RegisterCustomer(authMe, h.Auth)
	users.RegisterCustomer(authMe, h.Users)
}

// registerCustomer mounts feature customer routes on the authenticated group.
// (Profile PATCH lives under /auth via registerPublic.)
// moneyIdem is applied to P0 money mutation routes (PH-011c).
func registerCustomer(customer *gin.RouterGroup, h *handlers.Handler, moneyIdem gin.HandlerFunc) {
	// Account
	addresses.RegisterCustomer(customer, h.Addresses)
	wishlist.RegisterCustomer(customer, h.Wishlists)
	wallet.RegisterCustomer(customer, h.Wallets, moneyIdem)
	loyalty.RegisterCustomer(customer, h.Loyalties, moneyIdem)
	referral.RegisterCustomer(customer, h.Referrals)
	giftcard.RegisterCustomer(customer, h.GiftCards, moneyIdem)
	subscription.RegisterCustomer(customer, h.Subscriptions)
	alerts.RegisterCustomer(customer, h.Alerts)
	taste.RegisterCustomer(customer, h.TasteProfiles)

	// Engagement / commerce
	reviews.RegisterCustomer(customer, h.Reviews)
	recommendations.RegisterCustomer(customer, h.Recommendations)
	coupons.RegisterCustomer(customer, h.Coupons)
	cart.RegisterCustomer(customer, h.Carts)
	orders.RegisterCustomer(customer, h.OrderHTTP, moneyIdem)
}

// registerAdmin mounts feature admin routes on the /admin group.
//
// Capability policy (PH-021a):
//   - RequirePermission is OR of the listed grants (any one allows).
//   - Admin superuser always passes.
//   - Read routes accept read OR write (writers can still list).
//   - Write routes require the write/moderate/delete capability only —
//     staff with only *:read cannot mutate.
//
// moneyIdem is applied to P0 money mutation routes (admin wallet credit).
func registerAdmin(admin *gin.RouterGroup, h *handlers.Handler, moneyIdem gin.HandlerFunc) {
	caps := h.Capabilities
	with := func(perms ...string) *gin.RouterGroup {
		g := admin.Group("")
		g.Use(mw.RequirePermission(caps, perms...))
		return g
	}

	// Identity / ops. customers:write is profile create/update (PR-040c).
	// Role/status writes still require live role=admin inside users.Service.
	// Ban/unban is a dedicated grant — not OR'd onto write (PR-040e).
	users.RegisterAdmin(
		with(rbac.PermCustomersRead, rbac.PermCustomersWrite, rbac.PermRolesManage),
		with(rbac.PermCustomersWrite),
		with(rbac.PermCustomersBan),
		h.Users,
	)
	// Wallet credit mints ledger money — dedicated grant, not customers:write.
	// The ledger READ is support work, so it rides the customers-read group
	// (A-10): a wallet-paid order has no payment_transactions row, making this
	// the only admin trail for it.
	wallet.RegisterAdmin(
		with(rbac.PermCustomersRead, rbac.PermCustomersWrite),
		with(rbac.PermWalletCredit),
		h.Wallets,
		moneyIdem,
	)
	giftcard.RegisterAdmin(with(rbac.PermGiftCardsIssue), h.GiftCards)
	// Cellar Club: reads (PR-003d) + signed adjust (PR-003e).
	// Point minting is money — dedicated loyalty:adjust grant, not customers:write
	// (L-8, same isolation as wallet:credit). It ORs into the read group so a
	// loyalty specialist is grantable without customers:write.
	loyalty.RegisterAdmin(
		with(rbac.PermCustomersRead, rbac.PermCustomersWrite, rbac.PermLoyaltyAdjust),
		with(rbac.PermCustomersWrite),
		with(rbac.PermLoyaltyAdjust),
		h.Loyalties,
		moneyIdem,
	)

	// Capability matrix (GET readable by any panel user for live grants;
	// mutations require roles:manage — enforced in the handler).
	rbac.RegisterAdmin(admin, h.RBAC)

	// Content
	site_settings.RegisterAdmin(with(rbac.PermSettingsManage), h.SiteSettingsHTTP)
	hero.RegisterAdmin(with(rbac.PermHeroManage), h.HeroSlides)
	blog.RegisterAdmin(
		with(rbac.PermJournalRead, rbac.PermJournalWrite),
		with(rbac.PermJournalWrite),
		h.Blogs,
	)
	recipes.RegisterAdmin(
		with(rbac.PermRecipesRead, rbac.PermRecipesWrite),
		with(rbac.PermRecipesWrite),
		h.Recipes,
	)
	reviews.RegisterAdmin(
		with(rbac.PermReviewsRead, rbac.PermReviewsMod),
		with(rbac.PermReviewsMod),
		h.Reviews,
	)
	recommendations.RegisterAdmin(with(rbac.PermAnalyticsRead), h.Recommendations)

	// Catalogue — write mutations require write; delete requires delete.
	product.RegisterAdmin(
		with(rbac.PermProductsRead, rbac.PermProductsWrite),
		with(rbac.PermProductsWrite),
		with(rbac.PermProductsDelete, rbac.PermProductsWrite),
		h.Products,
	)
	category.RegisterAdmin(with(rbac.PermProductsWrite), h.Categories)
	brand.RegisterAdmin(with(rbac.PermProductsWrite), h.Brands)
	tag.RegisterAdmin(with(rbac.PermTagsManage), h.Tags)
	option.RegisterAdmin(with(rbac.PermProductsWrite), h.Options)
	variant.RegisterAdmin(with(rbac.PermProductsWrite), h.Variants)
	media.RegisterAdmin(with(
		rbac.PermProductsWrite, rbac.PermJournalWrite, rbac.PermRecipesWrite, rbac.PermHeroManage,
	), h.MediaHTTP)

	// Commerce
	coupons.RegisterAdmin(with(rbac.PermCouponsManage), h.Coupons)
	shipping.RegisterAdmin(with(rbac.PermShippingManage), h.Shippings)
	inventory.RegisterAdmin(
		with(rbac.PermInventoryRead, rbac.PermInventoryWrite),
		with(rbac.PermInventoryWrite),
		h.Inventories,
	)
	payments.RegisterAdmin(with(rbac.PermPaymentsRead), h.Payments)
	orders.RegisterAdmin(
		with(rbac.PermOrdersRead, rbac.PermOrdersWrite, rbac.PermOrdersRefund),
		with(rbac.PermOrdersWrite, rbac.PermOrdersRefund),
		h.OrderHTTP,
	)

	// Insights
	featanalytics.RegisterAdmin(with(rbac.PermAnalyticsRead), h.Analytics)
}
