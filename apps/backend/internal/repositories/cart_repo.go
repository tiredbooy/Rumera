// internal/repositories/cart_repository.go
package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type CartRepository interface {
	// Cart lifecycle
	GetOrCreate(ctx context.Context, userID int64) (*models.Cart, error)
	GetByUserID(ctx context.Context, userID int64) (*models.Cart, error)
	Clear(ctx context.Context, tx pgx.Tx, cartID int64) error
	Delete(ctx context.Context, cartID int64) error

	// Items
	AddItem(ctx context.Context, cartID int64, req models.AddCartItemReq) (*models.CartItem, error)
	UpdateItem(ctx context.Context, cartID int64, itemID int64, req models.UpdateCartItemReq) (*models.CartItem, error)
	RemoveItem(ctx context.Context, cartID int64, itemID int64) error
	GetItems(ctx context.Context, cartID int64) ([]models.CartItemResponse, error)
}

type cartRepository struct {
	db *pgxpool.Pool
}

func NewCartRepository(db *pgxpool.Pool) CartRepository {
	return &cartRepository{db: db}
}

func (r *cartRepository) GetOrCreate(ctx context.Context, userID int64) (*models.Cart, error) {
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

	cart, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Cart])
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetOrCreate scan: %w", err)
	}
	return &cart, nil
}

func (r *cartRepository) GetByUserID(ctx context.Context, userID int64) (*models.Cart, error) {
	const q = `SELECT * FROM carts WHERE user_id = $1`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetByUserID: %w", err)
	}

	cart, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Cart])
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

func (r *cartRepository) AddItem(ctx context.Context, cartID int64, req models.AddCartItemReq) (*models.CartItem, error) {
	const q = `
		INSERT INTO cart_items (cart_id, product_variant_id, quantity, unit_price_snapshot)
		SELECT @cart_id, @variant_id, @quantity, @unit_price_snapshot
		FROM inventory i
		WHERE i.product_variant_id = @variant_id
		  AND i.stock_on_hand >= @quantity
		ON CONFLICT (cart_id, product_variant_id) DO UPDATE
			SET quantity   = cart_items.quantity + EXCLUDED.quantity,
			    updated_at = NOW()
			WHERE cart_items.quantity + EXCLUDED.quantity <= (
				SELECT i.stock_on_hand
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

	item, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.CartItem])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrInsufficientStock
		}
		return nil, fmt.Errorf("cartRepository.AddItem scan: %w", err)
	}
	return &item, nil
}

func (r *cartRepository) UpdateItem(ctx context.Context, cartID int64, itemID int64, req models.UpdateCartItemReq) (*models.CartItem, error) {
	const q = `
		UPDATE cart_items ci
		SET quantity   = @quantity,
		    updated_at = NOW()
		FROM inventory i
		WHERE ci.id      = @id
		  AND ci.cart_id = @cart_id
		  AND i.product_variant_id = ci.product_variant_id
		  AND i.stock_on_hand >= @quantity
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

	item, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.CartItem])
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

func (r *cartRepository) GetItems(ctx context.Context, cartID int64) ([]models.CartItemResponse, error) {
	const q = `
		SELECT
			ci.id,
			p.id                        AS product_id,
			p.title                     AS product_title,
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
			) AS image_url
		FROM cart_items ci
		INNER JOIN product_variants pv ON pv.id = ci.product_variant_id
		INNER JOIN products         p  ON p.id  = pv.product_id
		WHERE ci.cart_id = $1
		  AND pv.is_active = true
		  AND p.is_active  = true
		ORDER BY ci.created_at ASC`

	rows, err := r.db.Query(ctx, q, cartID)
	if err != nil {
		return nil, fmt.Errorf("cartRepository.GetItems: %w", err)
	}
	defer rows.Close()

	var items []models.CartItemResponse
	for rows.Next() {
		var item models.CartItemResponse
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductTitle,
			&item.VariantID,
			&item.SKU,
			&item.UnitPriceSnapshot,
			&item.CurrentPrice,
			&item.PriceChanged,
			&item.Quantity,
			&item.LineTotal,
			&item.ImageURL,
		); err != nil {
			return nil, fmt.Errorf("cartRepository.GetItems scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("cartRepository.GetItems rows: %w", err)
	}

	return items, nil
}
