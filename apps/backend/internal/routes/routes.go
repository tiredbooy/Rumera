package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/handlers"
	mw "github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/token"
)

// Setup registers the full API surface. Routes are organised into three trust
// tiers:
//
//   - public     — no authentication (catalogue browsing, auth endpoints)
//   - customer   — any authenticated user (mw.Auth)
//   - admin      — authenticated + role=admin (mw.Auth + mw.RequireRole)
func Setup(r *gin.Engine, h *handlers.Handler, jwt token.Manager, store cache.Store, idempotency gin.HandlerFunc) {
	r.GET("/health", func(c *gin.Context) {
		response.OK(c, gin.H{"status": "ok"})
	})

	// Public on-the-fly image transform endpoint (outside /api/v1): serves
	// resized/recompressed variants of stored originals.
	r.GET("/media/*key", h.ServeMedia)

	v1 := r.Group("/api/v1")

	// Webhooks are unauthenticated but signature-verified; keep them outside the
	// JWT-guarded groups. The idempotency guard makes at-least-once gateway
	// callbacks safe — a replayed payment notification returns the stored
	// response instead of confirming the order (and deducting stock) twice.
	v1.POST("/webhooks/payment", idempotency, h.PaymentWebhook)

	registerAuthRoutes(v1, h, jwt, store)
	registerPublicRoutes(v1, h)
	registerCustomerRoutes(v1, h, jwt)
	registerAdminRoutes(v1, h, jwt)

	r.NoRoute(func(c *gin.Context) {
		response.Error(c, response.ErrNotFound)
	})
}

func registerAuthRoutes(v1 *gin.RouterGroup, h *handlers.Handler, jwt token.Manager, store cache.Store) {
	auth := v1.Group("/auth")

	// Throttle credential-sensitive endpoints: max 10 attempts per IP per minute.
	throttle := mw.LoginRateLimit(store, 10, time.Minute)
	auth.POST("/login", throttle, h.Login)
	auth.POST("/register", throttle, h.Register)
	auth.POST("/password/forgot", throttle, h.ForgotPassword)

	// SMS OTP login (phone-first).
	auth.POST("/otp/request", throttle, h.RequestOTP)
	auth.POST("/otp/verify", throttle, h.VerifyOTP)

	auth.POST("/refresh", h.Refresh)
	auth.POST("/logout", h.Logout)
	auth.GET("/password/validate", h.ValidateResetToken)
	auth.POST("/password/reset", h.ResetPassword)

	me := auth.Group("")
	me.Use(mw.Auth(jwt))
	me.GET("/me", h.Me)
	me.PATCH("/me", h.UpdateProfile)
}

