package product

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// ProductImageRepository owns writes to product_images for the admin media
// pipeline. Reads for the public catalogue still go through ProductRepository's
// GetImages; this repo adds the create/reorder/primary/delete operations the
// admin UI needs.
type ImageRepository interface {
	Create(ctx context.Context, img *models.ProductImage) (*models.ProductImage, error)
	GetByID(ctx context.Context, id int64) (*models.ProductImage, error)
	// GetProductMainImage(ctx context.Context, productID int64) (*models.ProductImage, error)
	ListByProduct(ctx context.Context, productID int64) ([]*models.ProductImage, error)
	UpdateAlt(ctx context.Context, id int64, alt *string) (*models.ProductImage, error)
	SetPrimary(ctx context.Context, productID, id int64) error
	Reorder(ctx context.Context, productID int64, ids []int64) error
	Delete(ctx context.Context, productID, id int64) error
}

type imageRepository struct {
	db *pgxpool.Pool
}

func NewImageRepository(db *pgxpool.Pool) ImageRepository {
	return &imageRepository{db: db}
}

const productImageCols = `id, product_id, product_variant_id, image_url, storage_key,
	alt_text, sort_order, is_primary, width, height, created_at, updated_at`

func scanProductImage(row pgx.Row) (*models.ProductImage, error) {
	img := &models.ProductImage{}
	err := row.Scan(
		&img.ID, &img.ProductID, &img.ProductVariantID, &img.ImageURL, &img.StorageKey,
		&img.AltText, &img.SortOrder, &img.IsPrimary, &img.Width, &img.Height,
		&img.CreatedAt, &img.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return img, nil
}

func (r *imageRepository) Create(ctx context.Context, img *models.ProductImage) (*models.ProductImage, error) {
	if img.ProductID == nil || *img.ProductID <= 0 {
		return nil, models.ErrInvalidState
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("imageRepository.Create begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	productID := *img.ProductID
	if img.ProductVariantID != nil {
		var ownsVariant bool
		if err := tx.QueryRow(ctx,
			`SELECT EXISTS(
				SELECT 1 FROM product_variants WHERE id = $1 AND product_id = $2
			)`,
			*img.ProductVariantID, productID,
		).Scan(&ownsVariant); err != nil {
			return nil, fmt.Errorf("imageRepository.Create variant owner: %w", err)
		}
		if !ownsVariant {
			return nil, models.ErrInvalidState
		}
	}
	lockKey := fmt.Sprintf("product-images:%d", productID)
	if img.ProductVariantID != nil {
		lockKey = fmt.Sprintf("product-variant-images:%d", *img.ProductVariantID)
	}
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
		lockKey,
	); err != nil {
		return nil, fmt.Errorf("imageRepository.Create lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return nil, err
	}
	var nextOrder int
	if err := tx.QueryRow(ctx,
		`SELECT COALESCE(MAX(sort_order) + 1, 0)
		 FROM product_images
		 WHERE product_id = $1 AND product_variant_id IS NOT DISTINCT FROM $2`,
		productID, img.ProductVariantID,
	).Scan(&nextOrder); err != nil {
		return nil, fmt.Errorf("imageRepository.Create order: %w", err)
	}
	primary := img.IsPrimary || nextOrder == 0
	if primary {
		if _, err := tx.Exec(ctx,
			`UPDATE product_images SET is_primary = false, updated_at = NOW()
			 WHERE product_id = $1
			   AND product_variant_id IS NOT DISTINCT FROM $2
			   AND is_primary`,
			productID, img.ProductVariantID,
		); err != nil {
			return nil, fmt.Errorf("imageRepository.Create clear primary: %w", err)
		}
	}

	const q = `
		INSERT INTO product_images
			(product_id, product_variant_id, image_url, storage_key, alt_text, sort_order, is_primary, width, height)
		VALUES (@product_id, @product_variant_id, @image_url, @storage_key, @alt_text, @sort_order, @is_primary, @width, @height)
		RETURNING ` + productImageCols

	args := pgx.NamedArgs{
		"product_id":         img.ProductID,
		"product_variant_id": img.ProductVariantID,
		"image_url":          img.ImageURL,
		"storage_key":        img.StorageKey,
		"alt_text":           img.AltText,
		"sort_order":         nextOrder,
		"is_primary":         primary,
		"width":              img.Width,
		"height":             img.Height,
	}
	out, err := scanProductImage(tx.QueryRow(ctx, q, args))
	if err != nil {
		return nil, fmt.Errorf("imageRepository.Create: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("imageRepository.Create commit: %w", err)
	}
	return out, nil
}

func (r *imageRepository) GetByID(ctx context.Context, id int64) (*models.ProductImage, error) {
	const q = `SELECT ` + productImageCols + ` FROM product_images WHERE id = $1`
	img, err := scanProductImage(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("imageRepository.GetByID: %w", err)
	}
	return img, nil
}

// func (r *imageRepository) GetProductMainImage(ctx context.Context, productID int64) (*models.ProductImage, error) {
// 	const q = `
// 		SELECT id, image_url, storage_key, alt_text FROM product_images
// 		WHERE product_id = $1 AND is_primary = $2
// 	`
// 	var image *models.ProductImage
// 	err := r.db.QueryRow(ctx, q, productID, true).Scan(
// 		&image.ID,
// 		&image.ImageURL,
// 		&image.StorageKey,
// 		&image.AltText,
// 	)
// }

func (r *imageRepository) ListByProduct(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	const q = `SELECT ` + productImageCols + `
		FROM product_images
		WHERE product_id = $1 AND product_variant_id IS NULL
		ORDER BY sort_order ASC, is_primary DESC, id ASC`
	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("imageRepository.ListByProduct: %w", err)
	}
	defer rows.Close()

	var out []*models.ProductImage
	for rows.Next() {
		img, err := scanProductImage(rows)
		if err != nil {
			return nil, fmt.Errorf("imageRepository.ListByProduct scan: %w", err)
		}
		out = append(out, img)
	}
	return out, rows.Err()
}

func (r *imageRepository) UpdateAlt(ctx context.Context, id int64, alt *string) (*models.ProductImage, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("imageRepository.UpdateAlt begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var productID *int64
	var variantID *int64
	if err := tx.QueryRow(ctx,
		`SELECT product_id, product_variant_id FROM product_images WHERE id = $1`, id,
	).Scan(&productID, &variantID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("imageRepository.UpdateAlt owner: %w", err)
	}
	if productID == nil {
		return nil, models.ErrInvalidState
	}
	lockKey := fmt.Sprintf("product-images:%d", *productID)
	if variantID != nil {
		lockKey = fmt.Sprintf("product-variant-images:%d", *variantID)
	}
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, lockKey,
	); err != nil {
		return nil, fmt.Errorf("imageRepository.UpdateAlt lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, *productID); err != nil {
		return nil, err
	}
	const q = `UPDATE product_images SET alt_text = $2, updated_at = NOW()
		WHERE id = $1 RETURNING ` + productImageCols
	img, err := scanProductImage(tx.QueryRow(ctx, q, id, alt))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("imageRepository.UpdateAlt: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("imageRepository.UpdateAlt commit: %w", err)
	}
	return img, nil
}

// SetPrimary flips is_primary on exactly the target image and clears it on every
// other image of the same product, in a single atomic statement.
func (r *imageRepository) SetPrimary(ctx context.Context, productID, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("imageRepository.SetPrimary begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended('product-images:' || ($1::bigint)::text, 0))`,
		productID,
	); err != nil {
		return fmt.Errorf("imageRepository.SetPrimary lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	var exists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM product_images
			WHERE product_id = $1 AND product_variant_id IS NULL AND id = $2
		)`,
		productID, id,
	).Scan(&exists); err != nil {
		return fmt.Errorf("imageRepository.SetPrimary target: %w", err)
	}
	if !exists {
		return models.ErrNotFound
	}
	if _, err := tx.Exec(ctx,
		`UPDATE product_images SET is_primary = false, updated_at = NOW()
		 WHERE product_id = $1 AND product_variant_id IS NULL AND is_primary`,
		productID,
	); err != nil {
		return fmt.Errorf("imageRepository.SetPrimary clear: %w", err)
	}
	tag, err := tx.Exec(ctx,
		`UPDATE product_images SET is_primary = true, updated_at = NOW()
		 WHERE product_id = $1 AND product_variant_id IS NULL AND id = $2`,
		productID, id,
	)
	if err != nil {
		return fmt.Errorf("imageRepository.SetPrimary: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("imageRepository.SetPrimary commit: %w", err)
	}
	return nil
}

// Reorder rewrites sort_order to match the position of each id in ids, scoped to
// the product so a caller can't reorder another product's images.
func (r *imageRepository) Reorder(ctx context.Context, productID int64, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("imageRepository.Reorder begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended('product-images:' || ($1::bigint)::text, 0))`,
		productID,
	); err != nil {
		return fmt.Errorf("imageRepository.Reorder lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	var matches bool
	if err := tx.QueryRow(ctx, `
		SELECT count(*) = $3
		   AND count(DISTINCT id) = $3
		   AND count(*) = (
			   SELECT count(*) FROM product_images
			   WHERE product_id = $1 AND product_variant_id IS NULL
		   )
		FROM product_images
		WHERE product_id = $1
		  AND product_variant_id IS NULL
		  AND id = ANY($2::bigint[])`,
		productID, ids, len(ids),
	).Scan(&matches); err != nil {
		return fmt.Errorf("imageRepository.Reorder validate: %w", err)
	}
	if !matches {
		return models.ErrInvalidState
	}
	orders := make([]int32, len(ids))
	for i := range ids {
		orders[i] = int32(i)
	}
	const q = `
		UPDATE product_images AS pi
		SET sort_order = v.ord, updated_at = NOW()
		FROM (SELECT * FROM unnest($2::bigint[], $3::int[]) AS t(id, ord)) AS v
		WHERE pi.id = v.id
		  AND pi.product_id = $1
		  AND pi.product_variant_id IS NULL`
	if _, err := tx.Exec(ctx, q, productID, ids, orders); err != nil {
		return fmt.Errorf("imageRepository.Reorder: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("imageRepository.Reorder commit: %w", err)
	}
	return nil
}

func (r *imageRepository) Delete(ctx context.Context, productID, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("imageRepository.Delete begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended('product-images:' || ($1::bigint)::text, 0))`,
		productID,
	); err != nil {
		return fmt.Errorf("imageRepository.Delete lock: %w", err)
	}
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}

	var wasPrimary bool
	if err := tx.QueryRow(ctx,
		`DELETE FROM product_images
		 WHERE product_id = $1 AND product_variant_id IS NULL AND id = $2
		 RETURNING is_primary`,
		productID, id,
	).Scan(&wasPrimary); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.ErrNotFound
		}
		return fmt.Errorf("imageRepository.Delete: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		WITH ranked AS (
			SELECT id, row_number() OVER (ORDER BY sort_order ASC, id ASC) - 1 AS position
			FROM product_images
			WHERE product_id = $1 AND product_variant_id IS NULL
		)
		UPDATE product_images AS image
		SET sort_order = ranked.position, updated_at = NOW()
		FROM ranked
		WHERE image.id = ranked.id AND image.sort_order IS DISTINCT FROM ranked.position`,
		productID,
	); err != nil {
		return fmt.Errorf("imageRepository.Delete compact order: %w", err)
	}
	if wasPrimary {
		if _, err := tx.Exec(ctx, `
			UPDATE product_images
			SET is_primary = true, updated_at = NOW()
			WHERE id = (
				SELECT id FROM product_images
				WHERE product_id = $1 AND product_variant_id IS NULL
				ORDER BY sort_order ASC, id ASC
				LIMIT 1
			)`, productID); err != nil {
			return fmt.Errorf("imageRepository.Delete promote primary: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("imageRepository.Delete commit: %w", err)
	}
	return nil
}
