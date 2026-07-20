package bootstrap

import (
	"strings"
	"time"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/analytics"
	"github.com/tiredbooy/internal/corn"
	"github.com/tiredbooy/internal/handlers"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/database"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/notify"
	"github.com/tiredbooy/pkg/sms"
	"github.com/tiredbooy/pkg/storage"
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
	// cron is the in-process background-job scheduler. It is nil when
	// CRON_ENABLED=false; the App lifecycle guards against that.
	cron *cron.Runner
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

		productRepo      = repositories.NewProductRepository(db)
		productImageRepo = repositories.NewProductImageRepository(db)
		contentMediaRepo = repositories.NewContentMediaRepository(db)
		variantRepo      = repositories.NewVariantRepository(db)
		categoryRepo     = repositories.NewCategoryRepository(db)
		brandRepo        = repositories.NewBrandRepository(db)
		tagRepo          = repositories.NewTagRepository(db)

		orderRepo       = repositories.NewOrderRepository(db)
		orderItemRepo   = repositories.NewOrderItemRepository(db)
		cartRepo        = repositories.NewCartRepository(db)
		couponRepo      = repositories.NewCouponRepository(db)
		couponUsageRepo = repositories.NewCouponUsageRepository(db)

		shippingZoneRepo   = repositories.NewShippingZoneRepository(db)
		shippingMethodRepo = repositories.NewShippingMethodRepository(db)

		wishlistRepo     = repositories.NewWishlistRepository(db)
		walletRepo       = repositories.NewWalletRepository(db)
		alertRepo        = repositories.NewAlertRepository(db)
		tasteRepo        = repositories.NewTasteProfileRepository(db)
		loyaltyRepo      = repositories.NewLoyaltyRepository(db)
		referralRepo     = repositories.NewReferralRepository(db)
		giftCardRepo     = repositories.NewGiftCardRepository(db)
		subscriptionRepo = repositories.NewSubscriptionRepository(db)
		reviewRepo       = repositories.NewReviewRepository(db)
		reviewImageRepo  = repositories.NewReviewImageRepository(db)
		paymentRepo      = repositories.NewPaymentTransactionRepository(db)
		inventoryRepo    = repositories.NewInventoryRepository(db)
		movementRepo     = repositories.NewMovementRepository(db)

		blogRepo         = repositories.NewBlogRepository(db)
		blogCategoryRepo = repositories.NewBlogCategoryRepository(db)

		heroSlideRepo = repositories.NewHeroSlideRepository(db)

		siteSettingsRepo = repositories.NewSiteSettingsRepository(db)

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
	smsSender := sms.New(cfg, log)
	eventService := services.NewEventService(eventRepo)

	// Media: originals live under MediaRoot, rendered variants under MediaCacheDir.
	// Both directories are created at boot; a failure here is a fatal misconfig.
	mediaStore, err := storage.NewLocalStorage(cfg.MediaRoot)
	if err != nil {
		log.Fatal("media storage init", zap.Error(err))
	}
	mediaCache, err := storage.NewLocalStorage(cfg.MediaCacheDir)
	if err != nil {
		log.Fatal("media cache init", zap.Error(err))
	}
	allowedFormats := make(map[imaging.Format]bool, len(cfg.MediaAllowedFormats))
	for _, f := range cfg.MediaAllowedFormats {
		if fm, e := imaging.ParseFormat(strings.TrimSpace(f)); e == nil {
			allowedFormats[fm] = true
		}
	}
	mediaService := services.NewMediaService(
		mediaStore, mediaCache, productImageRepo, productRepo, contentMediaRepo, imaging.New(),
		services.MediaConfig{
			MaxUploadBytes: int64(cfg.MediaMaxUploadMB) * 1024 * 1024,
			DefaultQuality: cfg.MediaDefaultQuality,
			MaxDimension:   cfg.MediaMaxDimension,
			AllowedOutput:  allowedFormats,
		}, log)

	// Analytics roll-up and recommendation services are pulled into named vars so
	// the cron runner (built below) can reach them as well as the HTTP handlers.
	productStatsService := services.NewDailyProductStatsService(dailyProductStatsRepo)
	revenueStatsService := services.NewDailyRevenueStatsService(dailyRevenueStatsRepo)
	searchSummaryService := services.NewSearchSummaryService(searchSummaryRepo)
	recommendationService := services.NewRecommendationService(recommendationRepo)

	// Wallet + loyalty are built before payment so the payment service can award
	// points on a confirmed payment, and loyalty can redeem points into the wallet.
	walletService := services.NewWalletService(walletRepo)
	loyaltyService := services.NewLoyaltyService(
		loyaltyRepo, walletService,
		cfg.LoyaltyEarnDivisor, cfg.LoyaltyRedeemValue, cfg.LoyaltySignupBonus,
	)
	referralService := services.NewReferralService(referralRepo, loyaltyService, cfg.LoyaltyReferralReward)
	giftCardService := services.NewGiftCardService(giftCardRepo, walletService)

	// Inventory is constructed first: the payment service deducts stock inside the
	// confirm transaction, and the order service reserves stock during checkout.
	inventoryService := services.NewInventoryService(inventoryRepo, movementRepo)
	paymentService := services.NewPaymentService(paymentRepo, orderRepo, inventoryService, loyaltyService, referralService)
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
		SMS:           smsSender,
		OTPTTL:        cfg.OTPTTL,
		RefreshTTL:    time.Duration(cfg.JWTRefreshTokenTTL) * time.Minute,
		WebhookSecret: cfg.CryptoWebhookKey,

		User:          services.NewUserService(userRepo),
		PasswordReset: services.NewPasswordResetService(passwordResetRepo, userRepo, mailer),
		Address:       services.NewAddressService(addressRepo),
		TasteProfile:  services.NewTasteProfileService(tasteRepo),

		Product:  services.NewProductService(productRepo),
		Media:    mediaService,
		Variant:  services.NewVariantService(variantRepo),
		Category: services.NewCategoryService(categoryRepo),
		Brand:    services.NewBrandService(brandRepo),
		Tag:      services.NewTagService(tagRepo),

		Cart:         services.NewCartService(cartRepo, variantRepo, inventoryRepo, db),
		Coupon:       services.NewCouponService(couponRepo),
		Order:        orderService,
		Wishlist:     services.NewWishlistService(wishlistRepo),
		Wallet:       walletService,
		Loyalty:      loyaltyService,
		Referral:     referralService,
		GiftCard:     giftCardService,
		Subscription: services.NewSubscriptionService(subscriptionRepo),
		Alert:        services.NewAlertService(alertRepo, variantRepo, inventoryRepo),
		Review:       services.NewReviewService(reviewRepo, reviewImageRepo),
		Shipping:     services.NewShippingService(shippingZoneRepo, shippingMethodRepo),
		Payment:      paymentService,
		Inventory:    inventoryService,

		Blog:         services.NewBlogService(blogRepo, db),
		BlogCategory: services.NewBlogCategoryService(blogCategoryRepo),

		HeroSlide: services.NewHeroSlideService(heroSlideRepo),

		SiteSettings: services.NewSiteSettingsService(siteSettingsRepo),

		Recipe:         services.NewRecipeService(recipeRepo, db),
		Recommendation: recommendationService,

		Event:         eventService,
		ProductStats:  productStatsService,
		RevenueStats:  revenueStatsService,
		SearchSummary: searchSummaryService,
	}

	return &container{
		handler: handlers.New(deps),
		jwt:     jwt,
		queue:   analytics.NewQueue(eventService),
		cache:   cacheStore,
		dbs:     dbs,
		cron: buildCron(cfg, dbs, productStatsService, revenueStatsService,
			searchSummaryService, recommendationService, alertRepo, subscriptionRepo, mailer),
	}
}

