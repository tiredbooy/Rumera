package repositories

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	models "github.com/tiredbooy/internal/models"
)

type DailyRevenueStatsRepository interface {
	Upsert(ctx context.Context, req *models.DailyRevenueStatsUpsertReq) error
	GetByDate(ctx context.Context, date time.Time) (*models.DailyRevenueStats, error)
	GetRange(ctx context.Context, filter models.RevenueStatsFilter) ([]*models.DailyRevenueStats, error)
	Summary(ctx context.Context, filter models.RevenueStatsFilter) (*models.RevenueStatsSummary, error)
}

type dailyRevenueStatsRepository struct{ db *pgxpool.Pool }

func NewDailyRevenueStatsRepository(db *pgxpool.Pool) DailyRevenueStatsRepository {
	return &dailyRevenueStatsRepository{db: db}
}

const upsertRevenueQuery = `
	INSERT INTO daily_revenue_stats (
		date,
		orders_total, orders_completed, orders_cancelled, orders_refunded,
		gross_revenue, refunds_total, discounts_total, net_revenue, shipping_revenue,
		avg_order_value,
		revenue_crypto, revenue_wallet, revenue_other,
		orders_new_customers, orders_returning, unique_customers,
		coupon_uses, coupon_discount_total,
		carts_created, carts_abandoned, cart_abandonment_rate, cart_recovery_count,
		sessions_total, sessions_new, sessions_returning, conversion_rate,
		top_categories, top_products,
		computed_at
	) VALUES (
		$1,
		$2,$3,$4,$5,
		$6,$7,$8,
		-- net_revenue computed: gross - refunds - discounts
		($6 - $7 - $8), $9,
		-- avg_order_value: guard zero divide
		CASE WHEN $2 > 0 THEN $6 / $2 ELSE 0 END,
		$10,$11,$12,
		$13,$14,$15,
		$16,$17,
		$18,$19,
		-- cart_abandonment_rate
		CASE WHEN $18 > 0 THEN $19::numeric / $18 ELSE 0 END,
		$20,
		$21,$22,$23,
		-- conversion_rate: orders / sessions
		CASE WHEN $21 > 0 THEN $2::numeric / $21 ELSE 0 END,
		$24,$25,
		NOW()
	)
	ON CONFLICT (date) DO UPDATE SET
		orders_total          = EXCLUDED.orders_total,
		orders_completed      = EXCLUDED.orders_completed,
		orders_cancelled      = EXCLUDED.orders_cancelled,
		orders_refunded       = EXCLUDED.orders_refunded,
		gross_revenue         = EXCLUDED.gross_revenue,
		refunds_total         = EXCLUDED.refunds_total,
		discounts_total       = EXCLUDED.discounts_total,
		net_revenue           = EXCLUDED.net_revenue,
		shipping_revenue      = EXCLUDED.shipping_revenue,
		avg_order_value       = EXCLUDED.avg_order_value,
		revenue_crypto        = EXCLUDED.revenue_crypto,
		revenue_wallet        = EXCLUDED.revenue_wallet,
		revenue_other         = EXCLUDED.revenue_other,
		orders_new_customers  = EXCLUDED.orders_new_customers,
		orders_returning      = EXCLUDED.orders_returning,
		unique_customers      = EXCLUDED.unique_customers,
		coupon_uses           = EXCLUDED.coupon_uses,
		coupon_discount_total = EXCLUDED.coupon_discount_total,
		carts_created         = EXCLUDED.carts_created,
		carts_abandoned       = EXCLUDED.carts_abandoned,
		cart_abandonment_rate = EXCLUDED.cart_abandonment_rate,
		cart_recovery_count   = EXCLUDED.cart_recovery_count,
		sessions_total        = EXCLUDED.sessions_total,
		sessions_new          = EXCLUDED.sessions_new,
		sessions_returning    = EXCLUDED.sessions_returning,
		conversion_rate       = EXCLUDED.conversion_rate,
		top_categories        = EXCLUDED.top_categories,
		top_products          = EXCLUDED.top_products,
		computed_at           = NOW()`

func (r *dailyRevenueStatsRepository) Upsert(ctx context.Context, req *models.DailyRevenueStatsUpsertReq) error {
	topCat, err := json.Marshal(req.TopCategories)
	if err != nil {
		return fmt.Errorf("marshalling top_categories: %w", err)
	}
	topProd, err := json.Marshal(req.TopProducts)
	if err != nil {
		return fmt.Errorf("marshalling top_products: %w", err)
	}

	_, err = r.db.Exec(ctx, upsertRevenueQuery,
		req.Date,
		req.OrdersTotal, req.OrdersCompleted, req.OrdersCancelled, req.OrdersRefunded,
		req.GrossRevenue, req.RefundsTotal, req.DiscountsTotal, req.ShippingRevenue,
		req.RevenueCrypto, req.RevenueWallet, req.RevenueOther,
		req.OrdersNewCustomers, req.OrdersReturning, req.UniqueCustomers,
		req.CouponUses, req.CouponDiscountTotal,
		req.CartsCreated, req.CartsAbandoned, req.CartRecoveryCount,
		req.SessionsTotal, req.SessionsNew, req.SessionsReturning,
		topCat, topProd,
	)
	if err != nil {
		return fmt.Errorf("upserting daily revenue stats: %w", err)
	}
	return nil
}

