// internal/repositories/coupon_usage_repository.go
package coupons

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UsageRepository interface {
	// Record writes a usage row — always called inside the order
	// creation transaction so it rolls back if the order fails.
	Record(ctx context.Context, tx pgx.Tx, couponID int64, userID int64, orderID int64, discountApplied float64) error

	GetByCouponID(ctx context.Context, couponID int64) ([]*CouponUsage, error)
	GetByUserID(ctx context.Context, userID int64) ([]*CouponUsage, error)
	// DeleteByOrderTx removes usage for this order (unpaid cancel). 0 rows is OK.
	DeleteByOrderTx(ctx context.Context, tx pgx.Tx, orderID int64) error
}

type usageRepository struct {
	db *pgxpool.Pool
}

func NewUsageRepository(db *pgxpool.Pool) UsageRepository {
	return &usageRepository{db: db}
}

func (r *usageRepository) Record(ctx context.Context, tx pgx.Tx, couponID int64, userID int64, orderID int64, discountApplied float64) error {
	const q = `
		INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_applied)
		VALUES (@coupon_id, @user_id, @order_id, @discount_applied)`

	args := pgx.NamedArgs{
		"coupon_id":        couponID,
		"user_id":          userID,
		"order_id":         orderID,
		"discount_applied": discountApplied,
	}

	if _, err := tx.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("couponUsageRepository.Record: %w", err)
	}
	return nil
}

func (r *usageRepository) DeleteByOrderTx(ctx context.Context, tx pgx.Tx, orderID int64) error {
	if orderID <= 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `DELETE FROM coupon_usages WHERE order_id = $1`, orderID); err != nil {
		return fmt.Errorf("couponUsageRepository.DeleteByOrderTx: %w", err)
	}
	return nil
}

func (r *usageRepository) GetByCouponID(ctx context.Context, couponID int64) ([]*CouponUsage, error) {
	const q = `
		SELECT * FROM coupon_usages
		WHERE coupon_id = $1
		ORDER BY used_at DESC`

	rows, err := r.db.Query(ctx, q, couponID)
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByCouponID: %w", err)
	}
	defer rows.Close()

	usages, err := pgx.CollectRows(rows, pgx.RowToStructByName[CouponUsage])
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByCouponID scan: %w", err)
	}

	result := make([]*CouponUsage, len(usages))
	for i := range usages {
		result[i] = &usages[i]
	}
	return result, nil
}

func (r *usageRepository) GetByUserID(ctx context.Context, userID int64) ([]*CouponUsage, error) {
	const q = `
		SELECT * FROM coupon_usages
		WHERE user_id = $1
		ORDER BY used_at DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByUserID: %w", err)
	}
	defer rows.Close()

	usages, err := pgx.CollectRows(rows, pgx.RowToStructByName[CouponUsage])
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByUserID scan: %w", err)
	}

	result := make([]*CouponUsage, len(usages))
	for i := range usages {
		result[i] = &usages[i]
	}
	return result, nil
}
