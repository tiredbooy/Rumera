package repositories

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type MovementRepository interface {
	GetAll(ctx context.Context, filter models.MovementFilter) ([]*models.InventoryMovement, int64, error)
	GetByVariantID(ctx context.Context, variantID int64) ([]*models.InventoryMovement, error)
}

type movementRepository struct {
	db *pgxpool.Pool
}

func NewMovementRepository(db *pgxpool.Pool) MovementRepository {
	return &movementRepository{db: db}
}

func (r *movementRepository) GetAll(ctx context.Context, f models.MovementFilter) ([]*models.InventoryMovement, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.ProductVariantID != nil {
		where = append(where, "product_variant_id = @variant_id")
		args["variant_id"] = *f.ProductVariantID
	}
	if f.Type != nil {
		where = append(where, "type = @type")
		args["type"] = *f.Type
	}
	if f.OrderID != nil {
		where = append(where, "reference_order_id = @order_id")
		args["order_id"] = *f.OrderID
	}

	allowed := map[string]bool{"created_at": true}
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
		FROM inventory_movements
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("movementRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		movements []*models.InventoryMovement
		total     int64
	)

	for rows.Next() {
		var m models.InventoryMovement
		if err := rows.Scan(
			&m.ID, &m.ProductVariantID,
			&m.Quantity, &m.Type,
			&m.ReferenceOrderID, &m.Note,
			&m.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("movementRepository.GetAll scan: %w", err)
		}
		movements = append(movements, &m)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("movementRepository.GetAll rows: %w", err)
	}

	return movements, total, nil
}

func (r *movementRepository) GetByVariantID(ctx context.Context, variantID int64) ([]*models.InventoryMovement, error) {
	const q = `
		SELECT * FROM inventory_movements
		WHERE product_variant_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("movementRepository.GetByVariantID: %w", err)
	}
	defer rows.Close()

	movements, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.InventoryMovement])
	if err != nil {
		return nil, fmt.Errorf("movementRepository.GetByVariantID scan: %w", err)
	}

	result := make([]*models.InventoryMovement, len(movements))
	for i := range movements {
		result[i] = &movements[i]
	}
	return result, nil
}
