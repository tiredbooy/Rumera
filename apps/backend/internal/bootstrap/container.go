package bootstrap

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	config "github.com/tiredbooy/configs"
	analyticscapture "github.com/tiredbooy/internal/analytics"
	"github.com/tiredbooy/internal/corn"
	"github.com/tiredbooy/internal/eventconsumers"
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
	"github.com/tiredbooy/internal/handlers"
	"github.com/tiredbooy/internal/notifications"
	notifpg "github.com/tiredbooy/internal/notifications/postgres"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/database"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/meili"
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
	queue   *analyticscapture.Queue
	cache   cache.Store
	dbs     *database.Connections
	// cron is the in-process background-job scheduler. It is nil when
	// CRON_ENABLED=false; the App lifecycle guards against that.
	cron *cron.Runner
	// events is the domain-fact bus. Non-nil even when the worker is disabled,
	// because producers still need the emitter.
	events *eventSubsystem
}

// build wires the whole dependency graph from the live database connections.
// Feature packages own their repository → service → handler constructors
// (features/<name>.New / Wire); this function only orders cross-feature deps
// and assembles handlers.Deps for the routes composer.
func build(cfg *config.Config, log *zap.Logger, dbs *database.Connections, cacheStore cache.Store, meiliClient *meili.Client) *container {
	db := dbs.DB
	adb := dbs.AnalyticsDB

	// ── Platform (shared infrastructure) ─────────────────────────────────────
	jwt := token.NewManager(cfg, log)
	mailer := notify.New(cfg, log)
	smsSender := sms.New(cfg, log)
	v := validator.New()
	notifDispatcher := buildNotifications(cfg, log, db, smsSender, mailer)
	// The domain-fact bus. Built here so the emitter can be injected into the
	// money services below; its consumers are registered further down, once the
	// services they call exist.
	eventSys := newEventSubsystem(cfg, log, db)

	// ── Media storage + feature ──────────────────────────────────────────────
	// Originals live under MediaRoot, rendered variants under MediaCacheDir.
	mediaStore, err := storage.NewLocalStorage(cfg.MediaRoot)
	if err != nil {
		log.Fatal("media storage init", zap.Error(err))
	}
	mediaCache, err := storage.NewLocalStorage(cfg.MediaCacheDir)
	if err != nil {
		log.Fatal("media cache init", zap.Error(err))
	}
	// The pre-057c render namespace cannot be mapped back to source objects, so it
	// is discarded once. Current source-addressable derivatives use render-v2.
	if err := mediaCache.DeletePrefix(context.Background(), "render"); err != nil {
		log.Warn("media legacy cache cleanup", zap.Error(err))
	}

	productRepo, productImageRepo := product.NewRepos(db)
	mediaHandler, mediaLifecycle, mediaSvc := media.New(
		db, mediaStore, mediaCache, productImageRepo, productRepo,
		mediaConfig(cfg), log, cacheStore, v,
	)

	// ── Analytics (analytics DB) ─────────────────────────────────────────────
	analyticsMod := featanalytics.New(adb, v)

	// ── Identity ─────────────────────────────────────────────────────────────
	userHandler, userSvc := users.New(db, v)
	capabilitySvc := rbac.NewService(rbac.NewRepository(db))
	rbacHandler := rbac.NewHandler(capabilitySvc, v)
	addressHandler, addressSvc := addresses.New(db, v)

	// ── Account / loyalty graph ──────────────────────────────────────────────
	// Wallet + loyalty before payment so payments can award points and loyalty
	// can redeem into the wallet.
	walletHandler, walletSvc := wallet.New(db, userSvc, v)
	loyaltyHandler, loyaltySvc := loyalty.New(
		db, walletSvc,
		cfg.LoyaltyEarnDivisor, cfg.LoyaltyRedeemValue, cfg.LoyaltySignupBonus,
		cfg.LoyaltyReviewBonus, cfg.LoyaltyBirthdayBonus, cfg.LoyaltyReferralReward,
		cfg.LoyaltyBirthdayTZ,
		v,
	)
	referralHandler, referralSvc := referral.New(db, loyaltySvc, cfg.LoyaltyReferralReward, v)
	giftCardHandler, giftCardSvc := giftcard.New(db, walletSvc, v)
	giftCardSvc = giftCardSvc.
		WithMailer(mailer).
		WithDispatcher(notifDispatcher).
		WithPurchaserEmailLookup(giftcard.EmailByUserIDFunc(func(ctx context.Context, userID int64) (string, error) {
			au, err := userSvc.GetAuthUserByUID(ctx, userID)
			if err != nil {
				return "", err
			}
			u, err := userSvc.GetByID(ctx, au.UserID)
			if err != nil {
				return "", err
			}
			return u.Email, nil
		}))
	subscriptionHandler, subscriptionRepo := subscription.New(db, v)
	wishlistHandler := wishlist.New(db, v)
	tasteHandler := taste.New(db, v)

	// ── Inventory + catalog ──────────────────────────────────────────────────
	inventoryHandler, inventorySvc, inventoryRepo := inventory.New(db, v)
	variantHandler, variantRepo := variant.New(db, inventoryRepo, mediaLifecycle, v, cacheStore)
	productHandler := product.New(productRepo, mediaLifecycle, mediaSvc, v, cacheStore, log)
	categoryHandler := category.New(db, mediaLifecycle, v, cacheStore, log)
	brandHandler := brand.New(db, v)
	tagHandler := tag.New(db, v)
	optionHandler := option.New(db, v)
	reviewHandler := reviews.New(db, v, loyaltySvc)

	// ── Content ──────────────────────────────────────────────────────────────
	heroSlideHandler := hero.New(db, mediaLifecycle, v)
	blogHandler := blog.New(db, mediaLifecycle, v)
	recipeHandler := recipes.New(db, mediaLifecycle, v, cacheStore, log)
	siteSettingsHandler, siteSettingsSvc := site_settings.New(db, v, cacheStore, log)
	recommendationHandler, recommendationSvc := recommendations.New(db, v)

	// ── Commerce ─────────────────────────────────────────────────────────────
	// Inventory first: payments deduct stock on confirm; orders reserve at checkout.
	couponHandler, couponRepo, couponUsageRepo := coupons.New(db, v)
	shippingHandler, shippingSvc := shipping.New(db, v)
	cartHandler, cartRepo := cart.New(db, variantRepo, productRepo, inventoryRepo, v)
	alertHandler, alertRepo := alerts.New(db, variantRepo, inventoryRepo, v)

	// payments.Service before orders.Service (non-wallet rails create pending
	// payments). Wallet checkout debits via WalletPurchaser on the order TX.
	// order repos exist first so payments can MarkAsPaid / read stock lines.
	// Orderless Confirm: wtop-* → wallet (PH-041a); gbuy-* → gift card (PH-042a).
	orderRepo, orderItemRepo := orders.NewRepos(db)
	paymentSvc := payments.NewServiceFromDB(db, orderRepo, inventorySvc, loyaltySvc, referralSvc, walletSvc, giftCardSvc, cfg.PaymentStartBaseURL).
		WithEventPublisher(eventSys.emitter)
	// Wire payment starters after paymentSvc exists (avoid feature import cycles).
	walletHandler = walletHandler.WithTopUp(walletTopUpAdapter{paymentSvc})
	giftCardHandler = giftCardHandler.WithPurchase(giftCardPurchaseAdapter{paymentSvc})
	orderHandler, orderSvc := orders.NewWithRepos(orderRepo, orderItemRepo, orders.Deps{
		Cart:          cartRepo,
		Coupons:       couponRepo,
		CouponUsage:   couponUsageRepo,
		Shipping:      shippingSvc,
		Addresses:     addressSvc,
		Inventory:     inventorySvc,
		Payment:       paymentSvc,
		GiftConfig:    siteSettingsSvc,
		Clawback:      loyaltySvc,
		Users:         userSvc,
		Notifications: notifDispatcher,
		Mail:          mailer,
		Validator:     v,
		Wallet:        walletSvc,
		Events:        eventSys.emitter,
	})
	// *orderService implements payments.OrderItemsLookup (MarkOrderPaymentFailed
	// lives on the concrete type — not on orders.Service; service.go is sibling-owned).
	orderLookup, ok := orderSvc.(payments.OrderItemsLookup)
	if !ok {
		log.Fatal("orders service does not implement payments.OrderItemsLookup")
	}
	paymentHandler := payments.NewHTTP(paymentSvc, orderLookup, inventorySvc, cfg.CryptoWebhookKey, v)

	// ── Auth (after users + loyalty for signup bonus + session kill) ──────────
	authHandler := auth.Wire(auth.Deps{
		DB:            db,
		Users:         userSvc,
		UserRepo:      users.NewRepository(db),
		Validator:     v,
		JWT:           jwt,
		Log:           log,
		Cache:         cacheStore,
		Mail:          mailer,
		SMS:           smsSender,
		Notifications: notifDispatcher,
		OTPTTL:        cfg.OTPTTL,
		RefreshTTL:    time.Duration(cfg.JWTRefreshTokenTTL) * time.Minute,
		Loyalty:       loyaltySvc,
	})

	// ── Composition root for routes ──────────────────────────────────────────
	handler := handlers.New(handlers.Deps{
		User:         userSvc,
		Capabilities: capabilitySvc,

		Auth:             authHandler,
		Users:            userHandler,
		RBAC:             rbacHandler,
		Addresses:        addressHandler,
		TasteProfiles:    tasteHandler,
		Products:         productHandler,
		MediaHTTP:        mediaHandler,
		Variants:         variantHandler,
		Options:          optionHandler,
		Categories:       categoryHandler,
		Brands:           brandHandler,
		Tags:             tagHandler,
		Carts:            cartHandler,
		Alerts:           alertHandler,
		Coupons:          couponHandler,
		OrderHTTP:        orderHandler,
		Wishlists:        wishlistHandler,
		Wallets:          walletHandler,
		Loyalties:        loyaltyHandler,
		Referrals:        referralHandler,
		GiftCards:        giftCardHandler,
		Subscriptions:    subscriptionHandler,
		Reviews:          reviewHandler,
		Shippings:        shippingHandler,
		Payments:         paymentHandler,
		Inventories:      inventoryHandler,
		Blogs:            blogHandler,
		HeroSlides:       heroSlideHandler,
		SiteSettingsHTTP: siteSettingsHandler,
		Recipes:          recipeHandler,
		Recommendations:  recommendationHandler,
		Analytics:        analyticsMod.Handler,
	})

	// Consumers last: they call the services assembled above. Fields left unset
	// stay unregistered — see OrderPaidHandlers on why a nil pointer must not be
	// passed as a non-nil interface.
	orderStatus, _ := orderSvc.(eventconsumers.OrderStatusReader)
	eventSys.registerConsumers(eventconsumers.OrderPaidDeps{
		Receipt:  orderHandler.Receipt,
		Loyalty:  loyaltySvc,
		Referral: referralSvc,
		Intents:  payments.NewRepository(db),
		Orders:   orderStatus,
		Recs:     recommendationSvc,
	})
	eventSys.buildWorker(false)

	return &container{
		handler: handler,
		jwt:     jwt,
		events:  eventSys,
		queue:   analyticscapture.NewQueue(analyticsMod.Events),
		cache:   cacheStore,
		dbs:     dbs,
		cron: buildCron(cfg, dbs,
			analyticsMod.ProductStats, analyticsMod.RevenueStats, analyticsMod.SearchSummary,
			recommendationSvc, alertRepo, subscriptionRepo, mailer, notifDispatcher,
			productRepo, meiliClient, log, loyaltySvc, orderSvc, eventSys),
	}
}

