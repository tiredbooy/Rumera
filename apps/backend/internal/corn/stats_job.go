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

	rows, err := j.db.Query(ctx, query, date, date.AddDate(0, 0, 1))
	if err != nil {
		return nil, fmt.Errorf("fetching active product ids: %w", err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning product id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (j *ProductStatsCronJob) aggregateForProduct(ctx context.Context, productID uuid.UUID, date time.Time) (*models.DailyProductStatsUpsertReq, error) {
	from := date
	to := date.AddDate(0, 0, 1)

	req := &models.DailyProductStatsUpsertReq{
		Date:      date,
		ProductID: productID,
	}

	// ── views ────────────────────────────────────────────────────────────────
	err := j.db.QueryRow(ctx, `
		SELECT
			COUNT(*)                                            AS views_total,
			COUNT(DISTINCT session_id)                          AS views_unique,
			COUNT(*) FILTER (WHERE user_id IS NOT NULL)         AS views_registered,
			COUNT(*) FILTER (WHERE user_id IS NULL)             AS views_guest
		FROM events
		WHERE event_type = 'product_viewed'
		  AND payload->>'product_id' = $1
		  AND created_at >= $2 AND created_at < $3`,
		productID.String(), from, to,
	).Scan(
		&req.ViewsTotal,
		&req.ViewsUnique,
		&req.ViewsRegistered,
		&req.ViewsGuest,
	)
	if err != nil {
		return nil, fmt.Errorf("aggregating views: %w", err)
	}

	// ── funnel ───────────────────────────────────────────────────────────────
	err = j.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE event_type = 'cart_updated')     AS add_to_cart,
			COUNT(*) FILTER (WHERE event_type = 'order_created')    AS purchases
		FROM events
		WHERE payload->>'product_id' = $1
		  AND created_at >= $2 AND created_at < $3`,
		productID.String(), from, to,
	).Scan(
		&req.AddToCartCount,
		&req.PurchaseCount,
	)
	if err != nil {
		return nil, fmt.Errorf("aggregating funnel: %w", err)
	}

	// ── device breakdown ─────────────────────────────────────────────────────
	err = j.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE device_type = 'mobile')  AS mobile,
			COUNT(*) FILTER (WHERE device_type = 'desktop') AS desktop,
			COUNT(*) FILTER (WHERE device_type = 'tablet')  AS tablet
		FROM events
		WHERE payload->>'product_id' = $1
		  AND created_at >= $2 AND created_at < $3`,
		productID.String(), from, to,
	).Scan(
		&req.DeviceMobile,
		&req.DeviceDesktop,
		&req.DeviceTablet,
	)
	if err != nil {
		return nil, fmt.Errorf("aggregating devices: %w", err)
	}

	// ── source breakdown ─────────────────────────────────────────────────────
	err = j.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE page_referrer LIKE '%search%')           AS source_search,
			COUNT(*) FILTER (WHERE page_referrer LIKE '%category%')         AS source_category,
			COUNT(*) FILTER (WHERE page_referrer LIKE '%recommendation%')   AS source_recommendation,
			COUNT(*) FILTER (WHERE page_referrer LIKE '%blog%')             AS source_blog,
			COUNT(*) FILTER (WHERE page_referrer LIKE '%recipe%')           AS source_recipe,
			COUNT(*) FILTER (WHERE page_referrer IS NULL)                   AS source_direct
		FROM events
		WHERE event_type = 'product_viewed'
		  AND payload->>'product_id' = $1
		  AND created_at >= $2 AND created_at < $3`,
		productID.String(), from, to,
	).Scan(
		&req.SourceSearch,
		&req.SourceCategory,
		&req.SourceRecommendation,
		&req.SourceBlog,
		&req.SourceRecipe,
		&req.SourceDirect,
	)
	if err != nil {
		return nil, fmt.Errorf("aggregating sources: %w", err)
	}

	// ── revenue (from order events payload) ──────────────────────────────────
	var revenueTotal decimal.Decimal
	var unitsSold int
	err = j.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM((payload->>'amount')::numeric), 0)     AS revenue_total,
			COALESCE(SUM((payload->>'quantity')::int), 0)       AS units_sold
		FROM events
		WHERE event_type = 'order_created'
		  AND payload->>'product_id' = $1
		  AND created_at >= $2 AND created_at < $3`,
		productID.String(), from, to,
	).Scan(&revenueTotal, &unitsSold)
	if err != nil {
		return nil, fmt.Errorf("aggregating revenue: %w", err)
	}
	req.RevenueTotal = revenueTotal
	req.UnitsSold = unitsSold

	return req, nil
}
