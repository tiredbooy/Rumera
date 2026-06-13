// internal/repositories/variant_repository.go
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

type VariantRepository interface {
	Create(ctx context.Context, productID int64, req models.CreateVariantReq) (*models.ProductVariant, error)
	GetByID(ctx context.Context, id int64) (*models.ProductVariant, error)
	Update(ctx context.Context, id int64, req models.UpdateVariantReq) (*models.ProductVariant, error)
	Delete(ctx context.Context, id int64) error

	// Options linked to this variant
	AttachOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error
	GetOptions(ctx context.Context, variantID int64) ([]models.OptionValueResponse, error)
	GetImages(ctx context.Context, variantID int64) ([]*models.ProductImage, error)
}

type variantRepository struct {
	db *pgxpool.Pool
}

func NewVariantRepository(db *pgxpool.Pool) VariantRepository {
	return &variantRepository{db: db}
}

func (r *variantRepository) Create(ctx context.Context, productID int64, req models.CreateVariantReq) (*models.ProductVariant, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("variantRepository.Create begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

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
		return nil, fmt.Errorf("variantRepository.Create: %w", err)
	}

	variant, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ProductVariant])
	if err != nil {
		return nil, fmt.Errorf("variantRepository.Create scan: %w", err)
	}

	// Attach option values in same transaction
	if len(req.OptionValueIDs) > 0 {
		optRows := make([]string, len(req.OptionValueIDs))
		optArgs := pgx.NamedArgs{"variant_id": variant.ID}
		for i, oid := range req.OptionValueIDs {
			key := fmt.Sprintf("opt_%d", i)
			optRows[i] = fmt.Sprintf("(@variant_id, @%s)", key)
			optArgs[key] = oid
		}
		optQ := fmt.Sprintf(`
			INSERT INTO product_variants_options (product_variant_id, variant_option_id)
			VALUES %s`, strings.Join(optRows, ", "),
		)
		if _, err := tx.Exec(ctx, optQ, optArgs); err != nil {
			return nil, fmt.Errorf("variantRepository.Create attach options: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("variantRepository.Create commit: %w", err)
	}
	return &variant, nil
}

func (r *variantRepository) GetByID(ctx context.Context, id int64) (*models.ProductVariant, error) {
	const q = `SELECT * FROM product_variants WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("variantRepository.GetByID: %w", err)
	}

	variant, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ProductVariant])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("variantRepository.GetByID scan: %w", err)
	}
	return &variant, nil
}

func (r *variantRepository) Update(ctx context.Context, id int64, req models.UpdateVariantReq) (*models.ProductVariant, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.SKU != nil {
		sets = append(sets, "sku = @sku")
		args["sku"] = *req.SKU
	}
	if req.Price != nil {
		sets = append(sets, "price = @price")
		args["price"] = *req.Price
	}
	if req.CompareAtPrice != nil {
		sets = append(sets, "compare_at_price = @compare_at_price")
		args["compare_at_price"] = *req.CompareAtPrice
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

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("variantRepository.Update: %w", err)
	}

	variant, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ProductVariant])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("variantRepository.Update scan: %w", err)
	}
	return &variant, nil
}

func (r *variantRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM product_variants WHERE id = $1`
	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("variantRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *variantRepository) AttachOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error {
	if len(optionValueIDs) == 0 {
		return nil
	}

	rows := make([]string, len(optionValueIDs))
	args := pgx.NamedArgs{"variant_id": variantID}
	for i, id := range optionValueIDs {
		key := fmt.Sprintf("opt_%d", i)
		rows[i] = fmt.Sprintf("(@variant_id, @%s)", key)
		args[key] = id
	}

	q := fmt.Sprintf(`
		INSERT INTO product_variants_options (product_variant_id, variant_option_id)
		VALUES %s
		ON CONFLICT DO NOTHING`,
		strings.Join(rows, ", "),
	)

	if _, err := r.db.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("variantRepository.AttachOptions: %w", err)
	}
	return nil
}

func (r *variantRepository) GetOptions(ctx context.Context, variantID int64) ([]models.OptionValueResponse, error) {
	const q = `
		SELECT
			ov.id,
			ot.display_name AS option_type,
			ov.value
		FROM product_variants_options pvo
		INNER JOIN option_values ov  ON ov.id  = pvo.variant_option_id
		INNER JOIN option_types  ot  ON ot.id  = ov.variant_id
		WHERE pvo.product_variant_id = $1
		ORDER BY ot.display_name, ov.sort_order`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("variantRepository.GetOptions: %w", err)
	}
	defer rows.Close()

	var options []models.OptionValueResponse
	for rows.Next() {
		var o models.OptionValueResponse
		if err := rows.Scan(&o.ID, &o.OptionType, &o.Value); err != nil {
			return nil, fmt.Errorf("variantRepository.GetOptions scan: %w", err)
		}
		options = append(options, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("variantRepository.GetOptions rows: %w", err)
	}
	return options, nil
}

func (r *variantRepository) GetImages(ctx context.Context, variantID int64) ([]*models.ProductImage, error) {
	const q = `
		SELECT * FROM product_images
		WHERE product_variant_id = $1
		ORDER BY sort_order ASC, is_primary DESC`

	rows, err := r.db.Query(ctx, q, variantID)
	if err != nil {
		return nil, fmt.Errorf("variantRepository.GetImages: %w", err)
	}
	defer rows.Close()

	images, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ProductImage])
	if err != nil {
		return nil, fmt.Errorf("variantRepository.GetImages scan: %w", err)
	}

	result := make([]*models.ProductImage, len(images))
	for i := range images {
		result[i] = &images[i]
	}
	return result, nil
}
