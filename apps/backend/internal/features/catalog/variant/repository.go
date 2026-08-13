package variant

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type Repository interface {
	Create(ctx context.Context, productID int64, req CreateVariantReq) (*ProductVariant, error)
	GetByID(ctx context.Context, id int64) (*ProductVariant, error)
	Update(ctx context.Context, id int64, req UpdateVariantReq) (*ProductVariant, error)
	Delete(ctx context.Context, id int64) error

	// Options linked to this variant
	AttachOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error
	ReplaceOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error
	GetOptions(ctx context.Context, variantID int64) ([]models.OptionValueResponse, error)
	GetImages(ctx context.Context, variantID int64) ([]*models.ProductImage, error)
}

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, productID int64, req CreateVariantReq) (*ProductVariant, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.Create begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := LockProductVariantSetTx(ctx, tx, productID); err != nil {
		return nil, fmt.Errorf("repository.Create product lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return nil, err
	}

	const q = `
		INSERT INTO product_variants (product_id, sku, price, compare_at_price)
		VALUES (@product_id, @sku, @price, @compare_at_price)
		RETURNING *`

	args := pgx.NamedArgs{
		"product_id":       productID,
		"sku":              req.SKU,
		"price":            req.Price,
		"compare_at_price": req.CompareAtPrice,
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		if isOptionForeignKeyViolation(err) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.Create: %w", err)
	}

	variant, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[ProductVariant])
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		if isOptionForeignKeyViolation(err) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.Create scan: %w", err)
	}

	if err := InsertVariantOptionsTx(ctx, tx, variant.ID, req.OptionValueIDs, false); err != nil {
		return nil, fmt.Errorf("repository.Create attach options: %w", err)
	}
	if err := EnsureUniqueVariantCombinationTx(ctx, tx, productID, variant.ID); err != nil {
		return nil, fmt.Errorf("repository.Create combination: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.Create commit: %w", err)
	}
	return &variant, nil
}

func (r *repository) GetByID(ctx context.Context, id int64) (*ProductVariant, error) {
	const q = `SELECT * FROM product_variants WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}

	variant, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[ProductVariant])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return &variant, nil
}

func (r *repository) Update(ctx context.Context, id int64, req UpdateVariantReq) (*ProductVariant, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.SKU.Set {
		sets = append(sets, "sku = @sku")
		args["sku"] = req.SKU.Value
	}
	if req.Price != nil {
		sets = append(sets, "price = @price")
		args["price"] = *req.Price
	}
	if req.CompareAtPrice.Set {
		sets = append(sets, "compare_at_price = @compare_at_price")
		args["compare_at_price"] = req.CompareAtPrice.Value
	}
	if req.IsActive != nil {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = *req.IsActive
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE product_variants SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.Update begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	productID, err := variantProductIDTx(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	if err := LockProductVariantSetTx(ctx, tx, productID); err != nil {
		return nil, fmt.Errorf("repository.Update product lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.Update: %w", err)
	}

	variant, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[ProductVariant])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.Update scan: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.Update commit: %w", err)
	}
	return &variant, nil
}

func (r *repository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.Delete begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	productID, err := variantProductIDTx(ctx, tx, id)
	if err != nil {
		return err
	}
	if err := LockProductVariantSetTx(ctx, tx, productID); err != nil {
		return fmt.Errorf("repository.Delete product lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	const q = `DELETE FROM product_variants WHERE id = $1`
	res, err := tx.Exec(ctx, q, id)
	if err != nil {
		if isOptionForeignKeyViolation(err) {
			return models.ErrConflict
		}
		return fmt.Errorf("repository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.Delete commit: %w", err)
	}
	return nil
}

func (r *repository) AttachOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.AttachOptions begin: %w", err)
	}
	defer tx.Rollback(ctx)
	productID, err := variantProductIDTx(ctx, tx, variantID)
	if err != nil {
		return err
	}
	if err := LockProductVariantSetTx(ctx, tx, productID); err != nil {
		return fmt.Errorf("repository.AttachOptions product lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	if _, err := lockVariantTx(ctx, tx, variantID); err != nil {
		return err
	}
	if err := InsertVariantOptionsTx(ctx, tx, variantID, optionValueIDs, true); err != nil {
		return fmt.Errorf("repository.AttachOptions: %w", err)
	}
	if err := EnsureUniqueVariantCombinationTx(ctx, tx, productID, variantID); err != nil {
		return fmt.Errorf("repository.AttachOptions combination: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.AttachOptions commit: %w", err)
	}
	return nil
}

func (r *repository) ReplaceOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.ReplaceOptions begin: %w", err)
	}
	defer tx.Rollback(ctx)
	productID, err := variantProductIDTx(ctx, tx, variantID)
	if err != nil {
		return err
	}
	if err := LockProductVariantSetTx(ctx, tx, productID); err != nil {
		return fmt.Errorf("repository.ReplaceOptions product lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	if _, err := lockVariantTx(ctx, tx, variantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM product_variants_options WHERE product_variant_id = $1`, variantID,
	); err != nil {
		return fmt.Errorf("repository.ReplaceOptions delete: %w", err)
	}
	if err := InsertVariantOptionsTx(ctx, tx, variantID, optionValueIDs, false); err != nil {
		return fmt.Errorf("repository.ReplaceOptions insert: %w", err)
	}
	if err := EnsureUniqueVariantCombinationTx(ctx, tx, productID, variantID); err != nil {
		return fmt.Errorf("repository.ReplaceOptions combination: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.ReplaceOptions commit: %w", err)
	}
	return nil
}

