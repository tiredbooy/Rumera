package inventory

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MovementRepository interface {
	GetAll(ctx context.Context, filter MovementFilter) ([]*InventoryMovement, int64, error)
	GetByVariantID(ctx context.Context, variantID int64) ([]*InventoryMovement, error)
}

type movementRepository struct {
	db *pgxpool.Pool
}

func NewMovementRepository(db *pgxpool.Pool) MovementRepository {
	return &movementRepository{db: db}
}

func (r *movementRepository) GetAll(ctx context.Context, f MovementFilter) ([]*InventoryMovement, int64, error) {
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
	whereSQL := strings.Join(where, " AND ")
	q := fmt.Sprintf(`
		WITH filtered AS (
			SELECT id, product_variant_id, quantity, type, reference_order_id, note, created_at
			FROM inventory_movements
			WHERE %s
		), page_rows AS (
			SELECT *
			FROM filtered
			ORDER BY %s %s, id %s
			LIMIT @limit OFFSET @offset
		), total AS (
			SELECT COUNT(*)::bigint AS total_count FROM filtered
		)
		SELECT p.id, p.product_variant_id, p.quantity, p.type,
		       p.reference_order_id, p.note, p.created_at, total.total_count
		FROM total
		LEFT JOIN page_rows p ON TRUE
		ORDER BY p.%s %s NULLS LAST, p.id %s NULLS LAST`,
		whereSQL, sortBy, order, order, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("movementRepository.GetAll: %w", err)
	}
	defer rows.Close()

	movements := make([]*InventoryMovement, 0)
	var total int64

	for rows.Next() {
		var (
			id        *int64
			variantID *int64
			quantity  *int
			typeValue *MovementType
			orderID   *int64
			note      *string
			createdAt *time.Time
			rowTotal  int64
		)
		if err := rows.Scan(
			&id, &variantID, &quantity, &typeValue,
			&orderID, &note, &createdAt, &rowTotal,
		); err != nil {
			return nil, 0, fmt.Errorf("movementRepository.GetAll scan: %w", err)
		}
		total = rowTotal
		if id == nil {
			continue
		}
		movements = append(movements, &InventoryMovement{
			ID:               *id,
			ProductVariantID: *variantID,
			Quantity:         *quantity,
			Type:             *typeValue,
			ReferenceOrderID: orderID,
			Note:             note,
			CreatedAt:        *createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("movementRepository.GetAll rows: %w", err)
	}

	return movements, total, nil
}

func (r *movementRepository) GetByVariantID(ctx context.Context, variantID int64) ([]*InventoryMovement, error) {
	const q = `
		SELECT id, product_variant_id, quantity, type, reference_order_id, note, created_at
		FROM inventory_movements
		WHERE product_variant_id = $1
		ORDER BY created_at DESC, id DESC`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("movementRepository.GetByVariantID: %w", err)
	}
	defer rows.Close()

	movements, err := pgx.CollectRows(rows, pgx.RowToStructByName[InventoryMovement])
	if err != nil {
		return nil, fmt.Errorf("movementRepository.GetByVariantID scan: %w", err)
	}

	result := make([]*InventoryMovement, len(movements))
	for i := range movements {
		result[i] = &movements[i]
	}
	return result, nil
}
