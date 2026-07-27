// Package handlers contains the HTTP layer: it binds and validates requests,
// delegates to the service layer, and shapes responses. Handlers stay thin —
// all business rules live in internal/services.
package handlers

import (
	"time"

	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/notify"
	"github.com/tiredbooy/pkg/sms"
	"github.com/tiredbooy/pkg/token"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// Deps is the full set of dependencies the HTTP layer needs. It is assembled
// once at start-up (see internal/bootstrap) and embedded into Handler so every
// handler method can reach the services it needs.
type Deps struct {
	Validator *validator.Validator
	JWT       token.Manager
	Log       *zap.Logger

	// Cache is the Redis store. It may be nil-tolerant at call sites that treat
	// caching as best-effort, but auth hardening relies on it being present.
	Cache cache.Store
	// Notify delivers transactional email. Never on the request hot path.
	Notify notify.Mailer
	// SMS delivers text messages (OTP login). Sent off the request path.
	SMS sms.Sender
	// OTPTTL bounds how long a requested SMS login code stays valid.
	OTPTTL time.Duration
	// RefreshTTL mirrors the JWT refresh lifetime so the auth layer can scope the
	// refresh-token whitelist entries in Redis to the same window.
	RefreshTTL time.Duration
	// WebhookSecret is the shared secret used to verify payment-gateway webhook
	// signatures. Empty disables webhook handling (returns 503).
	WebhookSecret string

	User          *services.UserService
	PasswordReset *services.PasswordResetService
	Address       services.AddressService
	TasteProfile  *services.TasteProfileService

	Product  *services.ProductService
	Media    *services.MediaService
	Variant  *services.VariantService
	Option   *services.OptionService
	Category services.CategoryService
	Brand    services.BrandService
	Tag      *services.TagService

	Cart         *services.CartService
	Alert        *services.AlertService
	Coupon       *services.CouponService
	Order        services.OrderService
	Wishlist     *services.WishlistService
	Wallet       *services.WalletService
	Loyalty      *services.LoyaltyService
	Referral     *services.ReferralService
	GiftCard     *services.GiftCardService
	Subscription *services.SubscriptionService
	Review       *services.ReviewService
	Shipping     *services.ShippingService
	Payment      *services.PaymentService
	Inventory    services.InventoryService

	Blog         services.BlogService
	BlogCategory services.BlogCategoryService

	HeroSlide services.HeroSlideService

	SiteSettings services.SiteSettingsService

	Recipe         services.RecipeService
	Recommendation services.RecommendationService

	Event         *services.EventService
	ProductStats  *services.DailyProductStatsService
	RevenueStats  *services.DailyRevenueStatsService
	SearchSummary *services.SearchSummaryService
}

// Handler is the receiver for every HTTP handler method. It embeds Deps so the
// services are reachable as h.Product, h.Order, etc.
type Handler struct {
	Deps

	// cacheGroup collapses concurrent cache-miss builds for the same key into a
	// single execution (see cachedJSON). Its zero value is ready to use, so no
	// initialisation is needed.
	cacheGroup singleflight.Group
}

// New builds a Handler from its dependencies.
func New(d Deps) *Handler {
	return &Handler{Deps: d}
}
