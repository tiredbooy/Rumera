// internal/repositories/coupon_repository.go
package coupons

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

type Repository interface {
	Create(ctx context.Context, req CreateCouponReq) (*Coupon, error)
	GetByID(ctx context.Context, id int64) (*Coupon, error)
	GetByCode(ctx context.Context, code string) (*Coupon, error)
	GetAll(ctx context.Context, filter CouponFilter) ([]*Coupon, int64, error)
	Update(ctx context.Context, id int64, req UpdateCouponReq) (*Coupon, error)
	Delete(ctx context.Context, id int64) error

	// CountUsages returns total times a coupon has been used.
	CountUsages(ctx context.Context, couponID int64) (int, error)

	// CountUsagesByUser returns how many times a specific user used a coupon.
	CountUsagesByUser(ctx context.Context, couponID int64, userID int64) (int, error)

	// LockByID takes a row lock on the coupon (SELECT ... FOR UPDATE) within tx,
	// so concurrent redemptions of the same coupon serialize and the usage-limit
	// re-check below is race-free.
	LockByID(ctx context.Context, tx pgx.Tx, id int64) error
	// GetByIDForUpdate reloads the coupon definition under a row lock so order
	// creation re-validates the current definition after taking the redemption lock.
	GetByIDForUpdate(ctx context.Context, tx pgx.Tx, id int64) (*Coupon, error)
	// CountUsagesTx / CountUsagesByUserTx count usages on the supplied tx (used
	// for the locked re-check inside order creation).
	CountUsagesTx(ctx context.Context, tx pgx.Tx, couponID int64) (int, error)
	CountUsagesByUserTx(ctx context.Context, tx pgx.Tx, couponID int64, userID int64) (int, error)
	// CountUsagesByIDs returns total redemptions keyed by coupon id for admin lists.
	CountUsagesByIDs(ctx context.Context, ids []int64) (map[int64]int, error)

	ExistsByCode(ctx context.Context, code string) (bool, error)
	// Deactivate marks a coupon inactive without deleting redemption history.
	Deactivate(ctx context.Context, id int64) (*Coupon, error)
}

type repository struct {
	db *pgxpool.Pool
}

