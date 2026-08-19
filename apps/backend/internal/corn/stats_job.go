package cron

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	featanalytics "github.com/tiredbooy/internal/features/analytics"
	"github.com/tiredbooy/pkg/database"
)

type ProductStatsCronJob struct {
	db  *pgxpool.Pool
	svc *featanalytics.DailyProductStatsService
}

func NewProductStatsCronJob(db *pgxpool.Pool, svc *featanalytics.DailyProductStatsService) *ProductStatsCronJob {
	return &ProductStatsCronJob{db: db, svc: svc}
}

func (j *ProductStatsCronJob) Run(ctx context.Context) {
	dates, err := pendingStatDates(ctx, j.db, "daily_product_stats", time.Now())
	if err != nil {
		slog.Error("product stats job: gap scan failed", "err", err)
		return
	}
	if len(dates) == 0 {
		slog.Info("product stats job: nothing pending")
		return
	}
	if len(dates) > 1 {
		slog.Warn("product stats job: backfilling missed days", "days", len(dates))
	}

	for _, date := range dates {
		j.runForDate(ctx, date)
	}
}

func (j *ProductStatsCronJob) runForDate(ctx context.Context, date time.Time) {
	slog.Info("product stats job: aggregating", "date", date.Format("2006-01-02"))

	productIDs, err := j.fetchActiveProductIDs(ctx, date)
	if err != nil {
		slog.Error("product stats job: fetching product ids",
			"date", date.Format("2006-01-02"), "err", err)
		return
	}

	if len(productIDs) == 0 {
		slog.Info("product stats job: no products with events",
			"date", date.Format("2006-01-02"))
		return
	}

	reqs := make([]*featanalytics.DailyProductStatsUpsertReq, 0, len(productIDs))
	for _, productID := range productIDs {
		req, err := j.aggregateForProduct(ctx, productID, date)
		if err != nil {
			slog.Error("product stats job: aggregating product",
				"product_id", productID, "err", err)
			continue // skip this product, don't fail the whole batch
		}
		reqs = append(reqs, req)
	}

	if err := j.svc.FlushStats(ctx, reqs); err != nil {
		slog.Error("product stats job: flushing batch",
			"date", date.Format("2006-01-02"), "err", err)
		return
	}

	slog.Info("product stats job: done", "products", len(reqs), "date", date.Format("2006-01-02"))
}

// fetchActiveProductIDs returns distinct catalog product IDs that had events
// yesterday. product_viewed payloads carry {"product_id": <bigint>}.
func (j *ProductStatsCronJob) fetchActiveProductIDs(ctx context.Context, date time.Time) ([]int64, error) {
	query := `
		SELECT DISTINCT (payload->>'product_id')::bigint
		FROM events
		WHERE event_type = 'product_viewed'
		  AND created_at >= $1
		  AND created_at < $2
		  AND payload ? 'product_id'
		  AND (payload->>'product_id') ~ '^[0-9]+$'`

	var ids []int64
	err := database.WithRetry(ctx, func(ctx context.Context) error {
		ids = nil
		rows, err := j.db.Query(ctx, query, date, date.AddDate(0, 0, 1))
		if err != nil {
			return fmt.Errorf("fetching active product ids: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return fmt.Errorf("scanning product id: %w", err)
			}
			if id > 0 {
				ids = append(ids, id)
			}
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return ids, nil
}

func (j *ProductStatsCronJob) aggregateForProduct(ctx context.Context, productID int64, date time.Time) (*featanalytics.DailyProductStatsUpsertReq, error) {
	from := date
	to := date.AddDate(0, 0, 1)
	productKey := strconv.FormatInt(productID, 10)

	req := &featanalytics.DailyProductStatsUpsertReq{
		Date:      date,
		ProductID: productID,
	}

	var revenueTotal decimal.Decimal
	var unitsSold int
	err := database.WithRetry(ctx, func(ctx context.Context) error {
		return j.db.QueryRow(ctx, `
		WITH base AS (
			SELECT *
			FROM events
			WHERE payload->>'product_id' = $1
			  AND created_at >= $2 AND created_at < $3
		)
		SELECT
			COUNT(*)                  FILTER (WHERE event_type = 'product_viewed')                          AS views_total,
			COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'product_viewed')                         AS views_unique,
			COUNT(*)                  FILTER (WHERE event_type = 'product_viewed' AND user_id IS NOT NULL)  AS views_registered,
			COUNT(*)                  FILTER (WHERE event_type = 'product_viewed' AND user_id IS NULL)      AS views_guest,
			COUNT(*) FILTER (WHERE event_type = 'cart_updated')   AS add_to_cart,
			COUNT(*) FILTER (WHERE event_type = 'order_created')  AS purchases,
			COUNT(*) FILTER (WHERE device_type = 'mobile')  AS device_mobile,
			COUNT(*) FILTER (WHERE device_type = 'desktop') AS device_desktop,
			COUNT(*) FILTER (WHERE device_type = 'tablet')  AS device_tablet,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%search%')         AS source_search,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%category%')       AS source_category,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%recommendation%') AS source_recommendation,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%blog%')           AS source_blog,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%recipe%')         AS source_recipe,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer IS NULL)                 AS source_direct,
			COALESCE(SUM((payload->>'amount')::numeric) FILTER (WHERE event_type = 'order_created'), 0)     AS revenue_total,
			COALESCE(SUM((payload->>'quantity')::int)   FILTER (WHERE event_type = 'order_created'), 0)     AS units_sold
		FROM base`,
			productKey, from, to,
		).Scan(
			&req.ViewsTotal,
			&req.ViewsUnique,
			&req.ViewsRegistered,
			&req.ViewsGuest,
			&req.AddToCartCount,
			&req.PurchaseCount,
			&req.DeviceMobile,
			&req.DeviceDesktop,
			&req.DeviceTablet,
			&req.SourceSearch,
			&req.SourceCategory,
			&req.SourceRecommendation,
			&req.SourceBlog,
			&req.SourceRecipe,
			&req.SourceDirect,
			&revenueTotal,
			&unitsSold,
		)
	})
	if err != nil {
		return nil, fmt.Errorf("aggregating product stats: %w", err)
	}
	req.RevenueTotal = revenueTotal
	req.UnitsSold = unitsSold

	return req, nil
}