// buildCron assembles the in-process scheduler with every background job wired
// to its configured schedule. It returns nil when CRON_ENABLED=false, so the API
// can run without the scheduler (e.g. when a dedicated worker owns the jobs).
//
// The analytics roll-ups read/write the analytics database; the recommendation
// refresh works against the main database through its service. Schedules are
// 6-field cron expressions evaluated in UTC (see configs.Config).
func buildCron(
	cfg *config.Config,
	dbs *database.Connections,
	productStats *services.DailyProductStatsService,
	revenueStats *services.DailyRevenueStatsService,
	searchSummary *services.SearchSummaryService,
	recommendation services.RecommendationService,
	alertRepo repositories.AlertRepository,
	subscriptionRepo repositories.SubscriptionRepository,
	mailer notify.Mailer,
) *cron.Runner {
	if !cfg.CronEnabled {
		return nil
	}

	runner := cron.NewRunner()

	adb := dbs.AnalyticsDB
	runner.Register(cfg.CronProductStatsSchedule, "product_stats",
		cron.NewProductStatsCronJob(adb, productStats).Run)
	runner.Register(cfg.CronRevenueStatsSchedule, "revenue_stats",
		cron.NewRevenueCronJob(adb, revenueStats).Run)
	runner.Register(cfg.CronSearchSummarySchedule, "search_summary",
		cron.NewSearchCronJob(adb, searchSummary).Run)
	runner.Register(cfg.CronRecsRefreshSchedule, "recommendation_refresh",
		cron.NewRecommendationRefreshJob(recommendation,
			cfg.CronRecsRefreshWindowDays, cfg.CronRecsRefreshMaxUsers).Run)

	// Housekeeping: prune expired idempotency keys from the main DB.
	runner.Register(cfg.CronIdempotencyCleanupSchedule, "idempotency_cleanup",
		cron.NewIdempotencyCleanupJob(dbs.DB, cfg.IdempotencyKeyRetention).Run)

	// Product alerts: notify customers when a watched variant restocks or drops
	// in price.
	runner.Register(cfg.CronAlertCheckSchedule, "alert_check",
		cron.NewAlertCheckJob(alertRepo, mailer, cfg.PublicSiteURL).Run)

	// Subscriptions: email customers whose cellar box is due and roll the date.
	runner.Register(cfg.CronSubscriptionSchedule, "subscription_renewal",
		cron.NewSubscriptionRenewalJob(subscriptionRepo, mailer, cfg.PublicSiteURL).Run)

	return runner
}
