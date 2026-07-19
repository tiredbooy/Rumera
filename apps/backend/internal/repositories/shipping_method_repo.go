// internal/repositories/shipping_method_repository.go
package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type ShippingMethodRepository interface {
	Create(ctx context.Context, zoneID int64, req models.CreateShippingMethodReq) (*models.ShippingMethod, error)
	GetByID(ctx context.Context, id int64) (*models.ShippingMethod, error)
	GetByZoneID(ctx context.Context, zoneID int64, filter models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error)

	// GetAvailable returns active methods for a zone that support the
	// given weight — used at checkout to show valid options to the buyer.
	GetAvailable(ctx context.Context, zoneID int64, weightKg float64) ([]*models.ShippingMethod, error)

	Update(ctx context.Context, id int64, req models.UpdateShippingMethodReq) (*models.ShippingMethod, error)
	Delete(ctx context.Context, id int64) error
}

type shippingMethodRepository struct {
	db *pgxpool.Pool
}

const shippingMethodColumns = `
	id, shipping_zone_id, name, carrier, description, rate_type, base_rate,
	free_above_amount, min_delivery_days, max_delivery_days, max_weight_kg,
	is_active, created_at, updated_at`

func NewShippingMethodRepository(db *pgxpool.Pool) ShippingMethodRepository {
	return &shippingMethodRepository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) Create(ctx context.Context, zoneID int64, req models.CreateShippingMethodReq) (*models.ShippingMethod, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	const q = `
		INSERT INTO shipping_methods (
			shipping_zone_id, name, carrier, description,
			rate_type, base_rate, free_above_amount,
			min_delivery_days, max_delivery_days,
			max_weight_kg, is_active
		) VALUES (
			@zone_id, @name, @carrier, @description,
			@rate_type, @base_rate, @free_above_amount,
			@min_delivery_days, @max_delivery_days,
			@max_weight_kg, @is_active
		)
		RETURNING ` + shippingMethodColumns

	args := pgx.NamedArgs{
		"zone_id":           zoneID,
		"name":              req.Name,
		"carrier":           req.Carrier,
		"description":       req.Description,
		"rate_type":         req.RateType,
		"base_rate":         req.BaseRate,
		"free_above_amount": req.FreeAboveAmount,
		"min_delivery_days": req.MinDeliveryDays,
		"max_delivery_days": req.MaxDeliveryDays,
		"max_weight_kg":     req.MaxWeightKg,
		"is_active":         isActive,
	}

	method, err := scanShippingMethod(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if isShippingForeignKeyViolation(err) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingMethodRepository.Create: %w", err)
	}
	return method, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) GetByID(ctx context.Context, id int64) (*models.ShippingMethod, error) {
	q := `SELECT ` + shippingMethodColumns + ` FROM shipping_methods WHERE id = $1`

	method, err := scanShippingMethod(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingMethodRepository.GetByID: %w", err)
	}
	return method, nil
}

