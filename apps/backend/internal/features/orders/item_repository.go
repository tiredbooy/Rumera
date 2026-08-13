package orders

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/cart"
)

type ItemRepository interface {
	BulkCreate(ctx context.Context, tx pgx.Tx, orderID int64, items []cart.CartItemResponse) error
}

type itemRepository struct {
	db *pgxpool.Pool
}

func NewItemRepository(db *pgxpool.Pool) ItemRepository {
	return &itemRepository{db: db}
}

func (r *itemRepository) BulkCreate(ctx context.Context, tx pgx.Tx, orderID int64, items []cart.CartItemResponse) error {
	if len(items) == 0 {
		return nil
	}

	rows := make([]string, len(items))
	args := pgx.NamedArgs{"order_id": orderID}

	for i, item := range items {
		pKey := fmt.Sprintf("product_%d", i)
		vKey := fmt.Sprintf("variant_%d", i) // ← add this
		qKey := fmt.Sprintf("qty_%d", i)
		uKey := fmt.Sprintf("price_%d", i)
		rows[i] = fmt.Sprintf("(@order_id, @%s, @%s, @%s, @%s)", pKey, vKey, qKey, uKey)
		args[pKey] = item.ProductID
		args[vKey] = item.VariantID // ← add this
		args[qKey] = item.Quantity
		args[uKey] = item.UnitPriceSnapshot
	}

	q := fmt.Sprintf(`
		INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price)
		VALUES %s`,
		strings.Join(rows, ", "),
	)

	if _, err := tx.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("itemRepository.BulkCreate: %w", err)
	}
	return nil
}