// mediaConfig maps process config into the media feature Config.
func mediaConfig(cfg *config.Config) media.Config {
	allowedFormats := make(map[imaging.Format]bool, len(cfg.MediaAllowedFormats))
	for _, f := range cfg.MediaAllowedFormats {
		if fm, e := imaging.ParseFormat(strings.TrimSpace(f)); e == nil {
			allowedFormats[fm] = true
		}
	}
	return media.Config{
		MaxUploadBytes:     int64(cfg.MediaMaxUploadMB) * 1024 * 1024,
		DefaultQuality:     cfg.MediaDefaultQuality,
		MaxDimension:       cfg.MediaMaxDimension,
		MaxSourceDimension: cfg.MediaMaxSourceDimension,
		MaxSourcePixels:    cfg.MediaMaxSourcePixels,
		AllowedOutput:      allowedFormats,
	}
}

// buildNotifications selects inline (default) or async outbox delivery.
func buildNotifications(
	cfg *config.Config,
	log *zap.Logger,
	db *pgxpool.Pool,
	smsSender sms.Sender,
	mailer notify.Mailer,
) *notifications.Dispatcher {
	notifMode := strings.ToLower(strings.TrimSpace(cfg.NotificationsMode))
	if notifMode == "" {
		notifMode = "inline"
	}
	if notifMode == "async" {
		log.Info("notifications mode: async (outbox → Kafka worker)")
		store := notifpg.NewStore(db)
		return &notifications.Dispatcher{
			Mode:       "async",
			Outbox:     store,
			SMS:        smsSender,
			Mail:       mailer,
			Deliveries: store,
		}
	}
	// Inline still gets the delivery ledger: it is what stops a retrying event
	// consumer from sending the same receipt twice. Without it the idempotency
	// key is computed and discarded on this path.
	return &notifications.Dispatcher{
		Mode:       "inline",
		SMS:        smsSender,
		Mail:       mailer,
		Deliveries: notifpg.NewStore(db),
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
	productStats *featanalytics.DailyProductStatsService,
	revenueStats *featanalytics.DailyRevenueStatsService,
	searchSummary *featanalytics.SearchSummaryService,
	recommendation recommendations.Service,
	alertRepo alerts.Repository,
	subscriptionRepo subscription.Repository,
	mailer notify.Mailer,
	notif *notifications.Dispatcher,
	productRepo product.Repository,
	meiliClient *meili.Client,
	log *zap.Logger,
	loyaltySvc *loyalty.Service,
	orderSvc orders.Service,
	eventSys *eventSubsystem,
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

	// Housekeeping: prune settled domain facts. Only events whose consumptions
	// are ALL done are eligible, so anything still pending, retrying or
	// dead-lettered stays replayable regardless of age.
	if eventSys != nil && cfg.EventsEnabled {
		runner.Register(cfg.CronEventsPruneSchedule, "events_prune", eventSys.prune)
	}

	// Product alerts: notify customers when a watched variant restocks or drops
	// in price.
	runner.Register(cfg.CronAlertCheckSchedule, "alert_check",
		cron.NewAlertCheckJob(alertRepo, mailer, cfg.PublicSiteURL).WithDispatcher(notif).Run)

	// Subscriptions: email customers whose cellar box is due and roll the date.
	runner.Register(cfg.CronSubscriptionSchedule, "subscription_renewal",
		cron.NewSubscriptionRenewalJob(subscriptionRepo, mailer, cfg.PublicSiteURL).WithDispatcher(notif).Run)

	// Meili full reindex (PH-030b readiness). Only when client connected at boot.
	// Does not switch storefront search off Postgres ILIKE.
	if meiliClient != nil && productRepo != nil {
		indexer := product.NewMeiliIndexer(productRepo, meiliClient, log)
		runner.Register(cfg.CronMeiliReindexSchedule, "meili_reindex",
			cron.NewMeiliReindexJob(indexer).Run)
	}

	// Loyalty birthday awards (PH-040b) — Asia/Tehran calendar by default.
	if loyaltySvc != nil {
		runner.Register(cfg.CronLoyaltyBirthdaySchedule, "loyalty_birthday",
			cron.NewLoyaltyBirthdayJob(loyaltySvc).Run)
	}

	// Unpaid reservation TTL (PR-020c). Hardcoded every 5 minutes — do not
	// add CRON_* env here (config.go is sibling-owned).
	if expirer, ok := orderSvc.(cron.ReservationExpirer); ok {
		runner.Register("0 */5 * * * *", "reservation_ttl",
			cron.NewReservationTTLJob(expirer).Run)
	} else if orderSvc != nil {
		log.Warn("reservation ttl job: order service does not implement ReservationExpirer")
	}

	return runner
}

// walletTopUpAdapter adapts payments.Service to wallet.TopUpGateway without a
// package cycle (wallet must not import payments).
type walletTopUpAdapter struct {
	svc *payments.Service
}

func (a walletTopUpAdapter) CreateWalletTopUp(ctx context.Context, userID int64, amount float64) (*wallet.TopUpIntentView, error) {
	intent, err := a.svc.CreateWalletTopUp(ctx, userID, amount)
	if err != nil {
		return nil, err
	}
	return &wallet.TopUpIntentView{
		PaymentID:     intent.PaymentID,
		TransactionID: intent.TransactionID,
		Amount:        intent.Amount,
		Currency:      intent.Currency,
		Status:        string(intent.Status),
		PaymentURL:    intent.PaymentURL,
	}, nil
}

// giftCardPurchaseAdapter adapts payments.Service to giftcard.PurchaseGateway.
type giftCardPurchaseAdapter struct {
	svc *payments.Service
}

func (a giftCardPurchaseAdapter) CreateGiftCardPurchase(ctx context.Context, userID int64, amount float64) (*giftcard.PurchaseIntentView, error) {
	intent, err := a.svc.CreateGiftCardPurchase(ctx, userID, amount)
	if err != nil {
		return nil, err
	}
	return &giftcard.PurchaseIntentView{
		PaymentID:     intent.PaymentID,
		TransactionID: intent.TransactionID,
		Amount:        intent.Amount,
		Currency:      intent.Currency,
		Status:        string(intent.Status),
		PaymentURL:    intent.PaymentURL,
	}, nil
}
