// internal/repositories/coupon_repository.go
package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type CouponRepository interface {
	Create(ctx context.Context, req models.CreateCouponReq) (*models.Coupon, error)
	GetByID(ctx context.Context, id int64) (*models.Coupon, error)
	GetByCode(ctx context.Context, code string) (*models.Coupon, error)
	GetAll(ctx context.Context, filter models.CouponFilter) ([]*models.Coupon, int64, error)
	Update(ctx context.Context, id int64, req models.UpdateCouponReq) (*models.Coupon, error)
	Delete(ctx context.Context, id int64) error

	// CountUsages returns total times a coupon has been used.
	CountUsages(ctx context.Context, couponID int64) (int, error)

	// CountUsagesByUser returns how many times a specific user used a coupon.
	CountUsagesByUser(ctx context.Context, couponID int64, userID int64) (int, error)

	// LockByID takes a row lock on the coupon (SELECT ... FOR UPDATE) within tx,
	// so concurrent redemptions of the same coupon serialize and the usage-limit
	// re-check below is race-free.
	LockByID(ctx context.Context, tx pgx.Tx, id int64) error
	// CountUsagesTx / CountUsagesByUserTx count usages on the supplied tx (used
	// for the locked re-check inside order creation).
	CountUsagesTx(ctx context.Context, tx pgx.Tx, couponID int64) (int, error)
	CountUsagesByUserTx(ctx context.Context, tx pgx.Tx, couponID int64, userID int64) (int, error)

	ExistsByCode(ctx context.Context, code string) (bool, error)
}

type couponRepository struct {
	db *pgxpool.Pool
}

func NewCouponRepository(db *pgxpool.Pool) CouponRepository {
	return &couponRepository{db: db}
}

func (r *couponRepository) Create(ctx context.Context, req models.CreateCouponReq) (*models.Coupon, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	startsAt := time.Now()
	if req.StartsAt != nil {
		startsAt = *req.StartsAt
	}

	applicableTo, err := marshalApplicableTo(req.ApplicableTo)
	if err != nil {
		return nil, fmt.Errorf("couponRepository.Create marshal: %w", err)
	}

	const q = `
		INSERT INTO coupons (
			code, description, discount_type, discount_value,
			max_discount_amount, min_order_amount,
			max_uses, max_uses_per_user, applicable_to,
			is_active, starts_at, expires_at
		) VALUES (
			@code, @description, @discount_type, @discount_value,
			@max_discount_amount, @min_order_amount,
			@max_uses, @max_uses_per_user, @applicable_to,
			@is_active, @starts_at, @expires_at
		)
		RETURNING *`

	args := pgx.NamedArgs{
		"code":                req.Code,
		"description":         req.Description,
		"discount_type":       req.DiscountType,
		"discount_value":      req.DiscountValue,
		"max_discount_amount": req.MaxDiscountAmount,
		"min_order_amount":    req.MinOrderAmount,
		"max_uses":            req.MaxUses,
		"max_uses_per_user":   req.MaxUsesPerUser,
		"applicable_to":       applicableTo,
		"is_active":           isActive,
		"starts_at":           startsAt,
		"expires_at":          req.ExpiresAt,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("couponRepository.Create: %w", err)
	}

	return scanCoupon(rows)
}