func registerPublicRoutes(v1 *gin.RouterGroup, h *handlers.Handler) {
	// Products
	v1.GET("/products", h.ListProducts)
	v1.GET("/products/:id", h.GetProduct)
	v1.GET("/products/:id/tags", h.ProductTags)
	v1.GET("/products/:id/images", h.ProductImages)
	v1.GET("/products/:id/variants", h.ProductVariants)
	v1.GET("/products/:id/reviews", h.ProductReviews)
	v1.GET("/products/:id/reviews/summary", h.ProductRatingSummary)

	// Variants
	v1.GET("/variants/:id", h.GetVariant)
	v1.GET("/variants/:id/options", h.VariantOptions)
	v1.GET("/variants/:id/images", h.VariantImages)

	// Categories
	v1.GET("/categories", h.ListCategories)
	v1.GET("/categories/tree", h.CategoryTree)
	v1.GET("/categories/:id", h.GetCategory)
	v1.GET("/categories/:id/children", h.CategoryChildren)

	// Brands & tags
	v1.GET("/brands", h.ListBrands)
	v1.GET("/brands/:id", h.GetBrand)
	v1.GET("/tags", h.ListTags)
	v1.GET("/tags/:id", h.GetTag)

	// Reviews
	v1.GET("/reviews/:id", h.GetReview)

	// Hero slides (storefront home carousel — active slides only)
	v1.GET("/hero-slides", h.ListHeroSlides)

	// Site settings (storefront-safe subset: store profile, contact, social,
	// shipping note, SEO defaults, maintenance flag)
	v1.GET("/settings", h.GetSiteSettings)

	// Blog
	v1.GET("/blogs", h.ListBlogs)
	v1.GET("/blogs/:slug", h.GetBlogBySlug)
	v1.GET("/blog-categories", h.ListBlogCategories)
	v1.GET("/blog-categories/:id", h.GetBlogCategory)

	// Recipes (content commerce). Static segments registered before the :slug
	// wildcard so they take precedence.
	v1.GET("/recipes", h.ListRecipes)
	v1.GET("/recipes/featured", h.FeaturedRecipes)
	v1.GET("/recipes/sitemap", h.RecipeSitemap)
	v1.GET("/recipes/:slug", h.GetRecipeBySlug)
	v1.GET("/recipes/:slug/related", h.RelatedRecipes)
	v1.GET("/products/:id/recipes", h.ProductRecipes)

	// Recommendations (public surfaces — work for guests too)
	v1.GET("/recommendations/trending", h.TrendingRecommendations)
	v1.GET("/recommendations/products/:id/similar", h.SimilarProducts)
	v1.GET("/recommendations/products/:id/frequently-bought-together", h.FrequentlyBoughtTogether)

	// Shipping (catalogue + checkout estimation)
	v1.GET("/shipping/zones", h.ListShippingZones)
	v1.GET("/shipping/zones/:id", h.GetShippingZone)
	v1.GET("/shipping/zones/:id/methods", h.ListZoneMethods)
	v1.GET("/shipping/methods/:id", h.GetShippingMethod)
	v1.GET("/shipping/available", h.AvailableShippingMethods)
}

func registerCustomerRoutes(v1 *gin.RouterGroup, h *handlers.Handler, jwt token.Manager) {
	c := v1.Group("")
	c.Use(mw.Auth(jwt))

	// Cart
	c.GET("/cart", h.GetCart)
	c.DELETE("/cart", h.ClearCart)
	c.POST("/cart/items", h.AddCartItem)
	c.POST("/cart/items/bulk", h.AddCartItems)
	c.PATCH("/cart/items/:id", h.UpdateCartItem)
	c.DELETE("/cart/items/:id", h.RemoveCartItem)

	// Referrals
	c.GET("/referrals/me", h.GetMyReferral)
	c.POST("/referrals/claim", h.ClaimReferral)

	// Gift cards (redeem into wallet)
	c.POST("/gift-cards/redeem", h.RedeemGiftCard)

	// Subscriptions (cellar box)
	c.GET("/subscriptions", h.ListSubscriptions)
	c.POST("/subscriptions", h.CreateSubscription)
	c.PATCH("/subscriptions/:id", h.UpdateSubscription)

	// Loyalty (Cellar Club)
	c.GET("/loyalty", h.GetLoyaltyAccount)
	c.GET("/loyalty/transactions", h.GetLoyaltyTransactions)
	c.POST("/loyalty/redeem", h.RedeemLoyaltyPoints)

	// Taste profile (personalisation quiz)
	c.GET("/me/taste-profile", h.GetTasteProfile)
	c.PUT("/me/taste-profile", h.SaveTasteProfile)

	// Product alerts (back-in-stock / price-drop)
	c.GET("/alerts", h.ListAlerts)
	c.POST("/alerts", h.CreateAlert)
	c.DELETE("/alerts/:id", h.DeleteAlert)

	// Coupons (checkout preview)
	c.POST("/coupons/validate", h.ValidateCoupon)

	// Addresses
	c.POST("/addresses", h.CreateAddress)
	c.GET("/addresses", h.ListAddresses)
	c.GET("/addresses/:id", h.GetAddress)
	c.PATCH("/addresses/:id", h.UpdateAddress)
	c.DELETE("/addresses/:id", h.DeleteAddress)
	c.POST("/addresses/:id/default", h.SetDefaultAddress)

	// Wishlist
	c.GET("/wishlist", h.GetWishlist)
	c.DELETE("/wishlist", h.ClearWishlist)
	c.POST("/wishlist/items", h.AddWishlistItem)
	c.DELETE("/wishlist/items/:id", h.RemoveWishlistItem)
	c.GET("/wishlist/has/:variantID", h.HasWishlistItem)

	// Wallet
	c.GET("/wallet", h.GetWallet)
	// NOTE: no public /wallet/deposit — wallet credit must originate only from a
	// verified payment, refund, gift-card/loyalty redemption or an admin action.
	// A self-service deposit let any signed-in user mint spendable balance.
	c.POST("/wallet/withdraw", h.WithdrawFromWallet)
	c.GET("/wallet/transactions", h.WalletTransactions)

	// Orders
	c.POST("/orders", h.CreateOrder)
	c.GET("/orders", h.ListMyOrders)
	c.GET("/orders/:id", h.GetMyOrder)
	c.POST("/orders/:id/cancel", h.CancelOrder)

	// Recommendations (personalized — requires identity)
	c.GET("/recommendations/for-you", h.ForYou)
	c.POST("/recommendations/interactions", h.RecordInteraction)
	c.GET("/recommendations/profile", h.GetMyRecommendationProfile)
	c.POST("/recommendations/profile/recompute", h.RecomputeMyRecommendationProfile)

	// Reviews
	c.POST("/reviews", h.CreateReview)
	c.PATCH("/reviews/:id", h.UpdateReview)
	c.DELETE("/reviews/:id", h.DeleteReview)
	c.POST("/reviews/:id/react", h.ReactToReview)
	c.GET("/reviews/:id/images", h.ReviewImages)
	c.POST("/reviews/:id/images", h.AddReviewImage)
}

