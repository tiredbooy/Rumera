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

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

type ProductRepository interface {
	Create(ctx context.Context, req models.CreateProductReq) (*models.Product, error)
	GetByID(ctx context.Context, id int64) (*models.Product, error)
	GetAll(ctx context.Context, filter models.ProductFilter) ([]*models.ProductListItem, int64, error)
	Update(ctx context.Context, id int64, req models.UpdateProductReq) (*models.Product, error)
	Delete(ctx context.Context, id int64) error

	// Tags junction
	AttachTags(ctx context.Context, productID int64, tagIDs []int64) error
	DetachTags(ctx context.Context, productID int64, tagIDs []int64) error
	SyncTags(ctx context.Context, productID int64, tagIDs []int64) error
	GetTags(ctx context.Context, productID int64) ([]*models.Tag, error)

	// Images
	GetImages(ctx context.Context, productID int64) ([]*models.ProductImage, error)
	GetMediaIdentity(ctx context.Context, productID int64) (slug string, err error)

	// Variants
	GetVariants(ctx context.Context, productID int64) ([]*models.ProductVariant, error)

	ExistsByID(ctx context.Context, id int64) (bool, error)
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
	ExistsByCode(ctx context.Context, code string) (bool, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type productRepository struct {
	db *pgxpool.Pool
}

func NewProductRepository(db *pgxpool.Pool) ProductRepository {
	return &productRepository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// Inserts the product row and any variants sent alongside it in a
// single transaction, so a product is never persisted without the
// variants the client asked for (and vice-versa).
// ─────────────────────────────────────────────────────────────

func (r *productRepository) Create(ctx context.Context, req models.CreateProductReq) (*models.Product, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("productRepository.Create begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const q = `
		INSERT INTO products (
			title, code, slug, category_id, description,
			brand_id, country_of_origin, abv, weight,
			meta_title, meta_description, meta_tags
		) VALUES (
			@title, @code, @slug, @category_id, @description,
			@brand_id, @country_of_origin, @abv, @weight,
			@meta_title, @meta_description, @meta_tags
		)
		RETURNING *`

	args := pgx.NamedArgs{
		"title":             req.Title,
		"code":              req.Code,
		"slug":              req.Slug,
		"category_id":       req.CategoryID,
		"description":       req.Description,
		"brand_id":          req.BrandID,
		"country_of_origin": req.CountryOfOrigin,
		"abv":               req.ABV,
		"weight":            req.Weight,
		"meta_title":        req.MetaTitle,
		"meta_description":  req.MetaDescription,
		"meta_tags":         req.MetaTags,
	}

	rows, err := tx.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("productRepository.Create: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Product])
	if err != nil {
		return nil, fmt.Errorf("productRepository.Create scan: %w", err)
	}

	// Persist variants sent on create in the same transaction. Each variant
	// row plus its option links is inserted; a failure rolls back the product.
	for i := range req.Variants {
		if err := insertVariantTx(ctx, tx, product.ID, req.Variants[i]); err != nil {
			return nil, fmt.Errorf("productRepository.Create variant %d: %w", i, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("productRepository.Create commit: %w", err)
	}
	return &product, nil
}

// insertVariantTx inserts a single variant (and its option-value links) for the
// given product using the supplied transaction. It mirrors variantRepository.Create
// but joins the caller's transaction so product+variants commit atomically.
func insertVariantTx(ctx context.Context, tx pgx.Tx, productID int64, req models.CreateVariantReq) error {
	const q = `
		INSERT INTO product_variants (product_id, sku, price, compare_at_price)
		VALUES (@product_id, @sku, @price, @compare_at_price)
		RETURNING id`

	args := pgx.NamedArgs{
		"product_id":       productID,
		"sku":              req.SKU,
		"price":            req.Price,
		"compare_at_price": req.CompareAtPrice,
	}

	var variantID int64
	if err := tx.QueryRow(ctx, q, args).Scan(&variantID); err != nil {
		return fmt.Errorf("insert variant: %w", err)
	}

	if len(req.OptionValueIDs) > 0 {
		optRows := make([]string, len(req.OptionValueIDs))
		optArgs := pgx.NamedArgs{"variant_id": variantID}
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
			return fmt.Errorf("attach options: %w", err)
		}
	}

	return nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *productRepository) GetByID(ctx context.Context, id int64) (*models.Product, error) {
	const q = `SELECT * FROM products WHERE id = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetByID: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Product])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("productRepository.GetByID scan: %w", err)
	}
	return &product, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (paginated + filtered)
// Price filters are applied via correlated EXISTS subqueries against
// product_variants, keeping the products query free of aggregates and joins.
// (A prior version put MIN/MAX(pv.price) in the WHERE clause against an
// unjoined `pv` alias — invalid SQL that 500'd every price-faceted request.)
// ─────────────────────────────────────────────────────────────

func (r *productRepository) GetAll(ctx context.Context, f models.ProductFilter) ([]*models.ProductListItem, int64, error) {
	// No hardcoded is_active filter — callers decide (the public list forces
	// active, the admin list shows all) via f.IsActive. Seed with 1=1 so the
	// optional clauses AND on cleanly.
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "p.title ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}
	if f.CategoryID != nil {
		where = append(where, "p.category_id = @category_id")
		args["category_id"] = *f.CategoryID
	}
	if f.BrandID != nil {
		where = append(where, "p.brand_id = @brand_id")
		args["brand_id"] = *f.BrandID
	}
	if f.IsActive != nil {
		where = append(where, "p.is_active = @is_active")
		args["is_active"] = *f.IsActive
	}
	if f.TagID != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_tags pt
			WHERE pt.product_id = p.id AND pt.tag_id = @tag_id
		)`)
		args["tag_id"] = *f.TagID
	}
	if f.MinPrice != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_variants pv
			WHERE pv.product_id = p.id AND pv.price >= @min_price
		)`)
		args["min_price"] = *f.MinPrice
	}
	if f.MaxPrice != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_variants pv
			WHERE pv.product_id = p.id AND pv.price <= @max_price
		)`)
		args["max_price"] = *f.MaxPrice
	}

	allowed := map[string]bool{
		"created_at": true,
		"title":      true,
		"updated_at": true,
	}
	sortBy := "p.created_at"
	if allowed[f.SortBy] {
		sortBy = "p." + f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}
	whereSQL := strings.Join(where, " AND ")
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM products p WHERE %s`, whereSQL)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("productRepository.GetAll count: %w", err)
	}
	if total == 0 || int64(f.Offset()) >= total {
		return []*models.ProductListItem{}, total, nil
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	// Project the lightweight list row: joined brand title + cheapest/priciest
	// active variant price band (mirrors the recommendation card projection).
	q := fmt.Sprintf(`
    SELECT
        p.id, p.title, p.code, p.slug, p.is_active,
        b.title AS brand,
        c.title AS category,
		COALESCE(pr.min_price, 0) AS min_price,
		COALESCE(pr.max_price, 0) AS max_price,
		COALESCE(pr.active_variant_count, 0) AS active_variant_count,
		COALESCE(pr.available_variant_count, 0) AS available_variant_count,
		pr.purchasable_variant_id,
		img.id AS image_id, img.image_url, img.storage_key, img.alt_text, img.width, img.height
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
	LEFT JOIN LATERAL (
		SELECT
			MIN(price) AS min_price,
			MAX(price) AS max_price,
			COUNT(*) AS active_variant_count,
			COUNT(*) FILTER (WHERE COALESCE(i.stock_on_hand, 0) > 0) AS available_variant_count,
			CASE
				WHEN COUNT(*) = 1
					AND COALESCE(MAX(i.stock_on_hand), 0) > 0
				THEN MIN(pv.id)
			END AS purchasable_variant_id
		FROM product_variants pv
		LEFT JOIN inventory i ON i.product_variant_id = pv.id
		WHERE pv.product_id = p.id AND pv.is_active
	) pr ON TRUE
    LEFT JOIN LATERAL (
        SELECT id, image_url, storage_key, alt_text, width, height
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC
        LIMIT 1	
    ) img ON TRUE
	    WHERE %s
	    ORDER BY %s %s, p.id %s
	    LIMIT @limit OFFSET @offset`,
		whereSQL, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("productRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var items []*models.ProductListItem

	for rows.Next() {
		var it models.ProductListItem

		var (
			imgID         *int64
			imgURL        *string
			imgStorageKey *string
			imgAltText    *string
			imgWidth      *int
			imgHeight     *int
		)

		if err := rows.Scan(
			&it.ID, &it.Title, &it.Code, &it.Slug, &it.IsActive,
			&it.Brand, &it.Category, &it.MinPrice, &it.MaxPrice,
			&it.ActiveVariantCount, &it.AvailableVariantCount,
			&it.PurchasableVariantID,
			&imgID, &imgURL, &imgStorageKey, &imgAltText, &imgWidth, &imgHeight,
		); err != nil {
			return nil, 0, fmt.Errorf("productRepository.GetAll scan: %w", err)
		}

		if imgID != nil && imgURL != nil {
			it.Image = &models.ImageResponse{
				ID:         *imgID,
				ImageURL:   *imgURL,
				StorageKey: imgStorageKey,
				AltText:    imgAltText,
				Width:      imgWidth,
				Height:     imgHeight,
			}
		}

		items = append(items, &it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("productRepository.GetAll rows: %w", err)
	}

	return items, total, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH)
// ─────────────────────────────────────────────────────────────

func (r *productRepository) Update(ctx context.Context, id int64, req models.UpdateProductReq) (*models.Product, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.Code != nil {
		sets = append(sets, "code = @code")
		args["code"] = *req.Code
	}
	if req.Slug != nil {
		sets = append(sets, "slug = @slug")
		args["slug"] = *req.Slug
	}
	if req.CategoryID != nil {
		sets = append(sets, "category_id = @category_id")
		args["category_id"] = *req.CategoryID
	}
	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}
	if req.BrandID != nil {
		sets = append(sets, "brand_id = @brand_id")
		args["brand_id"] = *req.BrandID
	}
	if req.CountryOfOrigin != nil {
		sets = append(sets, "country_of_origin = @country_of_origin")
		args["country_of_origin"] = *req.CountryOfOrigin
	}
	if req.ABV != nil {
		sets = append(sets, "abv = @abv")
		args["abv"] = *req.ABV
	}
	if req.Weight != nil {
		sets = append(sets, "weight = @weight")
		args["weight"] = *req.Weight
	}
	if req.IsActive != nil {
		sets = append(sets, "is_active = @is_active")
		args["is_active"] = *req.IsActive
	}
	if req.MetaTitle != nil {
		sets = append(sets, "meta_title = @meta_title")
		args["meta_title"] = *req.MetaTitle
	}
	if req.MetaDescription != nil {
		sets = append(sets, "meta_description = @meta_description")
		args["meta_description"] = *req.MetaDescription
	}
	if req.MetaTags != nil {
		sets = append(sets, "meta_tags = @meta_tags")
		args["meta_tags"] = req.MetaTags
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE products SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("productRepository.Update: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Product])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("productRepository.Update scan: %w", err)
	}
	return &product, nil
}

// ─────────────────────────────────────────────────────────────
// Delete  (hard delete — variants cascade via FK)
// ─────────────────────────────────────────────────────────────

func (r *productRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM products WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("productRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// Tags junction
// ─────────────────────────────────────────────────────────────

func (r *productRepository) AttachTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}

	// Build multi-row insert — one round trip for N tags
	rows := make([]string, len(tagIDs))
	args := pgx.NamedArgs{"product_id": productID}
	for i, id := range tagIDs {
		key := fmt.Sprintf("tag_%d", i)
		rows[i] = fmt.Sprintf("(@product_id, @%s)", key)
		args[key] = id
	}

	q := fmt.Sprintf(`
		INSERT INTO product_tags (product_id, tag_id)
		VALUES %s
		ON CONFLICT DO NOTHING`,
		strings.Join(rows, ", "),
	)

	if _, err := r.db.Exec(ctx, q, args); err != nil {
		return fmt.Errorf("productRepository.AttachTags: %w", err)
	}
	return nil
}

func (r *productRepository) DetachTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}

	const q = `DELETE FROM product_tags WHERE product_id = $1 AND tag_id = ANY($2)`
	if _, err := r.db.Exec(ctx, q, productID, tagIDs); err != nil {
		return fmt.Errorf("productRepository.DetachTags: %w", err)
	}
	return nil
}

// SyncTags replaces the product's tags with exactly the given set.
// Called on update when the full tag list is provided.
func (r *productRepository) SyncTags(ctx context.Context, productID int64, tagIDs []int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("productRepository.SyncTags begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`DELETE FROM product_tags WHERE product_id = $1`, productID,
	); err != nil {
		return fmt.Errorf("productRepository.SyncTags delete: %w", err)
	}

	if len(tagIDs) > 0 {
		rows := make([]string, len(tagIDs))
		args := pgx.NamedArgs{"product_id": productID}
		for i, id := range tagIDs {
			key := fmt.Sprintf("tag_%d", i)
			rows[i] = fmt.Sprintf("(@product_id, @%s)", key)
			args[key] = id
		}
		q := fmt.Sprintf(
			`INSERT INTO product_tags (product_id, tag_id) VALUES %s`,
			strings.Join(rows, ", "),
		)
		if _, err := tx.Exec(ctx, q, args); err != nil {
			return fmt.Errorf("productRepository.SyncTags insert: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("productRepository.SyncTags commit: %w", err)
	}
	return nil
}

func (r *productRepository) GetTags(ctx context.Context, productID int64) ([]*models.Tag, error) {
	const q = `
		SELECT t.id, t.title, t.description, t.created_at, t.updated_at
		FROM tags t
		INNER JOIN product_tags pt ON pt.tag_id = t.id
		WHERE pt.product_id = $1
		ORDER BY t.title ASC`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetTags: %w", err)
	}
	defer rows.Close()

	tags, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Tag])
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetTags scan: %w", err)
	}

	result := make([]*models.Tag, len(tags))
	for i := range tags {
		result[i] = &tags[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────

func (r *productRepository) GetImages(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	const q = `
		SELECT * FROM product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC, is_primary DESC`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetImages: %w", err)
	}
	defer rows.Close()

	images, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ProductImage])
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetImages scan: %w", err)
	}

	result := make([]*models.ProductImage, len(images))
	for i := range images {
		result[i] = &images[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────

func (r *productRepository) GetVariants(ctx context.Context, productID int64) ([]*models.ProductVariant, error) {
	const q = `
		SELECT * FROM product_variants
		WHERE product_id = $1
		ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetVariants: %w", err)
	}
	defer rows.Close()

	variants, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ProductVariant])
	if err != nil {
		return nil, fmt.Errorf("productRepository.GetVariants scan: %w", err)
	}

	result := make([]*models.ProductVariant, len(variants))
	for i := range variants {
		result[i] = &variants[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Existence checks
// ─────────────────────────────────────────────────────────────

func (r *productRepository) ExistsByID(ctx context.Context, id int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND is_active = true)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, id).Scan(&exists); err != nil {
		return false, fmt.Errorf("productRepository.ExistsByID: %w", err)
	}
	return exists, nil
}

// GetMediaIdentity resolves an owner for admin media writes without applying the
// public is_active filter. The slug decorates paths; the numeric ID is identity.
func (r *productRepository) GetMediaIdentity(ctx context.Context, productID int64) (string, error) {
	const q = `SELECT COALESCE(slug, '') FROM products WHERE id = $1`
	var slug string
	if err := r.db.QueryRow(ctx, q, productID).Scan(&slug); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", models.ErrNotFound
		}
		return "", fmt.Errorf("productRepository.GetMediaIdentity: %w", err)
	}
	return slug, nil
}

func (r *productRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM products WHERE slug = $1)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, slug).Scan(&exists); err != nil {
		return false, fmt.Errorf("productRepository.ExistsBySlug: %w", err)
	}
	return exists, nil
}

func (r *productRepository) ExistsByCode(ctx context.Context, code string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM products WHERE code = $1)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, code).Scan(&exists); err != nil {
		return false, fmt.Errorf("productRepository.ExistsByCode: %w", err)
	}
	return exists, nil
}
