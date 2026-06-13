package bootstrap

import (
	"time"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/analytics"
	"github.com/tiredbooy/internal/handlers"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/database"
	"github.com/tiredbooy/pkg/notify"
	"github.com/tiredbooy/pkg/token"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

// container holds the fully-wired application graph that the App lifecycle and
// the router need to reach.
type container struct {
	handler *handlers.Handler
	jwt     token.Manager
	queue   *analytics.Queue
	cache   cache.Store
	dbs     *database.Connections
}

// build wires the whole dependency graph — repositories → services → HTTP
// handlers — from the live database connections. It is the single place where
// the object graph is assembled, keeping the rest of the codebase free of
// construction noise.
func build(cfg *config.Config, log *zap.Logger, dbs *database.Connections, cacheStore cache.Store) *container {
	db := dbs.DB
	adb := dbs.AnalyticsDB

	// ── Repositories (main database) ─────────────────────────────────────────
	var (
		userRepo          = repositories.NewUserRepository(db)
		passwordResetRepo = repositories.NewPasswordResetRepository(db)
		addressRepo       = repositories.NewAddressRepository(db)

		productRepo  = repositories.NewProductRepository(db)
		variantRepo  = repositories.NewVariantRepository(db)
		categoryRepo = repositories.NewCategoryRepository(db)
		brandRepo    = repositories.NewBrandRepository(db)
		tagRepo      = repositories.NewTagRepository(db)

		orderRepo       = repositories.NewOrderRepository(db)
		orderItemRepo   = repositories.NewOrderItemRepository(db)
		cartRepo        = repositories.NewCartRepository(db)
		couponRepo      = repositories.NewCouponRepository(db)
		couponUsageRepo = repositories.NewCouponUsageRepository(db)

		shippingZoneRepo   = repositories.NewShippingZoneRepository(db)
		shippingMethodRepo = repositories.NewShippingMethodRepository(db)

		wishlistRepo    = repositories.NewWishlistRepository(db)
		walletRepo      = repositories.NewWalletRepository(db)
		reviewRepo      = repositories.NewReviewRepository(db)
		reviewImageRepo = repositories.NewReviewImageRepository(db)
		paymentRepo     = repositories.NewPaymentTransactionRepository(db)
		inventoryRepo   = repositories.NewInventoryRepository(db)
		movementRepo    = repositories.NewMovementRepository(db)

		blogRepo         = repositories.NewBlogRepository(db)
		blogCategoryRepo = repositories.NewBlogCategoryRepository(db)

		recipeRepo         = repositories.NewRecipeRepository(db)
		recommendationRepo = repositories.NewRecommendationRepository(db)
	)

	// ── Repositories (analytics database) ────────────────────────────────────
	var (
		eventRepo             = repositories.NewEventRepository(adb)
		dailyProductStatsRepo = repositories.NewDailyProductStatsRepository(adb)
		dailyRevenueStatsRepo = repositories.NewDailyRevenueStatsRepository(adb)
		searchSummaryRepo     = repositories.NewSearchSummaryRepository(adb)
	)

	// ── Services ─────────────────────────────────────────────────────────────
	jwt := token.NewManager(cfg, log)
	mailer := notify.New(cfg, log)
	eventService := services.NewEventService(eventRepo)

	// Payment and inventory are constructed first because the order service
	// depends on them for the checkout saga (reserve stock → open payment).
	paymentService := services.NewPaymentService(paymentRepo, orderRepo)
	inventoryService := services.NewInventoryService(inventoryRepo, movementRepo)
	orderService := services.NewOrderService(
		orderRepo, orderItemRepo, cartRepo,
		couponRepo, couponUsageRepo, shippingMethodRepo,
		inventoryService, paymentService,
	)

	deps := handlers.Deps{
		Validator:     validator.New(),
		JWT:           jwt,
		Log:           log,
		Cache:         cacheStore,
		Notify:        mailer,
		RefreshTTL:    time.Duration(cfg.JWTRefreshTokenTTL) * time.Minute,
		WebhookSecret: cfg.CryptoWebhookKey,

		User:          services.NewUserService(userRepo),
		PasswordReset: services.NewPasswordResetService(passwordResetRepo, userRepo, mailer),
		Address:       services.NewAddressService(addressRepo),

		Product:  services.NewProductService(productRepo),
		Variant:  services.NewVariantService(variantRepo),
		Category: services.NewCategoryService(categoryRepo),
		Brand:    services.NewBrandService(brandRepo),
		Tag:      services.NewTagService(tagRepo),

		Cart:      services.NewCartService(cartRepo, variantRepo, db),
		Coupon:    services.NewCouponService(couponRepo),
		Order:     orderService,
		Wishlist:  services.NewWishlistService(wishlistRepo),
		Wallet:    services.NewWalletService(walletRepo),
		Review:    services.NewReviewService(reviewRepo, reviewImageRepo),
		Shipping:  services.NewShippingService(shippingZoneRepo, shippingMethodRepo),
		Payment:   paymentService,
		Inventory: inventoryService,

		Blog:         services.NewBlogService(blogRepo, db),
		BlogCategory: services.NewBlogCategoryService(blogCategoryRepo),

		Recipe:         services.NewRecipeService(recipeRepo, db),
		Recommendation: services.NewRecommendationService(recommendationRepo),

		Event:         eventService,
		ProductStats:  services.NewDailyProductStatsService(dailyProductStatsRepo),
		RevenueStats:  services.NewDailyRevenueStatsService(dailyRevenueStatsRepo),
		SearchSummary: services.NewSearchSummaryService(searchSummaryRepo),
	}

	return &container{
		handler: handlers.New(deps),
		jwt:     jwt,
		queue:   analytics.NewQueue(eventService),
		cache:   cacheStore,
		dbs:     dbs,
	}
}
