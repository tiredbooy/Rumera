// internal/repositories/cart_repository.go
package cart

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	// Cart lifecycle
	GetOrCreate(ctx context.Context, userID int64) (*Cart, error)
	GetByUserID(ctx context.Context, userID int64) (*Cart, error)
	Clear(ctx context.Context, tx pgx.Tx, cartID int64) error
	Delete(ctx context.Context, cartID int64) error

	// Items
	AddItem(ctx context.Context, cartID int64, req AddCartItemReq) (*CartItem, error)
	UpdateItem(ctx context.Context, cartID int64, itemID int64, req UpdateCartItemReq) (*CartItem, error)
	RemoveItem(ctx context.Context, cartID int64, itemID int64) error
	GetItems(ctx context.Context, cartID int64) ([]CartItemResponse, error)
}

type cartRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &cartRepository{db: db}
}

// GetOrCreate inserts the caller's cart or touches updated_at.
// Requires UNIQUE(carts.user_id) — 20260816170000_carts_user_id_unique.sql.
func (r *cartRepository) GetOrCreate(ctx context.Context, userID int64) (*Cart, error) {
	const q = `
		INSERT INTO carts (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING *`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetOrCreate: %w", err)
	}

	cart, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Cart])
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetOrCreate scan: %w", err)
	}
	return &cart, nil
}

func (r *cartRepository) GetByUserID(ctx context.Context, userID int64) (*Cart, error) {
	const q = `SELECT * FROM carts WHERE user_id = $1`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetByUserID: %w", err)
	}

	cart, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Cart])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("cartRepository.GetByUserID scan: %w", err)
	}
	return &cart, nil
}

func (r *cartRepository) Clear(ctx context.Context, tx pgx.Tx, cartID int64) error {
	const q = `DELETE FROM cart_items WHERE cart_id = $1`

	if _, err := tx.Exec(ctx, q, cartID); err != nil {
		return fmt.Errorf("cartRepository.Clear: %w", err)
	}
	return nil
}

func (r *cartRepository) Delete(ctx context.Context, cartID int64) error {
	const q = `DELETE FROM carts WHERE id = $1`

	res, err := r.db.Exec(ctx, q, cartID)
	if err != nil {
		return fmt.Errorf("cartRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *cartRepository) AddItem(ctx context.Context, cartID int64, req AddCartItemReq) (*CartItem, error) {
	const q = `
		INSERT INTO cart_items (cart_id, product_variant_id, quantity, unit_price_snapshot)
		SELECT @cart_id, @variant_id, @quantity, @unit_price_snapshot
		FROM inventory i
		WHERE i.product_variant_id = @variant_id
		  AND i.stock_on_hand - i.committed_stock >= @quantity
		ON CONFLICT (cart_id, product_variant_id) DO UPDATE
			SET quantity   = cart_items.quantity + EXCLUDED.quantity,
			    updated_at = NOW()
			WHERE cart_items.quantity + EXCLUDED.quantity <= (
				SELECT i.stock_on_hand - i.committed_stock
				FROM inventory i
				WHERE i.product_variant_id = EXCLUDED.product_variant_id
			)
		RETURNING *`

	args := pgx.NamedArgs{
		"cart_id":             cartID,
		"variant_id":          req.ProductVariantID,
		"quantity":            req.Quantity,
		"unit_price_snapshot": req.UnitPriceSnapshot,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.AddItem: %w", err)
	}

	item, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[CartItem])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrInsufficientStock
		}
		return nil, fmt.Errorf("cartRepository.AddItem scan: %w", err)
	}
	return &item, nil
}

func (r *cartRepository) UpdateItem(ctx context.Context, cartID int64, itemID int64, req UpdateCartItemReq) (*CartItem, error) {
	const q = `
		UPDATE cart_items ci
		SET quantity   = @quantity,
		    updated_at = NOW()
		FROM inventory i
		WHERE ci.id      = @id
		  AND ci.cart_id = @cart_id
		  AND i.product_variant_id = ci.product_variant_id
		  AND i.stock_on_hand - i.committed_stock >= @quantity
		RETURNING ci.*`

	args := pgx.NamedArgs{
		"id":       itemID,
		"cart_id":  cartID,
		"quantity": req.Quantity,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.UpdateItem: %w", err)
	}

	item, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[CartItem])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			var exists bool
			if lookupErr := r.db.QueryRow(
				ctx,
				`SELECT EXISTS (SELECT 1 FROM cart_items WHERE id = $1 AND cart_id = $2)`,
				itemID,
				cartID,
			).Scan(&exists); lookupErr != nil {
				return nil, fmt.Errorf("cartRepository.UpdateItem existence check: %w", lookupErr)
			}
			if !exists {
				return nil, models.ErrNotFound
			}
			return nil, models.ErrInsufficientStock
		}
		return nil, fmt.Errorf("cartRepository.UpdateItem scan: %w", err)
	}
	return &item, nil
}

