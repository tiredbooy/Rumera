package repositories

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
type ProductImageRepository interface {
	Create(ctx context.Context, img *models.ProductImage) (*models.ProductImage, error)
	GetByID(ctx context.Context, id int64) (*models.ProductImage, error)
	// GetProductMainImage(ctx context.Context, productID int64) (*models.ProductImage, error)
	ListByProduct(ctx context.Context, productID int64) ([]*models.ProductImage, error)
	NextSortOrder(ctx context.Context, productID int64) (int, error)
	UpdateAlt(ctx context.Context, id int64, alt *string) (*models.ProductImage, error)
	SetPrimary(ctx context.Context, productID, id int64) error
	Reorder(ctx context.Context, productID int64, ids []int64) error
	Delete(ctx context.Context, id int64) error
}

type productImageRepository struct {
	db *pgxpool.Pool
}

func NewProductImageRepository(db *pgxpool.Pool) ProductImageRepository {
	return &productImageRepository{db: db}
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

func (r *productImageRepository) Create(ctx context.Context, img *models.ProductImage) (*models.ProductImage, error) {
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
		"sort_order":         img.SortOrder,
		"is_primary":         img.IsPrimary,
		"width":              img.Width,
		"height":             img.Height,
	}
	out, err := scanProductImage(r.db.QueryRow(ctx, q, args))
	if err != nil {
		return nil, fmt.Errorf("productImageRepository.Create: %w", err)
	}
	return out, nil
}

func (r *productImageRepository) GetByID(ctx context.Context, id int64) (*models.ProductImage, error) {
	const q = `SELECT ` + productImageCols + ` FROM product_images WHERE id = $1`
	img, err := scanProductImage(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("productImageRepository.GetByID: %w", err)
	}
	return img, nil
}

// func (r *productImageRepository) GetProductMainImage(ctx context.Context, productID int64) (*models.ProductImage, error) {
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

func (r *productImageRepository) ListByProduct(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	const q = `SELECT ` + productImageCols + `
		FROM product_images WHERE product_id = $1
		ORDER BY sort_order ASC, is_primary DESC, id ASC`
	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("productImageRepository.ListByProduct: %w", err)
	}
	defer rows.Close()

	var out []*models.ProductImage
	for rows.Next() {
		img, err := scanProductImage(rows)
		if err != nil {
			return nil, fmt.Errorf("productImageRepository.ListByProduct scan: %w", err)
		}
		out = append(out, img)
	}
	return out, rows.Err()
}

func (r *productImageRepository) NextSortOrder(ctx context.Context, productID int64) (int, error) {
	const q = `SELECT COALESCE(MAX(sort_order)+1, 0) FROM product_images WHERE product_id = $1`
	var next int
	if err := r.db.QueryRow(ctx, q, productID).Scan(&next); err != nil {
		return 0, fmt.Errorf("productImageRepository.NextSortOrder: %w", err)
	}
	return next, nil
}

func (r *productImageRepository) UpdateAlt(ctx context.Context, id int64, alt *string) (*models.ProductImage, error) {
	const q = `UPDATE product_images SET alt_text = $2, updated_at = NOW()
		WHERE id = $1 RETURNING ` + productImageCols
	img, err := scanProductImage(r.db.QueryRow(ctx, q, id, alt))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("productImageRepository.UpdateAlt: %w", err)
	}
	return img, nil
}

// SetPrimary flips is_primary on exactly the target image and clears it on every
// other image of the same product, in a single atomic statement.
func (r *productImageRepository) SetPrimary(ctx context.Context, productID, id int64) error {
	const q = `UPDATE product_images
		SET is_primary = (id = $2), updated_at = NOW()
		WHERE product_id = $1`
	tag, err := r.db.Exec(ctx, q, productID, id)
	if err != nil {
		return fmt.Errorf("productImageRepository.SetPrimary: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// Reorder rewrites sort_order to match the position of each id in ids, scoped to
// the product so a caller can't reorder another product's images.
func (r *productImageRepository) Reorder(ctx context.Context, productID int64, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	orders := make([]int32, len(ids))
	for i := range ids {
		orders[i] = int32(i)
	}
	const q = `
		UPDATE product_images AS pi
		SET sort_order = v.ord, updated_at = NOW()
		FROM (SELECT * FROM unnest($2::bigint[], $3::int[]) AS t(id, ord)) AS v
		WHERE pi.id = v.id AND pi.product_id = $1`
	if _, err := r.db.Exec(ctx, q, productID, ids, orders); err != nil {
		return fmt.Errorf("productImageRepository.Reorder: %w", err)
	}
	return nil
}

func (r *productImageRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM product_images WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("productImageRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}