func (r *dailyRevenueStatsRepository) GetByDate(ctx context.Context, date time.Time) (*models.DailyRevenueStats, error) {
	query := `
		SELECT date,
		       orders_total, orders_completed, orders_cancelled, orders_refunded,
		       gross_revenue, refunds_total, discounts_total, net_revenue, shipping_revenue,
		       avg_order_value,
		       revenue_crypto, revenue_wallet, revenue_other,
		       orders_new_customers, orders_returning, unique_customers,
		       coupon_uses, coupon_discount_total,
		       carts_created, carts_abandoned, cart_abandonment_rate, cart_recovery_count,
		       sessions_total, sessions_new, sessions_returning, conversion_rate,
		       top_categories, top_products,
		       computed_at
		FROM daily_revenue_stats WHERE date = $1`

	s, err := scanRevenueStats(r.db.QueryRow(ctx, query, date))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("daily revenue stats not found for date: %s", date.Format("2006-01-02"))
		}
		return nil, fmt.Errorf("getting daily revenue stats: %w", err)
	}
	return s, nil
}

func (r *dailyRevenueStatsRepository) GetRange(ctx context.Context, filter models.RevenueStatsFilter) ([]*models.DailyRevenueStats, error) {
	query := `
		SELECT date,
		       orders_total, orders_completed, orders_cancelled, orders_refunded,
		       gross_revenue, refunds_total, discounts_total, net_revenue, shipping_revenue,
		       avg_order_value,
		       revenue_crypto, revenue_wallet, revenue_other,
		       orders_new_customers, orders_returning, unique_customers,
		       coupon_uses, coupon_discount_total,
		       carts_created, carts_abandoned, cart_abandonment_rate, cart_recovery_count,
		       sessions_total, sessions_new, sessions_returning, conversion_rate,
		       top_categories, top_products,
		       computed_at
		FROM daily_revenue_stats
		WHERE date >= $1 AND date <= $2
		ORDER BY date ASC`

	rows, err := r.db.Query(ctx, query, filter.DateFrom, filter.DateTo)
	if err != nil {
		return nil, fmt.Errorf("querying daily revenue stats range: %w", err)
	}
	defer rows.Close()

	var stats []*models.DailyRevenueStats
	for rows.Next() {
		s, err := scanRevenueStats(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning daily revenue stats: %w", err)
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *dailyRevenueStatsRepository) Summary(ctx context.Context, filter models.RevenueStatsFilter) (*models.RevenueStatsSummary, error) {
	query := `
		SELECT
			SUM(orders_total)                                           AS total_orders,
			SUM(gross_revenue)                                          AS total_gross_revenue,
			SUM(net_revenue)                                            AS total_net_revenue,
			SUM(refunds_total)                                          AS total_refunds,
			SUM(discounts_total)                                        AS total_discounts,
			CASE WHEN SUM(orders_total) > 0
			     THEN SUM(gross_revenue) / SUM(orders_total)
			     ELSE 0 END                                             AS avg_order_value,
			CASE WHEN SUM(sessions_total) > 0
			     THEN SUM(orders_total)::numeric / SUM(sessions_total)
			     ELSE 0 END                                             AS avg_conversion_rate,
			SUM(unique_customers)                                       AS unique_customers
		FROM daily_revenue_stats
		WHERE date >= $1 AND date <= $2`

	s := &models.RevenueStatsSummary{}
	err := r.db.QueryRow(ctx, query, filter.DateFrom, filter.DateTo).Scan(
		&s.TotalOrders,
		&s.TotalGrossRevenue,
		&s.TotalNetRevenue,
		&s.TotalRefunds,
		&s.TotalDiscounts,
		&s.AvgOrderValue,
		&s.AvgConversionRate,
		&s.UniqueCustomers,
	)
	if err != nil {
		return nil, fmt.Errorf("getting revenue stats summary: %w", err)
	}
	return s, nil
}

// scanRevenueStats works for both QueryRow (pgx.Row) and rows.Next() (pgx.Rows)
// since both implement pgx.Row via the Scan method.
func scanRevenueStats(row pgx.Row) (*models.DailyRevenueStats, error) {
	s := &models.DailyRevenueStats{}
	var topCatRaw, topProdRaw []byte

	err := row.Scan(
		&s.Date,
		&s.OrdersTotal, &s.OrdersCompleted, &s.OrdersCancelled, &s.OrdersRefunded,
		&s.GrossRevenue, &s.RefundsTotal, &s.DiscountsTotal, &s.NetRevenue, &s.ShippingRevenue,
		&s.AvgOrderValue,
		&s.RevenueCrypto, &s.RevenueWallet, &s.RevenueOther,
		&s.OrdersNewCustomers, &s.OrdersReturning, &s.UniqueCustomers,
		&s.CouponUses, &s.CouponDiscountTotal,
		&s.CartsCreated, &s.CartsAbandoned, &s.CartAbandonmentRate, &s.CartRecoveryCount,
		&s.SessionsTotal, &s.SessionsNew, &s.SessionsReturning, &s.ConversionRate,
		&topCatRaw, &topProdRaw,
		&s.ComputedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(topCatRaw, &s.TopCategories); err != nil {
		return nil, fmt.Errorf("unmarshalling top_categories: %w", err)
	}
	if err := json.Unmarshal(topProdRaw, &s.TopProducts); err != nil {
		return nil, fmt.Errorf("unmarshalling top_products: %w", err)
	}

	return s, nil
}
