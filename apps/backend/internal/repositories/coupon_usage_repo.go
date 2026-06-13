// internal/repositories/coupon_usage_repository.go
package repositories

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type CouponUsageRepository interface {
	// Record writes a usage row — always called inside the order
	// creation transaction so it rolls back if the order fails.
	Record(ctx context.Context, tx pgx.Tx, couponID int64, userID int64, orderID int64, discountApplied float64) error

	GetByCouponID(ctx context.Context, couponID int64) ([]*models.CouponUsage, error)
	GetByUserID(ctx context.Context, userID int64) ([]*models.CouponUsage, error)
}

type couponUsageRepository struct {
	db *pgxpool.Pool
}

func NewCouponUsageRepository(db *pgxpool.Pool) CouponUsageRepository {
	return &couponUsageRepository{db: db}
}

func (r *couponUsageRepository) Record(ctx context.Context, tx pgx.Tx, couponID int64, userID int64, orderID int64, discountApplied float64) error {
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

func (r *couponUsageRepository) GetByCouponID(ctx context.Context, couponID int64) ([]*models.CouponUsage, error) {
	const q = `
		SELECT * FROM coupon_usages
		WHERE coupon_id = $1
		ORDER BY used_at DESC`

	rows, err := r.db.Query(ctx, q, couponID)
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByCouponID: %w", err)
	}
	defer rows.Close()

	usages, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.CouponUsage])
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByCouponID scan: %w", err)
	}

	result := make([]*models.CouponUsage, len(usages))
	for i := range usages {
		result[i] = &usages[i]
	}
	return result, nil
}

func (r *couponUsageRepository) GetByUserID(ctx context.Context, userID int64) ([]*models.CouponUsage, error) {
	const q = `
		SELECT * FROM coupon_usages
		WHERE user_id = $1
		ORDER BY used_at DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByUserID: %w", err)
	}
	defer rows.Close()

	usages, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.CouponUsage])
	if err != nil {
		return nil, fmt.Errorf("couponUsageRepository.GetByUserID scan: %w", err)
	}

	result := make([]*models.CouponUsage, len(usages))
	for i := range usages {
		result[i] = &usages[i]
	}
	return result, nil
}
