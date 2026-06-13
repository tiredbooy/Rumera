// internal/repositories/shipping_zone_repository.go
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

type ShippingZoneRepository interface {
	Create(ctx context.Context, req models.CreateShippingZoneReq) (*models.ShippingZone, error)
	GetByID(ctx context.Context, id int64) (*models.ShippingZone, error)
	GetAll(ctx context.Context, filter models.ShippingZoneFilter) ([]*models.ShippingZone, int64, error)

	// the given code — used at checkout to resolve the buyer's zone.
	GetByRegionCode(ctx context.Context, regionCode string) ([]*models.ShippingZone, error)

	Update(ctx context.Context, id int64, req models.UpdateShippingZoneReq) (*models.ShippingZone, error)
	Delete(ctx context.Context, id int64) error
}

type shippingZoneRepository struct {
	db *pgxpool.Pool
}

func NewShippingZoneRepository(db *pgxpool.Pool) ShippingZoneRepository {
	return &shippingZoneRepository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) Create(ctx context.Context, req models.CreateShippingZoneReq) (*models.ShippingZone, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	const q = `
		INSERT INTO shipping_zones (name, description, region_codes, is_active)
		VALUES (@name, @description, @region_codes, @is_active)
		RETURNING *`

	args := pgx.NamedArgs{
		"name":         req.Name,
		"description":  req.Description,
		"region_codes": req.RegionCodes,
		"is_active":    isActive,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.Create: %w", err)
	}

	zone, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ShippingZone])
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.Create scan: %w", err)
	}
	return &zone, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) GetByID(ctx context.Context, id int64) (*models.ShippingZone, error) {
	const q = `SELECT * FROM shipping_zones WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.GetByID: %w", err)
	}

	zone, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ShippingZone])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingZoneRepository.GetByID scan: %w", err)
	}
	return &zone, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) GetAll(ctx context.Context, f models.ShippingZoneFilter) ([]*models.ShippingZone, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "name ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}
	if f.IsActive != nil {
		where = append(where, "is_active = @is_active")
		args["is_active"] = *f.IsActive
	}

	allowed := map[string]bool{
		"created_at": true,
		"name":       true,
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
		FROM shipping_zones
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("shippingZoneRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		zones []*models.ShippingZone
		total int64
	)

	for rows.Next() {
		var z models.ShippingZone
		if err := rows.Scan(
			&z.ID, &z.Name, &z.Description,
			&z.RegionCodes, &z.IsActive,
			&z.CreatedAt, &z.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("shippingZoneRepository.GetAll scan: %w", err)
		}
		zones = append(zones, &z)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("shippingZoneRepository.GetAll rows: %w", err)
	}

	return zones, total, nil
}

// ─────────────────────────────────────────────────────────────
// GetByRegionCode
// Uses the Postgres array operator @> to check containment.
// e.g. region_codes @> ARRAY['GB'] finds all zones that include GB.
// Called at checkout with the buyer's country/state code.
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) GetByRegionCode(ctx context.Context, regionCode string) ([]*models.ShippingZone, error) {
	const q = `
		SELECT * FROM shipping_zones
		WHERE region_codes @> ARRAY[$1]::TEXT[]
		  AND is_active = true
		ORDER BY name ASC`

	rows, err := r.db.Query(ctx, q, regionCode)
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.GetByRegionCode: %w", err)
	}
	defer rows.Close()

	zones, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ShippingZone])
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.GetByRegionCode scan: %w", err)
	}

	result := make([]*models.ShippingZone, len(zones))
	for i := range zones {
		result[i] = &zones[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) Update(ctx context.Context, id int64, req models.UpdateShippingZoneReq) (*models.ShippingZone, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Name != nil {
		sets = append(sets, "name = @name")
		args["name"] = *req.Name
	}
	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}
	if req.RegionCodes != nil {
		sets = append(sets, "region_codes = @region_codes")
		args["region_codes"] = req.RegionCodes
	}
	if req.IsActive != nil {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = *req.IsActive
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE shipping_zones SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.Update: %w", err)
	}

	zone, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ShippingZone])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingZoneRepository.Update scan: %w", err)
	}
	return &zone, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// Cascades to shipping_methods via FK
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM shipping_zones WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("shippingZoneRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}