// ─────────────────────────────────────────────────────────────
// GetByZoneID  (paginated + filtered — for admin panel)
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) GetByZoneID(ctx context.Context, zoneID int64, f models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error) {
	where := []string{"shipping_zone_id = @zone_id"}
	args := pgx.NamedArgs{"zone_id": zoneID}

	if f.IsActive != nil {
		where = append(where, "is_active = @is_active")
		args["is_active"] = *f.IsActive
	}
	if f.RateType != nil {
		where = append(where, "rate_type = @rate_type")
		args["rate_type"] = *f.RateType
	}
	if f.Search != "" {
		where = append(where, "name ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}

	allowed := map[string]bool{
		"created_at": true,
		"name":       true,
		"base_rate":  true,
	}
	sortBy := "created_at"
	if allowed[f.SortBy] {
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	whereSQL := strings.Join(where, " AND ")
	countQ := `SELECT COUNT(*) FROM shipping_methods WHERE ` + whereSQL
	var total int64
	if err := r.db.QueryRow(ctx, countQ, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("shippingMethodRepository.GetByZoneID count: %w", err)
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT %s
		FROM shipping_methods
		WHERE %s
		ORDER BY %s %s, id %s
		LIMIT @limit OFFSET @offset`,
		shippingMethodColumns, whereSQL, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("shippingMethodRepository.GetByZoneID: %w", err)
	}
	defer rows.Close()

	methods := make([]*models.ShippingMethod, 0, f.Limit)

	for rows.Next() {
		method, err := scanShippingMethod(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("shippingMethodRepository.GetByZoneID scan: %w", err)
		}
		methods = append(methods, method)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("shippingMethodRepository.GetByZoneID rows: %w", err)
	}

	return methods, total, nil
}

// ─────────────────────────────────────────────────────────────
// GetAvailable
// Returns active methods for a zone that accept the order weight.
// NULL max_weight_kg means no weight limit — those always qualify.
// Called at checkout after resolving the buyer's zone.
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) GetAvailable(ctx context.Context, zoneID int64, weightKg float64) ([]*models.ShippingMethod, error) {
	const q = `
		SELECT ` + shippingMethodColumns + ` FROM shipping_methods
		WHERE shipping_zone_id = $1
		  AND is_active = true
		  AND (max_weight_kg IS NULL OR max_weight_kg >= $2)
		ORDER BY base_rate ASC, name ASC, id ASC`

	rows, err := r.db.Query(ctx, q, zoneID, weightKg)
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.GetAvailable: %w", err)
	}
	defer rows.Close()

	result := make([]*models.ShippingMethod, 0)
	for rows.Next() {
		method, err := scanShippingMethod(rows)
		if err != nil {
			return nil, fmt.Errorf("shippingMethodRepository.GetAvailable scan: %w", err)
		}
		result = append(result, method)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.GetAvailable rows: %w", err)
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) Update(ctx context.Context, id int64, req models.UpdateShippingMethodReq) (*models.ShippingMethod, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Name.Set {
		sets = append(sets, "name = @name")
		args["name"] = nullableShippingValue(req.Name.Value)
	}
	if req.Carrier.Set {
		sets = append(sets, "carrier = @carrier")
		args["carrier"] = nullableShippingValue(req.Carrier.Value)
	}
	if req.Description.Set {
		sets = append(sets, "description = @description")
		args["description"] = nullableShippingValue(req.Description.Value)
	}
	if req.RateType.Set {
		sets = append(sets, "rate_type = @rate_type")
		args["rate_type"] = nullableShippingValue(req.RateType.Value)
	}
	if req.BaseRate.Set {
		sets = append(sets, "base_rate = @base_rate")
		args["base_rate"] = nullableShippingValue(req.BaseRate.Value)
	}
	if req.FreeAboveAmount.Set {
		sets = append(sets, "free_above_amount = @free_above_amount")
		args["free_above_amount"] = nullableShippingValue(req.FreeAboveAmount.Value)
	}
	if req.MinDeliveryDays.Set {
		sets = append(sets, "min_delivery_days = @min_delivery_days")
		args["min_delivery_days"] = nullableShippingValue(req.MinDeliveryDays.Value)
	}
	if req.MaxDeliveryDays.Set {
		sets = append(sets, "max_delivery_days = @max_delivery_days")
		args["max_delivery_days"] = nullableShippingValue(req.MaxDeliveryDays.Value)
	}
	if req.MaxWeightKg.Set {
		sets = append(sets, "max_weight_kg = @max_weight_kg")
		args["max_weight_kg"] = nullableShippingValue(req.MaxWeightKg.Value)
	}
	if req.IsActive.Set {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = nullableShippingValue(req.IsActive.Value)
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE shipping_methods SET %s
		WHERE id = @id
		RETURNING %s`,
		strings.Join(sets, ", "),
		shippingMethodColumns,
	)

	method, err := scanShippingMethod(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingMethodRepository.Update: %w", err)
	}
	return method, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM shipping_methods WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("shippingMethodRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func scanShippingMethod(row pgx.Row) (*models.ShippingMethod, error) {
	var method models.ShippingMethod
	if err := row.Scan(
		&method.ID,
		&method.ShippingZoneID,
		&method.Name,
		&method.Carrier,
		&method.Description,
		&method.RateType,
		&method.BaseRate,
		&method.FreeAboveAmount,
		&method.MinDeliveryDays,
		&method.MaxDeliveryDays,
		&method.MaxWeightKg,
		&method.IsActive,
		&method.CreatedAt,
		&method.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &method, nil
}

func isShippingForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
