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

const shippingZoneColumns = `
	id, name, description, region_codes, is_active, created_at, updated_at`

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
		RETURNING ` + shippingZoneColumns

	args := pgx.NamedArgs{
		"name":         req.Name,
		"description":  req.Description,
		"region_codes": req.RegionCodes,
		"is_active":    isActive,
	}

	zone, err := scanShippingZone(r.db.QueryRow(ctx, q, args))
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.Create: %w", err)
	}
	return zone, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) GetByID(ctx context.Context, id int64) (*models.ShippingZone, error) {
	q := `SELECT ` + shippingZoneColumns + ` FROM shipping_zones WHERE id = $1`

	zone, err := scanShippingZone(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingZoneRepository.GetByID: %w", err)
	}
	return zone, nil
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

	whereSQL := strings.Join(where, " AND ")
	countQ := `SELECT COUNT(*) FROM shipping_zones WHERE ` + whereSQL
	var total int64
	if err := r.db.QueryRow(ctx, countQ, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("shippingZoneRepository.GetAll count: %w", err)
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT %s
		FROM shipping_zones
		WHERE %s
		ORDER BY %s %s, id %s
		LIMIT @limit OFFSET @offset`,
		shippingZoneColumns, whereSQL, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("shippingZoneRepository.GetAll: %w", err)
	}
	defer rows.Close()

	zones := make([]*models.ShippingZone, 0, f.Limit)

	for rows.Next() {
		zone, err := scanShippingZone(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("shippingZoneRepository.GetAll scan: %w", err)
		}
		zones = append(zones, zone)
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
		SELECT ` + shippingZoneColumns + ` FROM shipping_zones
		WHERE region_codes @> ARRAY[$1]::TEXT[]
		  AND is_active = true
		ORDER BY name ASC, id ASC`

	rows, err := r.db.Query(ctx, q, regionCode)
	if err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.GetByRegionCode: %w", err)
	}
	defer rows.Close()

	result := make([]*models.ShippingZone, 0)
	for rows.Next() {
		zone, err := scanShippingZone(rows)
		if err != nil {
			return nil, fmt.Errorf("shippingZoneRepository.GetByRegionCode scan: %w", err)
		}
		result = append(result, zone)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("shippingZoneRepository.GetByRegionCode rows: %w", err)
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

func (r *shippingZoneRepository) Update(ctx context.Context, id int64, req models.UpdateShippingZoneReq) (*models.ShippingZone, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Name.Set {
		sets = append(sets, "name = @name")
		args["name"] = nullableShippingValue(req.Name.Value)
	}
	if req.Description.Set {
		sets = append(sets, "description = @description")
		args["description"] = nullableShippingValue(req.Description.Value)
	}
	if req.RegionCodes.Set {
		sets = append(sets, "region_codes = @region_codes")
		args["region_codes"] = nullableShippingValue(req.RegionCodes.Value)
	}
	if req.IsActive.Set {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = nullableShippingValue(req.IsActive.Value)
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE shipping_zones SET %s
		WHERE id = @id
		RETURNING %s`,
		strings.Join(sets, ", "),
		shippingZoneColumns,
	)

	zone, err := scanShippingZone(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("shippingZoneRepository.Update: %w", err)
	}
	return zone, nil
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

func scanShippingZone(row pgx.Row) (*models.ShippingZone, error) {
	var zone models.ShippingZone
	if err := row.Scan(
		&zone.ID,
		&zone.Name,
		&zone.Description,
		&zone.RegionCodes,
		&zone.IsActive,
		&zone.CreatedAt,
		&zone.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &zone, nil
}

func nullableShippingValue[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}
