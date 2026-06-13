// internal/repositories/shipping_method_repository.go
package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
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
		RETURNING *`

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

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.Create: %w", err)
	}

	method, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ShippingMethod])
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.Create scan: %w", err)
	}
	return &method, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) GetByID(ctx context.Context, id int64) (*models.ShippingMethod, error) {
	const q = `SELECT * FROM shipping_methods WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.GetByID: %w", err)
	}

	method, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ShippingMethod])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingMethodRepository.GetByID scan: %w", err)
	}
	return &method, nil
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

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT *, COUNT(*) OVER() AS total_count
		FROM shipping_methods
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("shippingMethodRepository.GetByZoneID: %w", err)
	}
	defer rows.Close()

	var (
		methods []*models.ShippingMethod
		total   int64
	)

	for rows.Next() {
		var m models.ShippingMethod
		if err := rows.Scan(
			&m.ID, &m.ShippingZoneID,
			&m.Name, &m.Carrier, &m.Description,
			&m.RateType, &m.BaseRate, &m.FreeAboveAmount,
			&m.MinDeliveryDays, &m.MaxDeliveryDays,
			&m.MaxWeightKg, &m.IsActive,
			&m.CreatedAt, &m.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("shippingMethodRepository.GetByZoneID scan: %w", err)
		}
		methods = append(methods, &m)
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
		SELECT * FROM shipping_methods
		WHERE shipping_zone_id = $1
		  AND is_active = true
		  AND (max_weight_kg IS NULL OR max_weight_kg >= $2)
		ORDER BY base_rate ASC`

	rows, err := r.db.Query(ctx, q, zoneID, weightKg)
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.GetAvailable: %w", err)
	}
	defer rows.Close()

	methods, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ShippingMethod])
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.GetAvailable scan: %w", err)
	}

	result := make([]*models.ShippingMethod, len(methods))
	for i := range methods {
		result[i] = &methods[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

func (r *shippingMethodRepository) Update(ctx context.Context, id int64, req models.UpdateShippingMethodReq) (*models.ShippingMethod, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Name != nil {
		sets = append(sets, "name = @name")
		args["name"] = *req.Name
	}
	if req.Carrier != nil {
		sets = append(sets, "carrier = @carrier")
		args["carrier"] = *req.Carrier
	}
	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}
	if req.RateType != nil {
		sets = append(sets, "rate_type = @rate_type")
		args["rate_type"] = *req.RateType
	}
	if req.BaseRate != nil {
		sets = append(sets, "base_rate = @base_rate")
		args["base_rate"] = *req.BaseRate
	}
	if req.FreeAboveAmount != nil {
		sets = append(sets, "free_above_amount = @free_above_amount")
		args["free_above_amount"] = *req.FreeAboveAmount
	}
	if req.MinDeliveryDays != nil {
		sets = append(sets, "min_delivery_days = @min_delivery_days")
		args["min_delivery_days"] = *req.MinDeliveryDays
	}
	if req.MaxDeliveryDays != nil {
		sets = append(sets, "max_delivery_days = @max_delivery_days")
		args["max_delivery_days"] = *req.MaxDeliveryDays
	}
	if req.MaxWeightKg != nil {
		sets = append(sets, "max_weight_kg = @max_weight_kg")
		args["max_weight_kg"] = *req.MaxWeightKg
	}
	if req.IsActive != nil {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = *req.IsActive
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE shipping_methods SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("shippingMethodRepository.Update: %w", err)
	}

	method, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ShippingMethod])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingMethodRepository.Update scan: %w", err)
	}
	return &method, nil
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