func registerAdminRoutes(v1 *gin.RouterGroup, h *handlers.Handler, jwt token.Manager) {
	a := v1.Group("/admin")
	a.Use(mw.Auth(jwt), mw.RequireRole("admin"))

	// Users
	a.GET("/users", h.ListUsers)
	a.GET("/users/:userID", h.GetUser)
	a.PATCH("/users/:userID", h.UpdateUser)
	a.DELETE("/users/:userID", h.DeleteUser)

	// Products
	a.POST("/products", h.CreateProduct)
	a.PATCH("/products/:id", h.UpdateProduct)
	a.DELETE("/products/:id", h.DeleteProduct)
	a.POST("/products/:id/tags", h.AttachProductTags)
	a.PUT("/products/:id/tags", h.SyncProductTags)
	a.DELETE("/products/:id/tags", h.DetachProductTags)
	a.POST("/products/:id/variants", h.CreateVariant)

	// Product images (admin media pipeline)
	a.GET("/products/:id/images", h.ListProductImages)
	a.POST("/products/:id/images", h.UploadProductImage)
	a.PUT("/products/:id/images/order", h.ReorderProductImages)
	a.PATCH("/products/:id/images/:imageId", h.UpdateProductImage)
	a.PUT("/products/:id/images/:imageId/primary", h.SetPrimaryProductImage)
	a.DELETE("/products/:id/images/:imageId", h.DeleteProductImage)

	// Variants
	a.PATCH("/variants/:id", h.UpdateVariant)
	a.DELETE("/variants/:id", h.DeleteVariant)
	a.POST("/variants/:id/options", h.AttachVariantOptions)

	// Categories
	a.POST("/categories", h.CreateCategory)
	a.PATCH("/categories/:id", h.UpdateCategory)
	a.DELETE("/categories/:id", h.DeleteCategory)

	// Brands
	a.POST("/brands", h.CreateBrand)
	a.PATCH("/brands/:id", h.UpdateBrand)
	a.DELETE("/brands/:id", h.DeleteBrand)

	// Tags
	a.POST("/tags", h.CreateTag)
	a.PATCH("/tags/:id", h.UpdateTag)
	a.DELETE("/tags/:id", h.DeleteTag)

	// Coupons
	// Gift cards (issue)
	a.POST("/gift-cards", h.CreateGiftCards)

	a.POST("/coupons", h.CreateCoupon)
	a.GET("/coupons", h.ListCoupons)
	a.GET("/coupons/:id", h.GetCoupon)
	a.PATCH("/coupons/:id", h.UpdateCoupon)
	a.DELETE("/coupons/:id", h.DeleteCoupon)

	// Orders
	a.GET("/orders", h.ListOrders)
	a.GET("/orders/:id", h.GetOrder)
	a.PATCH("/orders/:id/status", h.UpdateOrderStatus)

	// Reviews
	a.GET("/reviews", h.ListReviewsAdmin)
	a.PATCH("/reviews/:id/status", h.UpdateReviewStatus)

	// Shipping
	a.POST("/shipping/zones", h.CreateShippingZone)
	a.PATCH("/shipping/zones/:id", h.UpdateShippingZone)
	a.DELETE("/shipping/zones/:id", h.DeleteShippingZone)
	a.POST("/shipping/zones/:id/methods", h.CreateShippingMethod)
	a.PATCH("/shipping/methods/:id", h.UpdateShippingMethod)
	a.DELETE("/shipping/methods/:id", h.DeleteShippingMethod)

	// Payments
	a.GET("/payments", h.ListPayments)
	a.GET("/payments/:id", h.GetPayment)
	a.GET("/payments/by-transaction/:txid", h.GetPaymentByTransactionID)

	// Inventory
	a.GET("/inventory", h.ListInventory)
	a.GET("/inventory/low-stock", h.LowStockInventory)
	a.GET("/inventory/movements", h.ListInventoryMovements)
	a.GET("/inventory/variants/:variantID", h.GetVariantInventory)
	a.POST("/inventory/variants/:variantID/adjust", h.AdjustVariantStock)
	a.PATCH("/inventory/variants/:variantID/reorder", h.UpdateVariantReorder)
	a.GET("/inventory/variants/:variantID/movements", h.VariantMovements)

	// Hero slides
	a.GET("/hero-slides", h.ListHeroSlidesAdmin)
	a.POST("/hero-slides", h.CreateHeroSlide)
	a.GET("/hero-slides/:id", h.GetHeroSlide)
	a.PATCH("/hero-slides/:id", h.UpdateHeroSlide)
	a.DELETE("/hero-slides/:id", h.DeleteHeroSlide)

	// Blog
	a.POST("/blogs", h.CreateBlog)
	a.GET("/blogs/:id", h.GetBlog)
	a.PATCH("/blogs/:id", h.UpdateBlog)
	a.DELETE("/blogs/:id", h.DeleteBlog)
	a.POST("/blog-categories", h.CreateBlogCategory)
	a.PATCH("/blog-categories/:id", h.UpdateBlogCategory)
	a.DELETE("/blog-categories/:id", h.DeleteBlogCategory)

	// Recipes
	a.GET("/recipes", h.ListRecipesAdmin)
	a.POST("/recipes", h.CreateRecipe)
	a.GET("/recipes/:id", h.GetRecipeAdmin)
	a.PATCH("/recipes/:id", h.UpdateRecipe)
	a.DELETE("/recipes/:id", h.DeleteRecipe)

	// Site settings (full document read; partial update)
	a.GET("/settings", h.GetSiteSettingsAdmin)
	a.PUT("/settings", h.UpdateSiteSettings)

	// Analytics
	an := a.Group("/analytics")
	an.GET("/revenue/summary", h.RevenueSummary)
	an.GET("/revenue/timeseries", h.RevenueTimeSeries)
	an.GET("/revenue/today", h.RevenueToday)
	an.GET("/products/top-revenue", h.TopProductsByRevenue)
	an.GET("/products/top-views", h.TopProductsByViews)
	an.GET("/products/:productID/summary", h.ProductStatsSummary)
	an.GET("/products/:productID/timeseries", h.ProductStatsTimeSeries)
	an.GET("/search/top-terms", h.TopSearchTerms)
	an.GET("/search/zero-result", h.ZeroResultSearchTerms)
	an.GET("/search/top-converting", h.TopConvertingSearchTerms)
	an.GET("/events/breakdown", h.EventBreakdown)
}