func (r *couponRepository) GetByID(ctx context.Context, id int64) (*models.Coupon, error) {
	const q = `SELECT * FROM coupons WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("couponRepository.GetByID: %w", err)
	}

	coupon, err := scanCoupon(rows)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.GetByID: %w", err)
	}
	return coupon, nil
}

func (r *couponRepository) GetByCode(ctx context.Context, code string) (*models.Coupon, error) {
	const q = `SELECT * FROM coupons WHERE code = $1`

	rows, err := r.db.Query(ctx, q, code)
	if err != nil {
		return nil, fmt.Errorf("couponRepository.GetByCode: %w", err)
	}

	coupon, err := scanCoupon(rows)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.GetByCode: %w", err)
	}
	return coupon, nil
}

func (r *couponRepository) GetAll(ctx context.Context, f models.CouponFilter) ([]*models.Coupon, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "code ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}
	if f.IsActive != nil {
		where = append(where, "is_active = @is_active")
		args["is_active"] = *f.IsActive
	}
	if f.DiscountType != nil {
		where = append(where, "discount_type = @discount_type")
		args["discount_type"] = *f.DiscountType
	}
	// ActiveOnly = currently valid coupons only
	if f.ActiveOnly {
		where = append(where, "is_active = true AND starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())")
	}

	allowed := map[string]bool{
		"created_at":     true,
		"code":           true,
		"discount_value": true,
		"starts_at":      true,
		"expires_at":     true,
	}
	sortBy := "created_at"
	if allowed[f.SortBy] {
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT *, COUNT(*) OVER() AS total_count
		FROM coupons
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("couponRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		coupons []*models.Coupon
		total   int64
	)

	for rows.Next() {
		coupon, t, err := scanCouponRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("couponRepository.GetAll scan: %w", err)
		}
		total = t
		coupons = append(coupons, coupon)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("couponRepository.GetAll rows: %w", err)
	}

	return coupons, total, nil
}

func (r *couponRepository) Update(ctx context.Context, id int64, req models.UpdateCouponReq) (*models.Coupon, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}
	if req.DiscountValue != nil {
		sets = append(sets, "discount_value = @discount_value")
		args["discount_value"] = *req.DiscountValue
	}
	if req.MaxDiscountAmount != nil {
		sets = append(sets, "max_discount_amount = @max_discount_amount")
		args["max_discount_amount"] = *req.MaxDiscountAmount
	}
	if req.MinOrderAmount != nil {
		sets = append(sets, "min_order_amount = @min_order_amount")
		args["min_order_amount"] = *req.MinOrderAmount
	}
	if req.MaxUses != nil {
		sets = append(sets, "max_uses = @max_uses")
		args["max_uses"] = *req.MaxUses
	}
	if req.MaxUsesPerUser != nil {
		sets = append(sets, "max_uses_per_user = @max_uses_per_user")
		args["max_uses_per_user"] = *req.MaxUsesPerUser
	}
	if req.ApplicableTo != nil {
		applicableTo, err := marshalApplicableTo(req.ApplicableTo)
		if err != nil {
			return nil, fmt.Errorf("couponRepository.Update marshal: %w", err)
		}
		sets = append(sets, "applicable_to = @applicable_to")
		args["applicable_to"] = applicableTo
	}
	if req.IsActive != nil {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = *req.IsActive
	}
	if req.StartsAt != nil {
		sets = append(sets, "starts_at = @starts_at")
		args["starts_at"] = *req.StartsAt
	}
	if req.ExpiresAt != nil {
		sets = append(sets, "expires_at = @expires_at")
		args["expires_at"] = *req.ExpiresAt
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE coupons SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("couponRepository.Update: %w", err)
	}

	coupon, err := scanCoupon(rows)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.Update: %w", err)
	}
	return coupon, nil
}

func (r *couponRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM coupons WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("couponRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *couponRepository) CountUsages(ctx context.Context, couponID int64) (int, error) {
	const q = `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1`

	var count int
	if err := r.db.QueryRow(ctx, q, couponID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsages: %w", err)
	}
	return count, nil
}

func (r *couponRepository) CountUsagesByUser(ctx context.Context, couponID int64, userID int64) (int, error) {
	const q = `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2`

	var count int
	if err := r.db.QueryRow(ctx, q, couponID, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsagesByUser: %w", err)
	}
	return count, nil
}

func (r *couponRepository) LockByID(ctx context.Context, tx pgx.Tx, id int64) error {
	var x int
	err := tx.QueryRow(ctx, `SELECT 1 FROM coupons WHERE id = $1 FOR UPDATE`, id).Scan(&x)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.ErrNotFound
		}
		return fmt.Errorf("couponRepository.LockByID: %w", err)
	}
	return nil
}

func (r *couponRepository) CountUsagesTx(ctx context.Context, tx pgx.Tx, couponID int64) (int, error) {
	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1`, couponID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsagesTx: %w", err)
	}
	return count, nil
}

func (r *couponRepository) CountUsagesByUserTx(ctx context.Context, tx pgx.Tx, couponID int64, userID int64) (int, error) {
	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2`, couponID, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsagesByUserTx: %w", err)
	}
	return count, nil
}

func (r *couponRepository) ExistsByCode(ctx context.Context, code string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM coupons WHERE code = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, code).Scan(&exists); err != nil {
		return false, fmt.Errorf("couponRepository.ExistsByCode: %w", err)
	}
	return exists, nil
}

func scanCoupon(rows pgx.Rows) (*models.Coupon, error) {
	coupon, _, err := scanCouponRow(rows)
	return coupon, err
}

func scanCouponRow(rows pgx.Rows) (*models.Coupon, int64, error) {
	// We scan applicable_to as raw []byte then unmarshal separately
	var (
		coupon        models.Coupon
		applicableRaw []byte
		total         int64
	)

	hasTotalCount := len(rows.FieldDescriptions()) > 14

	var scanErr error
	if hasTotalCount {
		scanErr = rows.Scan(
			&coupon.ID, &coupon.Code, &coupon.Description,
			&coupon.DiscountType, &coupon.DiscountValue,
			&coupon.MaxDiscountAmount, &coupon.MinOrderAmount,
			&coupon.MaxUses, &coupon.MaxUsesPerUser,
			&applicableRaw,
			&coupon.IsActive, &coupon.StartsAt, &coupon.ExpiresAt,
			&coupon.CreatedAt, &coupon.UpdatedAt,
			&total,
		)
	} else {
		if !rows.Next() {
			return nil, 0, pgx.ErrNoRows
		}
		scanErr = rows.Scan(
			&coupon.ID, &coupon.Code, &coupon.Description,
			&coupon.DiscountType, &coupon.DiscountValue,
			&coupon.MaxDiscountAmount, &coupon.MinOrderAmount,
			&coupon.MaxUses, &coupon.MaxUsesPerUser,
			&applicableRaw,
			&coupon.IsActive, &coupon.StartsAt, &coupon.ExpiresAt,
			&coupon.CreatedAt, &coupon.UpdatedAt,
		)
	}

	if scanErr != nil {
		return nil, 0, scanErr
	}

	if applicableRaw != nil {
		var applicable models.ApplicableTo
		if err := json.Unmarshal(applicableRaw, &applicable); err != nil {
			return nil, 0, fmt.Errorf("scanCouponRow unmarshal applicable_to: %w", err)
		}
		coupon.ApplicableTo = &applicable
	}

	return &coupon, total, nil
}

func marshalApplicableTo(a *models.ApplicableTo) ([]byte, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}
