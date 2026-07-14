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

type InventoryRepository interface {
	GetByVariantID(ctx context.Context, variantID int64) (*models.Inventory, error)
	GetAll(ctx context.Context, filter models.InventoryFilter) ([]*models.Inventory, int64, error)
	GetLowStock(ctx context.Context) ([]*models.Inventory, error)

	Adjust(ctx context.Context, tx pgx.Tx, variantID int64, req models.AdjustStockReq, orderID *int64) error

	Reserve(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error

	Release(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error

	Deduct(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error

	UpdateReorder(ctx context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error)
	BeginTx(ctx context.Context) (pgx.Tx, error)
}

type inventoryRepository struct {
	db *pgxpool.Pool
}

const inventoryProjection = `
	i.id,
	i.product_variant_id,
	pv.product_id,
	p.title AS product_title,
	pv.sku,
	c.title AS category_title,
	pv.price::text AS unit_price,
	i.stock_on_hand,
	i.committed_stock,
	i.reorder_point,
	i.reorder_quantity,
	i.last_restock_at,
	i.updated_at`

const inventoryJoins = `
	FROM inventory i
	JOIN product_variants pv ON pv.id = i.product_variant_id
	JOIN products p ON p.id = pv.product_id
	LEFT JOIN categories c ON c.id = p.category_id`

func NewInventoryRepository(db *pgxpool.Pool) InventoryRepository {
	return &inventoryRepository{db: db}
}

func (r *inventoryRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *inventoryRepository) GetByVariantID(ctx context.Context, variantID int64) (*models.Inventory, error) {
	q := `SELECT ` + inventoryProjection + inventoryJoins + ` WHERE i.product_variant_id = $1`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("inventoryRepository.GetByVariantID: %w", err)
	}

	inv, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Inventory])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("inventoryRepository.GetByVariantID scan: %w", err)
	}
	return &inv, nil
}

func (r *inventoryRepository) GetAll(ctx context.Context, f models.InventoryFilter) ([]*models.Inventory, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.LowStock {
		where = append(where, "i.stock_on_hand - i.committed_stock <= i.reorder_point")
	}
	if search := strings.TrimSpace(f.Search); search != "" {
		where = append(where, "(p.title ILIKE @search OR pv.sku ILIKE @search)")
		args["search"] = "%" + search + "%"
	}

	allowed := map[string]string{
		"updated_at":      "i.updated_at",
		"stock_on_hand":   "i.stock_on_hand",
		"available_stock": "i.stock_on_hand - i.committed_stock",
		"reorder_point":   "i.reorder_point",
		"product_title":   "p.title",
		"sku":             "pv.sku",
	}
	sortBy := allowed["updated_at"]
	if column, ok := allowed[f.SortBy]; ok {
		sortBy = column
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`SELECT %s, COUNT(*) OVER() AS total_count
		%s
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		inventoryProjection, inventoryJoins, strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("inventoryRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		items []*models.Inventory
		total int64
	)

	for rows.Next() {
		var inv models.Inventory
		if err := rows.Scan(
			&inv.ID, &inv.ProductVariantID,
			&inv.ProductID, &inv.ProductTitle,
			&inv.SKU, &inv.CategoryTitle, &inv.UnitPrice,
			&inv.StockOnHand, &inv.CommittedStock,
			&inv.ReorderPoint, &inv.ReorderQuantity,
			&inv.LastRestockAt, &inv.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("inventoryRepository.GetAll scan: %w", err)
		}
		items = append(items, &inv)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("inventoryRepository.GetAll rows: %w", err)
	}

	return items, total, nil
}

func (r *inventoryRepository) GetLowStock(ctx context.Context) ([]*models.Inventory, error) {
	q := `SELECT ` + inventoryProjection + inventoryJoins + `
		WHERE i.stock_on_hand - i.committed_stock <= i.reorder_point
		ORDER BY i.stock_on_hand - i.committed_stock ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("inventoryRepository.GetLowStock: %w", err)
	}
	defer rows.Close()

	invs, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Inventory])
	if err != nil {
		return nil, fmt.Errorf("inventoryRepository.GetLowStock scan: %w", err)
	}

	result := make([]*models.Inventory, len(invs))
	for i := range invs {
		result[i] = &invs[i]
	}
	return result, nil
}

