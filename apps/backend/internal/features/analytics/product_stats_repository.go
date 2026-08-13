package analytics

import (
	"errors"
	"context"
	"fmt"
	"github.com/tiredbooy/internal/models"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DailyProductStatsRepository interface {
	// Upsert is called by cron — recomputes the row for a given date+product
	Upsert(ctx context.Context, req *DailyProductStatsUpsertReq) error

	// UpsertBatch — cron processes many products at once
	UpsertBatch(ctx context.Context, reqs []*DailyProductStatsUpsertReq) error

	// GetByProductAndDate — single row lookup
	GetByProductAndDate(ctx context.Context, productID int64, date time.Time) (*DailyProductStats, error)

	// GetRangeByProduct — time series for charts
	GetRangeByProduct(ctx context.Context, filter ProductStatsFilter) ([]*DailyProductStats, error)

	// SummaryByProduct — aggregates across date range, for product detail page
	SummaryByProduct(ctx context.Context, filter ProductStatsFilter) (*ProductStatsSummary, error)

	// TopProducts — leaderboard by revenue or views for a date range
	TopProductsByRevenue(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*TopProductEntry, error)
	TopProductsByViews(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*TopProductEntry, error)
}

type dailyProductStatsRepository struct{ db *pgxpool.Pool }

func NewDailyProductStatsRepository(db *pgxpool.Pool) DailyProductStatsRepository {
	return &dailyProductStatsRepository{db: db}
}

const upsertStatsQuery = `
	INSERT INTO daily_product_stats (
		date, product_id,
		views_total, views_unique, views_registered, views_guest,
		avg_view_duration_sec, image_views_total, variant_selections,
		add_to_cart_count, add_to_wishlist_count, checkout_started_count,
		purchase_count, units_sold, revenue_total,
		view_to_cart_rate, cart_to_purchase_rate,
		source_search, source_category, source_recommendation,
		source_direct, source_blog, source_recipe,
		device_mobile, device_desktop, device_tablet,
		return_count, review_count, avg_rating,
		computed_at
	) VALUES (
		$1,$2,
		$3,$4,$5,$6,
		$7,$8,$9,
		$10,$11,$12,
		$13,$14,$15,
		CASE WHEN $3 > 0 THEN ($10::numeric / $3) ELSE 0 END,
		CASE WHEN $10 > 0 THEN ($13::numeric / $10) ELSE 0 END,
		$16,$17,$18,$19,$20,$21,
		$22,$23,$24,
		$25,$26,$27,
		NOW()
	)
	ON CONFLICT (date, product_id) DO UPDATE SET
		views_total           = EXCLUDED.views_total,
		views_unique          = EXCLUDED.views_unique,
		views_registered      = EXCLUDED.views_registered,
		views_guest           = EXCLUDED.views_guest,
		avg_view_duration_sec = EXCLUDED.avg_view_duration_sec,
		image_views_total     = EXCLUDED.image_views_total,
		variant_selections    = EXCLUDED.variant_selections,
		add_to_cart_count     = EXCLUDED.add_to_cart_count,
		add_to_wishlist_count = EXCLUDED.add_to_wishlist_count,
		checkout_started_count= EXCLUDED.checkout_started_count,
		purchase_count        = EXCLUDED.purchase_count,
		units_sold            = EXCLUDED.units_sold,
		revenue_total         = EXCLUDED.revenue_total,
		view_to_cart_rate     = EXCLUDED.view_to_cart_rate,
		cart_to_purchase_rate = EXCLUDED.cart_to_purchase_rate,
		source_search         = EXCLUDED.source_search,
		source_category       = EXCLUDED.source_category,
		source_recommendation = EXCLUDED.source_recommendation,
		source_direct         = EXCLUDED.source_direct,
		source_blog           = EXCLUDED.source_blog,
		source_recipe         = EXCLUDED.source_recipe,
		device_mobile         = EXCLUDED.device_mobile,
		device_desktop        = EXCLUDED.device_desktop,
		device_tablet         = EXCLUDED.device_tablet,
		return_count          = EXCLUDED.return_count,
		review_count          = EXCLUDED.review_count,
		avg_rating            = EXCLUDED.avg_rating,
		computed_at           = NOW()`

func upsertArgs(req *DailyProductStatsUpsertReq) []any {
	return []any{
		req.Date, req.ProductID,
		req.ViewsTotal, req.ViewsUnique, req.ViewsRegistered, req.ViewsGuest,
		req.AvgViewDurationSec, req.ImageViewsTotal, req.VariantSelections,
		req.AddToCartCount, req.AddToWishlistCount, req.CheckoutStartedCount,
		req.PurchaseCount, req.UnitsSold, req.RevenueTotal,
		req.SourceSearch, req.SourceCategory, req.SourceRecommendation,
		req.SourceDirect, req.SourceBlog, req.SourceRecipe,
		req.DeviceMobile, req.DeviceDesktop, req.DeviceTablet,
		req.ReturnCount, req.ReviewCount, req.AvgRating,
	}
}

func (r *dailyProductStatsRepository) Upsert(ctx context.Context, req *DailyProductStatsUpsertReq) error {
	if _, err := r.db.Exec(ctx, upsertStatsQuery, upsertArgs(req)...); err != nil {
		return fmt.Errorf("upserting daily product stats: %w", err)
	}
	return nil
}

func (r *dailyProductStatsRepository) UpsertBatch(ctx context.Context, reqs []*DailyProductStatsUpsertReq) error {
	if len(reqs) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, req := range reqs {
		batch.Queue(upsertStatsQuery, upsertArgs(req)...)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	for range reqs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upserting daily product stats: %w", err)
		}
	}
	return nil
}