func (r *cartRepository) RemoveItem(ctx context.Context, cartID int64, itemID int64) error {
	const q = `DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`

	res, err := r.db.Exec(ctx, q, itemID, cartID)
	if err != nil {
		return fmt.Errorf("cartRepository.RemoveItem: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *cartRepository) GetItems(ctx context.Context, cartID int64) ([]CartItemResponse, error) {
	const q = `
		SELECT
			ci.id,
			p.id                        AS product_id,
			p.title                     AS product_title,
			p.category_id               AS category_id,
			p.weight                    AS weight_kg,
			pv.id                       AS variant_id,
			pv.sku,
			ci.unit_price_snapshot,
			pv.price                    AS current_price,
			ci.unit_price_snapshot != pv.price AS price_changed,
			ci.quantity,
			(ci.unit_price_snapshot * ci.quantity) AS line_total,
			(
				SELECT pi.image_url
				FROM   product_images pi
				WHERE  pi.product_id = p.id
				  AND  pi.is_primary = true
				LIMIT  1
			) AS image_url,
			-- Same availability the reserve path enforces at checkout. A missing
			-- inventory row is sold out, negative drift is clamped at the boundary.
			GREATEST(
				COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0),
				0
			) AS available_stock
		FROM cart_items ci
		INNER JOIN product_variants pv ON pv.id = ci.product_variant_id
		INNER JOIN products         p  ON p.id  = pv.product_id
		LEFT  JOIN inventory        i  ON i.product_variant_id = pv.id
		WHERE ci.cart_id = $1
		  AND pv.is_active = true
		  AND p.is_active  = true
		ORDER BY ci.created_at ASC`

	rows, err := r.db.Query(ctx, q, cartID)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetItems: %w", err)
	}
	defer rows.Close()

	var items []CartItemResponse
	for rows.Next() {
		var item CartItemResponse
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductTitle,
			&item.CategoryID,
			&item.WeightKg,
			&item.VariantID,
			&item.SKU,
			&item.UnitPriceSnapshot,
			&item.CurrentPrice,
			&item.PriceChanged,
			&item.Quantity,
			&item.LineTotal,
			&item.ImageURL,
			&item.AvailableStock,
		); err != nil {
			return nil, fmt.Errorf("cartRepository.GetItems scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("cartRepository.GetItems rows: %w", err)
	}

	if err := r.hydrateItemOptions(ctx, items); err != nil {
		return nil, err
	}

	return items, nil
}

// variantOptionsQuery loads option values for many cart variants in one
// round-trip (product_variants_options → option_values → option_types).
const variantOptionsQuery = `
		SELECT
			pvo.product_variant_id,
			ov.id,
			ov.option_type_id,
			ot.title,
			ot.display_name,
			ov.value
		FROM product_variants_options pvo
		INNER JOIN option_values ov ON ov.id = pvo.variant_option_id
		INNER JOIN option_types ot ON ot.id = ov.option_type_id
		WHERE pvo.product_variant_id = ANY($1)
		ORDER BY pvo.product_variant_id, ot.display_name, ov.sort_order, ov.value, ov.id`

func (r *cartRepository) hydrateItemOptions(ctx context.Context, items []CartItemResponse) error {
	ids := collectVariantIDs(items)
	if len(ids) == 0 {
		return nil
	}
	opts, err := r.loadVariantOptions(ctx, ids)
	if err != nil {
		return err
	}
	assignVariantOptions(items, opts)
	return nil
}

func (r *cartRepository) loadVariantOptions(ctx context.Context, variantIDs []int64) (map[int64][]models.OptionValueResponse, error) {
	if len(variantIDs) == 0 {
		return nil, nil
	}

	rows, err := r.db.Query(ctx, variantOptionsQuery, variantIDs)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.loadVariantOptions: %w", err)
	}
	defer rows.Close()

	result := make(map[int64][]models.OptionValueResponse)
	for rows.Next() {
		var variantID int64
		var option models.OptionValueResponse
		if err := rows.Scan(
			&variantID,
			&option.ID,
			&option.OptionTypeID,
			&option.OptionTypeTitle,
			&option.OptionType,
			&option.Value,
		); err != nil {
			return nil, fmt.Errorf("cartRepository.loadVariantOptions scan: %w", err)
		}
		result[variantID] = append(result[variantID], option)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("cartRepository.loadVariantOptions rows: %w", err)
	}
	return result, nil
}

func collectVariantIDs(items []CartItemResponse) []int64 {
	if len(items) == 0 {
		return nil
	}
	seen := make(map[int64]struct{}, len(items))
	ids := make([]int64, 0, len(items))
	for _, item := range items {
		if item.VariantID == 0 {
			continue
		}
		if _, ok := seen[item.VariantID]; ok {
			continue
		}
		seen[item.VariantID] = struct{}{}
		ids = append(ids, item.VariantID)
	}
	return ids
}

func assignVariantOptions(items []CartItemResponse, optionsByVariant map[int64][]models.OptionValueResponse) {
	if len(items) == 0 || len(optionsByVariant) == 0 {
		return
	}
	for i := range items {
		opts, ok := optionsByVariant[items[i].VariantID]
		if !ok {
			continue
		}
		items[i].Options = opts
	}
}