func (r *repository) GetOptions(ctx context.Context, variantID int64) ([]models.OptionValueResponse, error) {
	const q = `
		SELECT
			ov.id,
			ov.option_type_id,
			ot.title,
			ot.display_name AS option_type,
			ov.value
		FROM product_variants_options pvo
		INNER JOIN option_values ov  ON ov.id  = pvo.variant_option_id
		INNER JOIN option_types  ot  ON ot.id  = ov.option_type_id
		WHERE pvo.product_variant_id = $1
		ORDER BY ot.display_name, ov.sort_order, ov.value, ov.id`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetOptions: %w", err)
	}
	defer rows.Close()

	options := make([]models.OptionValueResponse, 0)
	for rows.Next() {
		var o models.OptionValueResponse
		if err := rows.Scan(
			&o.ID,
			&o.OptionTypeID,
			&o.OptionTypeTitle,
			&o.OptionType,
			&o.Value,
		); err != nil {
			return nil, fmt.Errorf("repository.GetOptions scan: %w", err)
		}
		options = append(options, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.GetOptions rows: %w", err)
	}
	return options, nil
}

func lockVariantTx(ctx context.Context, tx pgx.Tx, variantID int64) (int64, error) {
	var productID int64
	if err := tx.QueryRow(ctx,
		`SELECT product_id FROM product_variants WHERE id = $1 FOR UPDATE`, variantID,
	).Scan(&productID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("lock variant: %w", err)
	}
	return productID, nil
}

func variantProductIDTx(ctx context.Context, tx pgx.Tx, variantID int64) (int64, error) {
	var productID int64
	if err := tx.QueryRow(ctx,
		`SELECT product_id FROM product_variants WHERE id = $1`, variantID,
	).Scan(&productID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("read variant product: %w", err)
	}
	return productID, nil
}