const scanStatsQuery = `
	SELECT date, product_id,
	       views_total, views_unique, views_registered, views_guest,
	       avg_view_duration_sec, image_views_total, variant_selections,
	       add_to_cart_count, add_to_wishlist_count, checkout_started_count,
	       purchase_count, units_sold, revenue_total,
	       view_to_cart_rate, cart_to_purchase_rate,
	       source_search, source_category, source_recommendation,
	       source_direct, source_blog, source_recipe,
	       device_mobile, device_desktop, device_tablet,
	       return_count, review_count, avg_rating,
	       computed_at`

func scanStats(row pgx.Row, s *DailyProductStats) error {
	return row.Scan(
		&s.Date, &s.ProductID,
		&s.ViewsTotal, &s.ViewsUnique, &s.ViewsRegistered, &s.ViewsGuest,
		&s.AvgViewDurationSec, &s.ImageViewsTotal, &s.VariantSelections,
		&s.AddToCartCount, &s.AddToWishlistCount, &s.CheckoutStartedCount,
		&s.PurchaseCount, &s.UnitsSold, &s.RevenueTotal,
		&s.ViewToCartRate, &s.CartToPurchaseRate,
		&s.SourceSearch, &s.SourceCategory, &s.SourceRecommendation,
		&s.SourceDirect, &s.SourceBlog, &s.SourceRecipe,
		&s.DeviceMobile, &s.DeviceDesktop, &s.DeviceTablet,
		&s.ReturnCount, &s.ReviewCount, &s.AvgRating,
		&s.ComputedAt,
	)
}

func (r *dailyProductStatsRepository) GetByProductAndDate(ctx context.Context, productID int64, date time.Time) (*DailyProductStats, error) {
	query := scanStatsQuery + ` FROM daily_product_stats WHERE product_id = $1 AND date = $2`

	s := &DailyProductStats{}
	if err := scanStats(r.db.QueryRow(ctx, query, productID, date), s); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting daily product stats: %w", err)
	}
	return s, nil
}

