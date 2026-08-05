package cron

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	models "github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/services"
)

type RevenueCronJob struct {
	db  *pgxpool.Pool
	svc *services.DailyRevenueStatsService
}

func NewRevenueCronJob(db *pgxpool.Pool, svc *services.DailyRevenueStatsService) *RevenueCronJob {
	return &RevenueCronJob{db: db, svc: svc}
}

func (j *RevenueCronJob) Run(ctx context.Context) {
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Truncate(24 * time.Hour)

	slog.Info("revenue stats job: aggregating", "date", yesterday.Format("2006-01-02"))

	req, err := j.aggregate(ctx, yesterday)
	if err != nil {
		slog.Error("revenue stats job: aggregation failed", "err", err)
		return
	}

	if err := j.svc.FlushStats(ctx, req); err != nil {
		slog.Error("revenue stats job: flush failed", "err", err)
		return
	}

	slog.Info("revenue stats job: done", "date", yesterday.Format("2006-01-02"))
}

func (j *RevenueCronJob) aggregate(ctx context.Context, date time.Time) (*models.DailyRevenueStatsUpsertReq, error) {
	from := date
	to := date.AddDate(0, 0, 1)

	req := &models.DailyRevenueStatsUpsertReq{Date: date}

	// ── order volume ─────────────────────────────────────────────────────────
	err := j.db.QueryRow(ctx, `
		SELECT
			COUNT(*)                                                            AS orders_total,
			COUNT(*) FILTER (WHERE payload->>'status' = 'completed')           AS orders_completed,
			COUNT(*) FILTER (WHERE payload->>'status' = 'cancelled')           AS orders_cancelled,
			COUNT(*) FILTER (WHERE payload->>'status' = 'refunded')            AS orders_refunded,
			COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)         AS unique_customers
		FROM events
		WHERE event_type = 'order_created'
		  AND created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(
		&req.OrdersTotal,
		&req.OrdersCompleted,
		&req.OrdersCancelled,
		&req.OrdersRefunded,
		&req.UniqueCustomers,
	)
	if err != nil {
		return nil, fmt.Errorf("aggregating order volume: %w", err)
	}

	// ── revenue ──────────────────────────────────────────────────────────────
	var gross, refunds, discounts, shipping decimal.Decimal
	err = j.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM((payload->>'gross_amount')::numeric), 0)       AS gross_revenue,
			COALESCE(SUM((payload->>'refund_amount')::numeric), 0)      AS refunds_total,
			COALESCE(SUM((payload->>'discount_amount')::numeric), 0)    AS discounts_total,
			COALESCE(SUM((payload->>'shipping_amount')::numeric), 0)    AS shipping_revenue
		FROM events
		WHERE event_type = 'order_created'
		  AND created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(&gross, &refunds, &discounts, &shipping)
	if err != nil {
		return nil, fmt.Errorf("aggregating revenue: %w", err)
	}
	req.GrossRevenue = gross
	req.RefundsTotal = refunds
	req.DiscountsTotal = discounts
	req.ShippingRevenue = shipping

	// ── payment method breakdown ──────────────────────────────────────────────
	err = j.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM((payload->>'gross_amount')::numeric) FILTER (WHERE payload->>'payment_method' = 'crypto'), 0)  AS crypto,
			COALESCE(SUM((payload->>'gross_amount')::numeric) FILTER (WHERE payload->>'payment_method' = 'wallet'), 0) AS wallet,
			COALESCE(SUM((payload->>'gross_amount')::numeric) FILTER (WHERE payload->>'payment_method' NOT IN ('crypto','wallet')), 0) AS other
		FROM events
		WHERE event_type = 'order_created'
		  AND created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(&req.RevenueCrypto, &req.RevenueWallet, &req.RevenueOther)
	if err != nil {
		return nil, fmt.Errorf("aggregating payment methods: %w", err)
	}

	// ── customer breakdown (new vs returning) ─────────────────────────────────
	// A "new" customer is one whose first ever order_created event is yesterday.
	err = j.db.QueryRow(ctx, `
		WITH first_orders AS (
			SELECT user_id, MIN(created_at) AS first_order_at
			FROM events
			WHERE event_type = 'order_created'
			  AND user_id IS NOT NULL
			GROUP BY user_id
		)
		SELECT
			COUNT(*) FILTER (WHERE first_order_at >= $1 AND first_order_at < $2) AS new_customers,
			COUNT(*) FILTER (WHERE first_order_at < $1)                          AS returning_customers
		FROM first_orders`,
		from, to,
	).Scan(&req.OrdersNewCustomers, &req.OrdersReturning)
	if err != nil {
		return nil, fmt.Errorf("aggregating customer breakdown: %w", err)
	}

	// ── coupon usage ──────────────────────────────────────────────────────────
	var couponDiscount decimal.Decimal
	err = j.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE payload->>'coupon_code' IS NOT NULL)                                         AS coupon_uses,
			COALESCE(SUM((payload->>'discount_amount')::numeric) FILTER (WHERE payload->>'coupon_code' IS NOT NULL), 0) AS coupon_discount
		FROM events
		WHERE event_type = 'order_created'
		  AND created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(&req.CouponUses, &couponDiscount)
	if err != nil {
		return nil, fmt.Errorf("aggregating coupons: %w", err)
	}
	req.CouponDiscountTotal = couponDiscount

	// ── cart metrics ──────────────────────────────────────────────────────────
	err = j.db.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT session_id)                                                          AS carts_created,
			COUNT(DISTINCT session_id) FILTER (WHERE session_id NOT IN (
				SELECT DISTINCT session_id FROM events
				WHERE event_type = 'order_created'
				  AND created_at >= $1 AND created_at < $2
			))                                                                                  AS carts_abandoned
		FROM events
		WHERE event_type = 'cart_updated'
		  AND created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(&req.CartsCreated, &req.CartsAbandoned)
	if err != nil {
		return nil, fmt.Errorf("aggregating cart metrics: %w", err)
	}

	// ── session metrics ───────────────────────────────────────────────────────
	err = j.db.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT session_id)                                                      AS sessions_total,
			COUNT(DISTINCT session_id) FILTER (WHERE user_id IS NULL)                      AS sessions_new,
			COUNT(DISTINCT session_id) FILTER (WHERE user_id IS NOT NULL)                  AS sessions_returning
		FROM events
		WHERE created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(&req.SessionsTotal, &req.SessionsNew, &req.SessionsReturning)
	if err != nil {
		return nil, fmt.Errorf("aggregating sessions: %w", err)
	}

	// ── top categories and products (JSONB) ───────────────────────────────────
	req.TopCategories, err = j.aggregateTopCategories(ctx, from, to)
	if err != nil {
		return nil, fmt.Errorf("aggregating top categories: %w", err)
	}

	req.TopProducts, err = j.aggregateTopProducts(ctx, from, to)
	if err != nil {
		return nil, fmt.Errorf("aggregating top products: %w", err)
	}

	return req, nil
}

func (j *RevenueCronJob) aggregateTopCategories(ctx context.Context, from, to time.Time) ([]models.TopCategoryEntry, error) {
	rows, err := j.db.Query(ctx, `
		SELECT
			payload->>'category_id'                             AS category_id,
			SUM((payload->>'amount')::numeric)                  AS revenue,
			SUM((payload->>'quantity')::int)                    AS units
		FROM events
		WHERE event_type = 'order_created'
		  AND payload->>'category_id' IS NOT NULL
		  AND created_at >= $1 AND created_at < $2
		GROUP BY payload->>'category_id'
		ORDER BY revenue DESC
		LIMIT 10`,
		from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.TopCategoryEntry
	for rows.Next() {
		var e models.TopCategoryEntry
		if err := rows.Scan(&e.CategoryID, &e.Revenue, &e.Units); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (j *RevenueCronJob) aggregateTopProducts(ctx context.Context, from, to time.Time) ([]models.TopProductRevenueEntry, error) {
	// Prefer per-line items when present; fall back to a single product_id on
	// the root payload for older events. Product keys are catalog BIGINT
	// values serialized as strings.
	rows, err := j.db.Query(ctx, `
		SELECT
			item->>'product_id'                              AS product_id,
			SUM(COALESCE((item->>'amount')::numeric, 0))     AS revenue,
			SUM(COALESCE((item->>'quantity')::int, 0))       AS units
		FROM events e
		CROSS JOIN LATERAL jsonb_array_elements(
			CASE
				WHEN jsonb_typeof(e.payload->'items') = 'array'
					AND jsonb_array_length(e.payload->'items') > 0
				THEN e.payload->'items'
				WHEN e.payload ? 'product_id'
				THEN jsonb_build_array(e.payload)
				ELSE '[]'::jsonb
			END
		) AS item
		WHERE e.event_type = 'order_created'
		  AND e.created_at >= $1 AND e.created_at < $2
		  AND item->>'product_id' IS NOT NULL
		  AND (item->>'product_id') ~ '^[0-9]+$'
		GROUP BY item->>'product_id'
		ORDER BY revenue DESC
		LIMIT 10`,
		from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.TopProductRevenueEntry
	for rows.Next() {
		var e models.TopProductRevenueEntry
		if err := rows.Scan(&e.ProductID, &e.Revenue, &e.Units); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
