package cron

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	models "github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/database"
)

type ProductStatsCronJob struct {
	db  *pgxpool.Pool
	svc *services.DailyProductStatsService
}

func NewProductStatsCronJob(db *pgxpool.Pool, svc *services.DailyProductStatsService) *ProductStatsCronJob {
	return &ProductStatsCronJob{db: db, svc: svc}
}

func (j *ProductStatsCronJob) Run(ctx context.Context) {
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Truncate(24 * time.Hour)

	slog.Info("product stats job: aggregating", "date", yesterday.Format("2006-01-02"))

	productIDs, err := j.fetchActiveProductIDs(ctx, yesterday)
	if err != nil {
		slog.Error("product stats job: fetching product ids", "err", err)
		return
	}

	if len(productIDs) == 0 {
		slog.Info("product stats job: no products with events yesterday")
		return
	}

	reqs := make([]*models.DailyProductStatsUpsertReq, 0, len(productIDs))
	for _, productID := range productIDs {
		req, err := j.aggregateForProduct(ctx, productID, yesterday)
		if err != nil {
			slog.Error("product stats job: aggregating product",
				"product_id", productID, "err", err)
			continue // skip this product, don't fail the whole batch
		}
		reqs = append(reqs, req)
	}

	if err := j.svc.FlushStats(ctx, reqs); err != nil {
		slog.Error("product stats job: flushing batch", "err", err)
		return
	}

	slog.Info("product stats job: done", "products", len(reqs), "date", yesterday.Format("2006-01-02"))
}

// fetchActiveProductIDs returns distinct product IDs that had events yesterday.
// We read product_id out of the event payload — your product_viewed events
// should include {"product_id": "<uuid>"} in their payload field.
func (j *ProductStatsCronJob) fetchActiveProductIDs(ctx context.Context, date time.Time) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT (payload->>'product_id')::uuid
		FROM events
		WHERE event_type = 'product_viewed'
		  AND created_at >= $1
		  AND created_at < $2
		  AND payload->>'product_id' IS NOT NULL`

	// Idempotent read: safe to retry on a transient (serialization/connection)
	// failure. ids is reset each attempt so a retry can't duplicate rows.
	var ids []uuid.UUID
	err := database.WithRetry(ctx, func(ctx context.Context) error {
		ids = nil
		rows, err := j.db.Query(ctx, query, date, date.AddDate(0, 0, 1))
		if err != nil {
			return fmt.Errorf("fetching active product ids: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err != nil {
				return fmt.Errorf("scanning product id: %w", err)
			}
			ids = append(ids, id)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return ids, nil
}

func (j *ProductStatsCronJob) aggregateForProduct(ctx context.Context, productID uuid.UUID, date time.Time) (*models.DailyProductStatsUpsertReq, error) {
	from := date
	to := date.AddDate(0, 0, 1)

	req := &models.DailyProductStatsUpsertReq{
		Date:      date,
		ProductID: productID,
	}

	// One scan per product per day: all five breakdowns (views, funnel, device,
	// source, revenue) are computed from the same day-and-product slice of events
	// via conditional aggregates, replacing five sequential round-trips. Each
	// FILTER reproduces its former query's WHERE exactly — the views, source and
	// revenue aggregates re-apply the `event_type` scoping their standalone
	// queries had, while funnel and device intentionally span all event types.
	var revenueTotal decimal.Decimal
	var unitsSold int
	// Idempotent read: the scan overwrites the same fields, so retrying a
	// transient failure is safe.
	err := database.WithRetry(ctx, func(ctx context.Context) error {
		return j.db.QueryRow(ctx, `
		WITH base AS (
			SELECT *
			FROM events
			WHERE payload->>'product_id' = $1
			  AND created_at >= $2 AND created_at < $3
		)
		SELECT
			-- views (product_viewed only)
			COUNT(*)                  FILTER (WHERE event_type = 'product_viewed')                          AS views_total,
			COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'product_viewed')                         AS views_unique,
			COUNT(*)                  FILTER (WHERE event_type = 'product_viewed' AND user_id IS NOT NULL)  AS views_registered,
			COUNT(*)                  FILTER (WHERE event_type = 'product_viewed' AND user_id IS NULL)      AS views_guest,
			-- funnel (all event types)
			COUNT(*) FILTER (WHERE event_type = 'cart_updated')   AS add_to_cart,
			COUNT(*) FILTER (WHERE event_type = 'order_created')  AS purchases,
			-- device breakdown (all event types)
			COUNT(*) FILTER (WHERE device_type = 'mobile')  AS device_mobile,
			COUNT(*) FILTER (WHERE device_type = 'desktop') AS device_desktop,
			COUNT(*) FILTER (WHERE device_type = 'tablet')  AS device_tablet,
			-- source breakdown (product_viewed only)
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%search%')         AS source_search,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%category%')       AS source_category,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%recommendation%') AS source_recommendation,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%blog%')           AS source_blog,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer LIKE '%recipe%')         AS source_recipe,
			COUNT(*) FILTER (WHERE event_type = 'product_viewed' AND page_referrer IS NULL)                 AS source_direct,
			-- revenue (order_created only)
			COALESCE(SUM((payload->>'amount')::numeric) FILTER (WHERE event_type = 'order_created'), 0)     AS revenue_total,
			COALESCE(SUM((payload->>'quantity')::int)   FILTER (WHERE event_type = 'order_created'), 0)     AS units_sold
		FROM base`,
			productID.String(), from, to,
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