func (r *dailyProductStatsRepository) GetRangeByProduct(ctx context.Context, filter ProductStatsFilter) ([]*DailyProductStats, error) {
	query := scanStatsQuery + `
		FROM daily_product_stats
		WHERE ($1::bigint IS NULL OR product_id = $1)
		  AND date >= $2
		  AND date <= $3
		ORDER BY date ASC`

	rows, err := r.db.Query(ctx, query, filter.ProductID, filter.DateFrom, filter.DateTo)
	if err != nil {
		return nil, fmt.Errorf("querying daily product stats range: %w", err)
	}
	defer rows.Close()

	stats := make([]*DailyProductStats, 0)
	for rows.Next() {
		s := &DailyProductStats{}
		if err := rows.Scan(
			&s.Date, &s.ProductID,
			&s.ViewsTotal, &s.ViewsUnique, &s.ViewsRegistered, &s.ViewsGuest,
			&s.AvgViewDurationSec, &s.ImageViewsTotal, &s.VariantSelections,
			&s.AddToCartCount, &s.AddToWishlistCount, &s.CheckoutStartedCount,
			&s.PurchaseCount, &s.UnitsSold, &s.RevenueTotal,
			&s.ViewToCartRate, &s.CartToPurchaseRate,
			&s.SourceSearch, &s.SourceCategory, &s.SourceRecommendation,
			&s.SourceDirect, &s.SourceBlog, &s.SourceRecipe,
			&s.DeviceMobile, &s.DeviceDesktop, &s.DeviceTablet,
			&s.ReturnCount, &s.ReviewCount, &s.AvgRating,
			&s.ComputedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning daily product stats: %w", err)
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *dailyProductStatsRepository) SummaryByProduct(ctx context.Context, filter ProductStatsFilter) (*ProductStatsSummary, error) {
	query := `
		SELECT
			product_id,
			SUM(views_total)                            AS total_views,
			SUM(revenue_total)                          AS total_revenue,
			SUM(units_sold)                             AS total_units_sold,
			SUM(purchase_count)                         AS total_purchases,
			CASE WHEN SUM(views_total) > 0
			     THEN SUM(add_to_cart_count)::numeric / SUM(views_total)
			     ELSE 0 END                             AS avg_view_to_cart_rate,
			CASE WHEN SUM(add_to_cart_count) > 0
			     THEN SUM(purchase_count)::numeric / SUM(add_to_cart_count)
			     ELSE 0 END                             AS avg_cart_to_purchase_rate,
			AVG(avg_rating)                             AS avg_rating
		FROM daily_product_stats
		WHERE ($1::bigint IS NULL OR product_id = $1)
		  AND date >= $2
		  AND date <= $3
		GROUP BY product_id`

	s := &ProductStatsSummary{}
	err := r.db.QueryRow(ctx, query, filter.ProductID, filter.DateFrom, filter.DateTo).Scan(
		&s.ProductID,
		&s.TotalViews,
		&s.TotalRevenue,
		&s.TotalUnitsSold,
		&s.TotalPurchases,
		&s.AvgViewToCartRate,
		&s.AvgCartToPurchRate,
		&s.AvgRating,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting product stats summary: %w", err)
	}
	return s, nil
}

func (r *dailyProductStatsRepository) TopProductsByRevenue(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*TopProductEntry, error) {
	return r.topProducts(ctx, "revenue_total", dateFrom, dateTo, limit)
}

func (r *dailyProductStatsRepository) TopProductsByViews(ctx context.Context, dateFrom, dateTo time.Time, limit int) ([]*TopProductEntry, error) {
	return r.topProducts(ctx, "views_total", dateFrom, dateTo, limit)
}

func (r *dailyProductStatsRepository) topProducts(ctx context.Context, orderBy string, dateFrom, dateTo time.Time, limit int) ([]*TopProductEntry, error) {
	query := fmt.Sprintf(`
		SELECT
			product_id,
			SUM(revenue_total) AS total_revenue,
			SUM(views_total)   AS total_views,
			SUM(units_sold)    AS units_sold
		FROM daily_product_stats
		WHERE date >= $1 AND date <= $2
		GROUP BY product_id
		ORDER BY SUM(%s) DESC
		LIMIT $3`, orderBy)

	rows, err := r.db.Query(ctx, query, dateFrom, dateTo, limit)
	if err != nil {
		return nil, fmt.Errorf("querying top products: %w", err)
	}
	defer rows.Close()

	entries := make([]*TopProductEntry, 0)
	for rows.Next() {
		e := &TopProductEntry{}
		if err := rows.Scan(&e.ProductID, &e.TotalRevenue, &e.TotalViews, &e.UnitsSold); err != nil {
			return nil, fmt.Errorf("scanning top product entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
