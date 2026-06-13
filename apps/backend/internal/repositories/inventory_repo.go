package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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

func NewInventoryRepository(db *pgxpool.Pool) InventoryRepository {
	return &inventoryRepository{db: db}
}

func (r *inventoryRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *inventoryRepository) GetByVariantID(ctx context.Context, variantID int64) (*models.Inventory, error) {
	const q = `SELECT * FROM inventory WHERE product_variant_id = $1`

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
		where = append(where, "stock_on_hand <= reorder_point")
	}

	allowed := map[string]bool{
		"updated_at":    true,
		"stock_on_hand": true,
	}
	sortBy := "updated_at"
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
		FROM inventory
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
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
	const q = `
		SELECT * FROM inventory
		WHERE stock_on_hand <= reorder_point
		  AND reorder_point > 0
		ORDER BY stock_on_hand ASC`

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
		    updated_at    = NOW()
		WHERE product_variant_id = @variant_id`

	updateArgs := pgx.NamedArgs{
		"quantity":   req.Quantity,
		"variant_id": variantID,
	}

	if req.Type == models.MovementTypeRestock {
		updateArgs["last_restock_at"] = time.Now()
	}

	if _, err := tx.Exec(ctx, updateQ, updateArgs); err != nil {
		return fmt.Errorf("inventoryRepository.Adjust update: %w", err)
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
		WHERE product_variant_id = @variant_id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("inventoryRepository.UpdateReorder: %w", err)
	}

	inv, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Inventory])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("inventoryRepository.UpdateReorder scan: %w", err)
	}
	return &inv, nil
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