func (r *inventoryRepository) Adjust(ctx context.Context, tx pgx.Tx, variantID int64, req models.AdjustStockReq, orderID *int64) error {
	// Positive quantity = stock in (restock, refund, release)
	// Negative quantity = stock out (purchase, damage, adjustment)
	const updateQ = `
		UPDATE inventory
		SET stock_on_hand = stock_on_hand + @quantity,
		    last_restock_at = CASE
		        WHEN @movement_type = 'restock' THEN NOW()
		        ELSE last_restock_at
		    END,
		    updated_at    = NOW()
		WHERE product_variant_id = @variant_id`

	updateArgs := pgx.NamedArgs{
		"quantity":      req.Quantity,
		"movement_type": req.Type,
		"variant_id":    variantID,
	}

	result, err := tx.Exec(ctx, updateQ, updateArgs)
	if err != nil {
		return fmt.Errorf("inventoryRepository.Adjust update: %w", err)
	}
	if result.RowsAffected() == 0 {
		return models.ErrNotFound
	}

	return recordMovement(ctx, tx, variantID, req.Quantity, req.Type, orderID, req.Note)
}

func (r *inventoryRepository) Reserve(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	// Move from available → committed. The CHECK constraint on stock_on_hand >= 0
	// will reject this if there's not enough stock — no separate availability check needed.
	const q = `
		UPDATE inventory
		SET stock_on_hand   = stock_on_hand - @quantity,
		    committed_stock = committed_stock + @quantity,
		    updated_at      = NOW()
		WHERE product_variant_id = @variant_id
		  AND stock_on_hand >= @quantity`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
	}

	res, err := tx.Exec(ctx, q, args)
	if err != nil {
		return fmt.Errorf("inventoryRepository.Reserve: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrInsufficientStock
	}

	note := fmt.Sprintf("reserved for order %d", orderID)
	return recordMovement(ctx, tx, variantID, -quantity, models.MovementTypeReservation, &orderID, &note)
}

func (r *inventoryRepository) Release(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	const q = `
		UPDATE inventory
		SET stock_on_hand   = stock_on_hand + @quantity,
		    committed_stock = committed_stock - @quantity,
		    updated_at      = NOW()
		WHERE product_variant_id = @variant_id`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
	}

	if _, err := tx.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("inventoryRepository.Release: %w", err)
	}

	note := fmt.Sprintf("released from order %d", orderID)
	return recordMovement(ctx, tx, variantID, quantity, models.MovementTypeRelease, &orderID, &note)
}

func (r *inventoryRepository) Deduct(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	// At this point stock_on_hand was already decremented during Reserve.
	// We only clear committed_stock since the sale is now confirmed.
	const q = `
		UPDATE inventory
		SET committed_stock = committed_stock - @quantity,
		    updated_at      = NOW()
		WHERE product_variant_id = @variant_id`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
	}

	if _, err := tx.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("inventoryRepository.Deduct: %w", err)
	}

	note := fmt.Sprintf("confirmed sale for order %d", orderID)
	return recordMovement(ctx, tx, variantID, -quantity, models.MovementTypePurchase, &orderID, &note)
}

func (r *inventoryRepository) UpdateReorder(ctx context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error) {
	sets := []string{}
	args := pgx.NamedArgs{"variant_id": variantID}

	if req.ReorderPoint != nil {
		sets = append(sets, "reorder_point = @reorder_point")
		args["reorder_point"] = *req.ReorderPoint
	}
	if req.ReorderQuantity != nil {
		sets = append(sets, "reorder_quantity = @reorder_quantity")
		args["reorder_quantity"] = *req.ReorderQuantity
	}

	if len(sets) == 0 {
		return r.GetByVariantID(ctx, variantID)
	}

	sets = append(sets, "updated_at = NOW()")

	q := fmt.Sprintf(`
		UPDATE inventory SET %s
		WHERE product_variant_id = @variant_id`,
		strings.Join(sets, ", "),
	)

	result, err := r.db.Exec(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("inventoryRepository.UpdateReorder: %w", err)
	}
	if result.RowsAffected() == 0 {
		return nil, models.ErrNotFound
	}

	return r.GetByVariantID(ctx, variantID)
}

func recordMovement(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, movType models.MovementType, orderID *int64, note *string) error {
	const q = `
		INSERT INTO inventory_movements
			(product_variant_id, quantity, type, reference_order_id, note)
		VALUES
			(@variant_id, @quantity, @type, @order_id, @note)`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
		"type":       movType,
		"order_id":   orderID,
		"note":       note,
	}

	if _, err := tx.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("recordMovement: %w", err)
	}
	return nil
}
