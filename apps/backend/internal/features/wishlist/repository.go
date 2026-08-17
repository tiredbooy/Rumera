package wishlist

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	GetOrCreate(ctx context.Context, userID int64) (*Wishlist, error)
	AddItem(ctx context.Context, wishlistID int64, req AddItemReq) error
	RemoveItem(ctx context.Context, wishlistID int64, itemID int64) error
	GetItems(ctx context.Context, wishlistID int64) ([]ItemResponse, error)
	HasItem(ctx context.Context, wishlistID int64, variantID int64) (bool, error)
	Clear(ctx context.Context, wishlistID int64) error
}

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) GetOrCreate(ctx context.Context, userID int64) (*Wishlist, error) {
	const q = `
		INSERT INTO wishlists (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING *`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetOrCreate: %w", err)
	}

	wishlist, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Wishlist])
	if err != nil {
		return nil, fmt.Errorf("repository.GetOrCreate scan: %w", err)
	}
	return &wishlist, nil
}

func (r *repository) AddItem(ctx context.Context, wishlistID int64, req AddItemReq) error {
	const q = `
        INSERT INTO wishlist_items (wishlist_id, product_variant_id)
        VALUES (@wishlist_id, @variant_id)
        ON CONFLICT (wishlist_id, product_variant_id) DO NOTHING`

	args := pgx.NamedArgs{
		"wishlist_id": wishlistID,
		"variant_id":  req.ProductVariantID,
	}

	_, err := r.db.Exec(ctx, q, args)
	if err != nil {
		return fmt.Errorf("repository.AddItem: %w", err)
	}
	return nil
}

func (r *repository) RemoveItem(ctx context.Context, wishlistID int64, itemID int64) error {
	const q = `DELETE FROM wishlist_items WHERE id = $1 AND wishlist_id = $2`

	res, err := r.db.Exec(ctx, q, itemID, wishlistID)
	if err != nil {
		return fmt.Errorf("repository.RemoveItem: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *repository) GetItems(ctx context.Context, wishlistID int64) ([]ItemResponse, error) {
	const q = `
		SELECT
			wi.id,
			p.id                                    AS product_id,
			p.slug                                  AS product_slug,
			p.title                                 AS product_title,
			pv.id                                   AS variant_id,
			pv.sku,
			pv.price,
			pv.compare_at_price,
			(
				SELECT pi.image_url
				FROM   product_images pi
				WHERE  pi.product_id = p.id
				  AND  pi.is_primary = true
				LIMIT  1
			)                                       AS image_url,
			COALESCE((
				SELECT inv.stock_on_hand - inv.committed_stock > 0
				FROM   inventory inv
				WHERE  inv.product_variant_id = pv.id
				LIMIT  1
			), false)                                AS is_in_stock,
			wi.created_at                           AS added_at
		FROM wishlist_items wi
		INNER JOIN product_variants pv ON pv.id = wi.product_variant_id
		INNER JOIN products         p  ON p.id  = pv.product_id
		WHERE wi.wishlist_id = $1
		  AND p.is_active    = true
		  AND pv.is_active   = true
		ORDER BY wi.created_at DESC
		LIMIT 100`

	rows, err := r.db.Query(ctx, q, wishlistID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetItems: %w", err)
	}
	defer rows.Close()

	var items []ItemResponse
	for rows.Next() {
		var item ItemResponse
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductSlug,
			&item.ProductTitle,
			&item.VariantID,
			&item.SKU,
			&item.Price,
			&item.CompareAtPrice,
			&item.ImageURL,
			&item.IsInStock,
			&item.AddedAt,
		); err != nil {
			return nil, fmt.Errorf("repository.GetItems scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.GetItems rows: %w", err)
	}

	if err := r.hydrateItemOptions(ctx, items); err != nil {
		return nil, err
	}

	return items, nil
}

// variantOptionsQuery loads option values for many wishlist variants in one
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

func (r *repository) hydrateItemOptions(ctx context.Context, items []ItemResponse) error {
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

func (r *repository) loadVariantOptions(ctx context.Context, variantIDs []int64) (map[int64][]models.OptionValueResponse, error) {
	if len(variantIDs) == 0 {
		return nil, nil
	}

	rows, err := r.db.Query(ctx, variantOptionsQuery, variantIDs)
	if err != nil {
		return nil, fmt.Errorf("repository.loadVariantOptions: %w", err)
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
			return nil, fmt.Errorf("repository.loadVariantOptions scan: %w", err)
		}
		result[variantID] = append(result[variantID], option)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.loadVariantOptions rows: %w", err)
	}
	return result, nil
}

func collectVariantIDs(items []ItemResponse) []int64 {
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

func assignVariantOptions(items []ItemResponse, optionsByVariant map[int64][]models.OptionValueResponse) {
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

func (r *repository) HasItem(ctx context.Context, wishlistID int64, variantID int64) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1 FROM wishlist_items
			WHERE wishlist_id = $1
			  AND product_variant_id = $2
		)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, wishlistID, variantID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.HasItem: %w", err)
	}
	return exists, nil
}

func (r *repository) Clear(ctx context.Context, wishlistID int64) error {
	const q = `DELETE FROM wishlist_items WHERE wishlist_id = $1`

	if _, err := r.db.Exec(ctx, q, wishlistID); err != nil {
		return fmt.Errorf("repository.Clear: %w", err)
	}
	return nil
}