const couponColumns = `
	id, code, description, discount_type, discount_value,
	max_discount_amount, min_order_amount, max_uses, max_uses_per_user,
	applicable_to, is_active, starts_at, expires_at, created_at, updated_at`

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, req CreateCouponReq) (*Coupon, error) {
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
		ON CONFLICT (code) DO NOTHING
		RETURNING ` + couponColumns

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

	coupon, err := scanCoupon(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("couponRepository.Create: %w", err)
	}
	return coupon, nil
}

func (r *repository) GetByID(ctx context.Context, id int64) (*Coupon, error) {
	q := `SELECT ` + couponColumns + ` FROM coupons WHERE id = $1`

	coupon, err := scanCoupon(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.GetByID: %w", err)
	}
	return coupon, nil
}

func (r *repository) GetByCode(ctx context.Context, code string) (*Coupon, error) {
	q := `SELECT ` + couponColumns + ` FROM coupons WHERE code = $1`

	coupon, err := scanCoupon(r.db.QueryRow(ctx, q, code))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.GetByCode: %w", err)
	}
	return coupon, nil
}

func (r *repository) GetAll(ctx context.Context, f CouponFilter) ([]*Coupon, int64, error) {
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

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM coupons WHERE %s`, strings.Join(where, " AND "))
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("couponRepository.GetAll count: %w", err)
	}
	if total == 0 {
		return []*Coupon{}, 0, nil
	}

	q := fmt.Sprintf(`
		SELECT %s
		FROM coupons
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		couponColumns, strings.Join(where, " AND "), sortBy, order,
	)
	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("couponRepository.GetAll: %w", err)
	}
	defer rows.Close()

	coupons := make([]*Coupon, 0, f.Limit)

	for rows.Next() {
		coupon, err := scanCoupon(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("couponRepository.GetAll scan: %w", err)
		}
		coupons = append(coupons, coupon)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("couponRepository.GetAll rows: %w", err)
	}

	return coupons, total, nil
}

func (r *repository) Update(ctx context.Context, id int64, req UpdateCouponReq) (*Coupon, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Description.Set {
		sets = append(sets, "description = @description")
		args["description"] = nullableArg(req.Description.Value)
	}
	if req.DiscountValue.Set {
		sets = append(sets, "discount_value = @discount_value")
		args["discount_value"] = nullableArg(req.DiscountValue.Value)
	}
	if req.MaxDiscountAmount.Set {
		sets = append(sets, "max_discount_amount = @max_discount_amount")
		args["max_discount_amount"] = nullableArg(req.MaxDiscountAmount.Value)
	}
	if req.MinOrderAmount.Set {
		sets = append(sets, "min_order_amount = @min_order_amount")
		args["min_order_amount"] = nullableArg(req.MinOrderAmount.Value)
	}
	if req.MaxUses.Set {
		sets = append(sets, "max_uses = @max_uses")
		args["max_uses"] = nullableArg(req.MaxUses.Value)
	}
	if req.MaxUsesPerUser.Set {
		sets = append(sets, "max_uses_per_user = @max_uses_per_user")
		args["max_uses_per_user"] = nullableArg(req.MaxUsesPerUser.Value)
	}
	if req.ApplicableTo.Set {
		var applicableTo []byte
		if req.ApplicableTo.Value != nil {
			var err error
			applicableTo, err = marshalApplicableTo(req.ApplicableTo.Value)
			if err != nil {
				return nil, fmt.Errorf("couponRepository.Update marshal: %w", err)
			}
		}
		sets = append(sets, "applicable_to = @applicable_to")
		args["applicable_to"] = applicableTo
	}
	if req.IsActive.Set {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = nullableArg(req.IsActive.Value)
	}
	if req.StartsAt.Set {
		sets = append(sets, "starts_at = @starts_at")
		args["starts_at"] = nullableArg(req.StartsAt.Value)
	}
	if req.ExpiresAt.Set {
		sets = append(sets, "expires_at = @expires_at")
		args["expires_at"] = nullableArg(req.ExpiresAt.Value)
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}
	where := "id = @id"
	if !req.ExpectedUpdatedAt.IsZero() {
		where += " AND updated_at = @expected_updated_at"
		args["expected_updated_at"] = req.ExpectedUpdatedAt
	}

	q := fmt.Sprintf(`
		UPDATE coupons SET %s
		WHERE %s
		RETURNING %s`,
		strings.Join(sets, ", "), where, couponColumns,
	)

	coupon, err := scanCoupon(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if !req.ExpectedUpdatedAt.IsZero() {
				return nil, models.ErrConflict
			}
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.Update: %w", err)
	}
	return coupon, nil
}

func (r *repository) Delete(ctx context.Context, id int64) error {
	// Destructive hard-delete is no longer supported; deactivate instead so order
	// and redemption history remain intact.
	_, err := r.Deactivate(ctx, id)
	return err
}

func (r *repository) Deactivate(ctx context.Context, id int64) (*Coupon, error) {
	const q = `
		UPDATE coupons
		SET is_active = false, updated_at = NOW()
		WHERE id = $1
		RETURNING ` + couponColumns

	coupon, err := scanCoupon(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.Deactivate: %w", err)
	}
	return coupon, nil
}

func (r *repository) CountUsages(ctx context.Context, couponID int64) (int, error) {
	const q = `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1`

	var count int
	if err := r.db.QueryRow(ctx, q, couponID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsages: %w", err)
	}
	return count, nil
}

func (r *repository) CountUsagesByUser(ctx context.Context, couponID int64, userID int64) (int, error) {
	const q = `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2`

	var count int
	if err := r.db.QueryRow(ctx, q, couponID, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsagesByUser: %w", err)
	}
	return count, nil
}

func (r *repository) LockByID(ctx context.Context, tx pgx.Tx, id int64) error {
	_, err := r.GetByIDForUpdate(ctx, tx, id)
	return err
}

func (r *repository) GetByIDForUpdate(ctx context.Context, tx pgx.Tx, id int64) (*Coupon, error) {
	q := `SELECT ` + couponColumns + ` FROM coupons WHERE id = $1 FOR UPDATE`
	coupon, err := scanCoupon(tx.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("couponRepository.GetByIDForUpdate: %w", err)
	}
	return coupon, nil
}

func (r *repository) CountUsagesByIDs(ctx context.Context, ids []int64) (map[int64]int, error) {
	out := make(map[int64]int, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT coupon_id, COUNT(*)::int
		FROM coupon_usages
		WHERE coupon_id = ANY($1)
		GROUP BY coupon_id`, ids)
	if err != nil {
		return nil, fmt.Errorf("couponRepository.CountUsagesByIDs: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			return nil, fmt.Errorf("couponRepository.CountUsagesByIDs scan: %w", err)
		}
		out[id] = count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("couponRepository.CountUsagesByIDs rows: %w", err)
	}
	return out, nil
}

func (r *repository) CountUsagesTx(ctx context.Context, tx pgx.Tx, couponID int64) (int, error) {
	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1`, couponID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsagesTx: %w", err)
	}
	return count, nil
}

func (r *repository) CountUsagesByUserTx(ctx context.Context, tx pgx.Tx, couponID int64, userID int64) (int, error) {
	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2`, couponID, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("couponRepository.CountUsagesByUserTx: %w", err)
	}
	return count, nil
}

func (r *repository) ExistsByCode(ctx context.Context, code string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM coupons WHERE code = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, code).Scan(&exists); err != nil {
		return false, fmt.Errorf("couponRepository.ExistsByCode: %w", err)
	}
	return exists, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanCoupon(row rowScanner) (*Coupon, error) {
	var (
		coupon        Coupon
		applicableRaw []byte
	)

	if err := row.Scan(
		&coupon.ID, &coupon.Code, &coupon.Description,
		&coupon.DiscountType, &coupon.DiscountValue,
		&coupon.MaxDiscountAmount, &coupon.MinOrderAmount,
		&coupon.MaxUses, &coupon.MaxUsesPerUser,
		&applicableRaw,
		&coupon.IsActive, &coupon.StartsAt, &coupon.ExpiresAt,
		&coupon.CreatedAt, &coupon.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if applicableRaw != nil {
		var applicable ApplicableTo
		if err := json.Unmarshal(applicableRaw, &applicable); err != nil {
			return nil, fmt.Errorf("scanCoupon unmarshal applicable_to: %w", err)
		}
		coupon.ApplicableTo = &applicable
	}

	return &coupon, nil
}

func marshalApplicableTo(a *ApplicableTo) ([]byte, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}
