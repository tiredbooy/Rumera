// Package handlers is the HTTP composition root for the API.
//
// After the feature-architecture migration, this package no longer owns
// business HTTP methods. Each domain lives under internal/features/<name>
// with its own Handler + RegisterPublic/Customer/Admin.
//
// handlers.Handler (and Deps) only assemble feature handlers so
// internal/routes can call feature.Register* and middleware can reach
// shared cross-cutting deps (e.g. users.Service for Auth).
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package handlers

import (
	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/features/alerts"
	featanalytics "github.com/tiredbooy/internal/features/analytics"
	"github.com/tiredbooy/internal/features/auth"
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
)

// Deps is the set of feature HTTP surfaces the router composition root needs.
// It is assembled once at start-up (see internal/bootstrap) and embedded into
// Handler. Prefer feature-local constructors over adding fields here.
//
// Only dependencies required by routes.Setup or trust-group middleware belong
// here. Domain services stay inside feature handlers (or bootstrap for cron).
type Deps struct {
	// User backs mw.Auth / role checks (not an HTTP handler itself).
	User *users.Service
	// Capabilities backs mw.RequirePermission (panel capability matrix).
	Capabilities *rbac.Service

	// Feature HTTP handlers — one per mounted Register* package.
	Auth             *auth.Handler
	Users            *users.Handler
	RBAC             *rbac.Handler
	Addresses        *addresses.Handler
	TasteProfiles    *taste.Handler
	Products         *product.Handler
	MediaHTTP        *media.Handler
	Variants         *variant.Handler
	Options          *option.Handler
	Categories       *category.Handler
	Brands           *brand.Handler
	Tags             *tag.Handler
	Carts            *cart.Handler
	Alerts           *alerts.Handler
	Coupons          *coupons.Handler
	OrderHTTP        *orders.Handler
	Wishlists        *wishlist.Handler
	Wallets          *wallet.Handler
	Loyalties        *loyalty.Handler
	Referrals        *referral.Handler
	GiftCards        *giftcard.Handler
	Subscriptions    *subscription.Handler
	Reviews          *reviews.Handler
	Shippings        *shipping.Handler
	Payments         *payments.Handler
	Inventories      *inventory.Handler
	Blogs            *blog.Handler
	HeroSlides       *hero.Handler
	SiteSettingsHTTP *site_settings.Handler
	Recipes          *recipes.Handler
	Recommendations  *recommendations.Handler
	Analytics        *featanalytics.Handler
}

// Handler is the composition root passed to routes.Setup. It embeds Deps so
// Register* calls read as h.Products, h.Orders, etc.
//
// It intentionally has no business HTTP methods — those live on feature handlers.
type Handler struct {
	Deps
}

// New builds the composition root from its feature handlers.
func New(d Deps) *Handler {
	return &Handler{Deps: d}
}
