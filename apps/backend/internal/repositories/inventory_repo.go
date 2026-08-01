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
	` + inventoryRelations

const inventoryRelations = `
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
		"id":              "id",
		"updated_at":      "updated_at",
		"stock_on_hand":   "stock_on_hand",
		"available_stock": "available_stock",
		"reorder_point":   "reorder_point",
		"product_title":   "product_title",
		"sku":             "sku",
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

	q := fmt.Sprintf(`
		WITH filtered AS (
			SELECT %s,
			       i.stock_on_hand - i.committed_stock AS available_stock
			%s
			WHERE %s
		), page_rows AS (
			SELECT *
			FROM filtered
			ORDER BY %s %s NULLS LAST, id %s
			LIMIT @limit OFFSET @offset
		), total AS (
			SELECT COUNT(*)::bigint AS total_count FROM filtered
		)
		SELECT p.id, p.product_variant_id, p.product_id, p.product_title,
		       p.sku, p.category_title, p.unit_price, p.stock_on_hand,
		       p.committed_stock, p.reorder_point, p.reorder_quantity,
		       p.last_restock_at, p.updated_at, total.total_count
		FROM total
		LEFT JOIN page_rows p ON TRUE
		ORDER BY p.%s %s NULLS LAST, p.id %s NULLS LAST`,
		inventoryProjection, inventoryJoins, strings.Join(where, " AND "),
		sortBy, order, order, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("inventoryRepository.GetAll: %w", err)
	}
	defer rows.Close()

	items := make([]*models.Inventory, 0)
	var total int64

	for rows.Next() {
		var (
			id               *int64
			productVariantID *int64
			productID        *int64
			productTitle     *string
			sku              *string
			categoryTitle    *string
			unitPrice        *string
			stockOnHand      *int
			committedStock   *int
			reorderPoint     *int
			reorderQuantity  *int
			lastRestockAt    *time.Time
			updatedAt        *time.Time
			rowTotal         int64
		)
		if err := rows.Scan(
			&id, &productVariantID, &productID, &productTitle,
			&sku, &categoryTitle, &unitPrice, &stockOnHand, &committedStock,
			&reorderPoint, &reorderQuantity, &lastRestockAt, &updatedAt,
			&rowTotal,
		); err != nil {
			return nil, 0, fmt.Errorf("inventoryRepository.GetAll scan: %w", err)
		}
		total = rowTotal
		if id == nil {
			continue
		}
		items = append(items, &models.Inventory{
			ID:               *id,
			ProductVariantID: *productVariantID,
			ProductID:        *productID,
			ProductTitle:     *productTitle,
			SKU:              sku,
			CategoryTitle:    categoryTitle,
			UnitPrice:        *unitPrice,
			StockOnHand:      *stockOnHand,
			CommittedStock:   *committedStock,
			ReorderPoint:     *reorderPoint,
			ReorderQuantity:  *reorderQuantity,
			LastRestockAt:    lastRestockAt,
			UpdatedAt:        *updatedAt,
		})
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
		WHERE product_variant_id = @variant_id
		  AND stock_on_hand::bigint + @quantity BETWEEN committed_stock AND 2147483647`

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
		return classifyInventoryMutationMiss(ctx, tx, variantID, models.ErrInsufficientStock)
	}

	return recordMovement(ctx, tx, variantID, req.Quantity, req.Type, orderID, req.Note)
}

func (r *inventoryRepository) Reserve(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	// Reservations move physical stock from available to committed without changing
	// stock_on_hand. Payment confirmation performs the physical deduction.
	const q = `
		UPDATE inventory
		SET committed_stock = committed_stock + @quantity,
		    updated_at = NOW()
		WHERE product_variant_id = @variant_id
		  AND stock_on_hand - committed_stock >= @quantity`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
	}

	res, err := tx.Exec(ctx, q, args)
	if err != nil {
		return fmt.Errorf("inventoryRepository.Reserve: %w", err)
	}
	if res.RowsAffected() == 0 {
		return classifyInventoryMutationMiss(ctx, tx, variantID, models.ErrInsufficientStock)
	}

	note := fmt.Sprintf("reserved for order %d", orderID)
	return recordMovement(ctx, tx, variantID, -quantity, models.MovementTypeReservation, &orderID, &note)
}

func (r *inventoryRepository) Release(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	const q = `
		UPDATE inventory
		SET committed_stock = committed_stock - @quantity,
		    updated_at = NOW()
		WHERE product_variant_id = @variant_id
		  AND committed_stock >= @quantity`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
	}

	res, err := tx.Exec(ctx, q, args)
	if err != nil {
		return fmt.Errorf("inventoryRepository.Release: %w", err)
	}
	if res.RowsAffected() == 0 {
		return classifyInventoryMutationMiss(ctx, tx, variantID, models.ErrInvalidState)
	}

	note := fmt.Sprintf("released from order %d", orderID)
	return recordMovement(ctx, tx, variantID, quantity, models.MovementTypeRelease, &orderID, &note)
}

func (r *inventoryRepository) Deduct(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	// Payment confirmation removes the reserved quantity from both physical and
	// committed stock, leaving available stock unchanged.
	const q = `
		UPDATE inventory
		SET stock_on_hand = stock_on_hand - @quantity,
		    committed_stock = committed_stock - @quantity,
		    updated_at = NOW()
		WHERE product_variant_id = @variant_id
		  AND stock_on_hand >= @quantity
		  AND committed_stock >= @quantity`

	args := pgx.NamedArgs{
		"variant_id": variantID,
		"quantity":   quantity,
	}

	res, err := tx.Exec(ctx, q, args)
	if err != nil {
		return fmt.Errorf("inventoryRepository.Deduct: %w", err)
	}
	if res.RowsAffected() == 0 {
		return classifyInventoryMutationMiss(ctx, tx, variantID, models.ErrInvalidState)
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
		WITH updated AS (
			UPDATE inventory SET %s
			WHERE product_variant_id = @variant_id
			RETURNING *
		)
		SELECT %s
		FROM updated i
		%s`,
		strings.Join(sets, ", "), inventoryProjection, inventoryRelations,
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

func classifyInventoryMutationMiss(ctx context.Context, tx pgx.Tx, variantID int64, existingError error) error {
	var exists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM inventory WHERE product_variant_id = $1)`,
		variantID,
	).Scan(&exists); err != nil {
		return fmt.Errorf("classify inventory mutation miss: %w", err)
	}
	if !exists {
		return models.ErrNotFound
	}
	return existingError
}