// All option-combination writes for one product share an advisory transaction
// lock. This closes the race where concurrent variants both pass duplicate
// checks before either combination commits.
func LockProductVariantSetTx(ctx context.Context, tx pgx.Tx, productID int64) error {
	if productID <= 0 {
		return models.ErrInvalidState
	}
	_, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended('product-variant-set:' || ($1::bigint)::text, 0))`,
		productID,
	)
	return err
}

// ensureUniqueVariantCombinationTx rejects identical non-empty option sets for
// variants of the same product. Empty sets remain valid because SKU-only variants
// and the edit workflow's temporary clear step have no attribute combination to
// compare.
func EnsureUniqueVariantCombinationTx(
	ctx context.Context,
	tx pgx.Tx,
	productID int64,
	variantID int64,
) error {
	const q = `
		WITH target AS (
			SELECT ARRAY(
				SELECT pvo.variant_option_id
				FROM product_variants_options pvo
				WHERE pvo.product_variant_id = $2
				ORDER BY pvo.variant_option_id
			) AS value_ids
		)
		SELECT cardinality(target.value_ids) > 0 AND EXISTS (
			SELECT 1
			FROM product_variants candidate
			WHERE candidate.product_id = $1
			  AND candidate.id <> $2
			  AND ARRAY(
				  SELECT pvo.variant_option_id
				  FROM product_variants_options pvo
				  WHERE pvo.product_variant_id = candidate.id
				  ORDER BY pvo.variant_option_id
			  ) = target.value_ids
		)
		FROM target`

	var duplicate bool
	if err := tx.QueryRow(ctx, q, productID, variantID).Scan(&duplicate); err != nil {
		return fmt.Errorf("validate variant combination: %w", err)
	}
	if duplicate {
		return models.ErrConflict
	}
	return nil
}

func InsertVariantOptionsTx(
	ctx context.Context,
	tx pgx.Tx,
	variantID int64,
	optionValueIDs []int64,
	ignoreExisting bool,
) error {
	ids, err := uniquePositiveIDs(optionValueIDs)
	if err != nil || len(ids) == 0 {
		return err
	}
	var found int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM option_values WHERE id = ANY($1)`, ids,
	).Scan(&found); err != nil {
		return fmt.Errorf("validate option values: %w", err)
	}
	if found != len(ids) {
		return models.ErrNotFound
	}

	q := `
		INSERT INTO product_variants_options (
			product_variant_id, variant_option_id, option_type_id
		)
		SELECT $1, ov.id, ov.option_type_id
		FROM option_values ov
		WHERE ov.id = ANY($2)`
	if ignoreExisting {
		q += ` ON CONFLICT (product_variant_id, variant_option_id) DO NOTHING`
	}
	if _, err := tx.Exec(ctx, q, variantID, ids); err != nil {
		if isUniqueViolation(err) {
			return models.ErrConflict
		}
		if isOptionForeignKeyViolation(err) {
			return models.ErrNotFound
		}
		return err
	}
	return nil
}

func uniquePositiveIDs(values []int64) ([]int64, error) {
	seen := make(map[int64]struct{}, len(values))
	result := make([]int64, 0, len(values))
	for _, value := range values {
		if value <= 0 {
			return nil, models.ErrInvalidState
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result, nil
}

func (r *repository) GetImages(ctx context.Context, variantID int64) ([]*models.ProductImage, error) {
	const q = `
		SELECT * FROM product_images
		WHERE product_variant_id = $1
		ORDER BY sort_order ASC, is_primary DESC`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetImages: %w", err)
	}
	defer rows.Close()

	images, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ProductImage])
	if err != nil {
		return nil, fmt.Errorf("repository.GetImages scan: %w", err)
	}

	result := make([]*models.ProductImage, len(images))
	for i := range images {
		result[i] = &images[i]
	}
	return result, nil
}

// touchProductGraphTx bumps products.updated_at so aggregate optimistic locks
// and cache invalidation observers notice variant graph changes.
func touchProductGraphTx(ctx context.Context, tx pgx.Tx, productID int64) error {
	tag, err := tx.Exec(ctx,
		`UPDATE products SET updated_at = updated_at WHERE id = $1`, productID,
	)
	if err != nil {
		return fmt.Errorf("touch product graph revision: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}
