package product

import (
	"context"
	"errors"
	"fmt"
	catvariant "github.com/tiredbooy/internal/features/catalog/variant"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/catalog/tag"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/searchtext"
)

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

type Repository interface {
	Create(ctx context.Context, req CreateProductReq) (*Product, error)
	FindAggregateOperation(ctx context.Context, operationID, requestHash string) (*ProductAggregateWriteResult, error)
	SaveAggregate(ctx context.Context, productID int64, requestHash string, req SaveProductAggregateReq) (*ProductAggregateWriteResult, error)
	GetByID(ctx context.Context, id int64) (*Product, error)
	GetByIDForAdmin(ctx context.Context, id int64) (*Product, error)
	GetBySlug(ctx context.Context, slug string) (*Product, error)
	GetAll(ctx context.Context, filter ProductFilter) ([]*models.ProductListItem, int64, error)
	// ListForSearchIndex loads every product with brand/category/tags/price band
	// for Meilisearch full rebuild (PH-030b). Not a storefront API projection.
	ListForSearchIndex(ctx context.Context) ([]SearchIndexRow, error)
	Update(ctx context.Context, id int64, req UpdateProductReq) (*Product, error)
	Delete(ctx context.Context, id int64) error

	// Tags junction
	AttachTags(ctx context.Context, productID int64, tagIDs []int64) error
	DetachTags(ctx context.Context, productID int64, tagIDs []int64) error
	SyncTags(ctx context.Context, productID int64, tagIDs []int64) error
	GetTags(ctx context.Context, productID int64) ([]*tag.Tag, error)

	// Images
	GetImages(ctx context.Context, productID int64) ([]*models.ProductImage, error)
	GetMediaIdentity(ctx context.Context, productID int64) (slug string, err error)

	// Variants
	GetVariants(ctx context.Context, productID int64) ([]*catvariant.ProductVariant, error)
	GetVariantOptions(ctx context.Context, productID int64) (map[int64][]models.OptionValueResponse, error)
	GetVariantImages(ctx context.Context, productID int64) (map[int64][]*models.ProductImage, error)
	GetVariantAvailableStock(ctx context.Context, productID int64) (map[int64]int, error)

	ExistsByID(ctx context.Context, id int64) (bool, error)
	ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error)
	ExistsByCode(ctx context.Context, code string, excludeID int64) (bool, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// Inserts the product row and any variants sent alongside it in a
// single transaction, so a product is never persisted without the
// variants the client asked for (and vice-versa).
// ─────────────────────────────────────────────────────────────

func (r *repository) Create(ctx context.Context, req CreateProductReq) (*Product, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.Create begin tx: %w", err)
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
		return nil, fmt.Errorf("repository.Create: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if err != nil {
		return nil, fmt.Errorf("repository.Create scan: %w", err)
	}

	// Persist variants sent on create in the same transaction. Each variant
	// row plus its option links is inserted; a failure rolls back the product.
	for i := range req.Variants {
		if err := insertVariantTx(ctx, tx, product.ID, req.Variants[i]); err != nil {
			return nil, fmt.Errorf("repository.Create variant %d: %w", i, err)
		}
	}
	if err := insertProductTagsTx(ctx, tx, product.ID, req.TagIDs); err != nil {
		return nil, fmt.Errorf("repository.Create tags: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository.Create commit: %w", err)
	}
	return &product, nil
}

// insertVariantTx inserts a single variant (and its option-value links) for the
// given product using the supplied transaction. It mirrors variantRepository.Create
// but joins the caller's transaction so product+variants commit atomically.
func insertVariantTx(ctx context.Context, tx pgx.Tx, productID int64, req catvariant.CreateVariantReq) error {
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
		if isUniqueViolation(err) {
			return models.ErrConflict
		}
		if isOptionForeignKeyViolation(err) {
			return models.ErrNotFound
		}
		return fmt.Errorf("insert variant: %w", err)
	}

	if err := catvariant.InsertVariantOptionsTx(ctx, tx, variantID, req.OptionValueIDs, false); err != nil {
		return fmt.Errorf("attach options: %w", err)
	}
	if err := catvariant.EnsureUniqueVariantCombinationTx(ctx, tx, productID, variantID); err != nil {
		return fmt.Errorf("validate combination: %w", err)
	}
	if err := inventory.EnsureForVariantTx(ctx, tx, variantID); err != nil {
		return fmt.Errorf("ensure inventory: %w", err)
	}

	return nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *repository) GetByID(ctx context.Context, id int64) (*Product, error) {
	const q = `SELECT * FROM products WHERE id = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return &product, nil
}

// GetByIDForAdmin intentionally includes inactive products. Public reads must
// continue through GetByID or GetBySlug so drafts remain undiscoverable.
func (r *repository) GetByIDForAdmin(ctx context.Context, id int64) (*Product, error) {
	const q = `SELECT * FROM products WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByIDForAdmin: %w", err)
	}
	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByIDForAdmin scan: %w", err)
	}
	return &product, nil
}

// GetBySlug is the public product identity lookup. Slugs are matched exactly
// and inactive products intentionally share the same not-found result.
func (r *repository) GetBySlug(ctx context.Context, slug string) (*Product, error) {
	const q = `SELECT * FROM products WHERE slug = $1 AND is_active = true`

	rows, err := r.db.Query(ctx, q, slug)
	if err != nil {
		return nil, fmt.Errorf("repository.GetBySlug: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetBySlug scan: %w", err)
	}
	return &product, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (paginated + filtered)
// Price filters are applied via correlated EXISTS subqueries against
// active product_variants (pv.is_active), keeping the products query free of
// aggregates and joins. Inactive variants never satisfy min_price/max_price.
// (A prior version put MIN/MAX(pv.price) in the WHERE clause against an
// unjoined `pv` alias — invalid SQL that 500'd every price-faceted request.)
// ─────────────────────────────────────────────────────────────

type productFilterSQL struct {
	categoryScope string
	whereSQL      string
	args          pgx.NamedArgs
}

func buildProductFilterSQL(f ProductFilter) productFilterSQL {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}
	categoryScope := ""

	// CF-2: label an existing selection by fetching exactly those products.
	// Validated by the handler; re-parsed here so a bad value can never reach the
	// query regardless of caller.
	if ids, err := f.ValidIDs(); err == nil && len(ids) > 0 {
		where = append(where, "p.id = ANY(@ids)")
		args["ids"] = ids
	}

	// PH-030a / PR-070e: Persian-aware free-text. Query + column text both pass
	// through rumera_search_normalize / searchtext.Normalize (ك/ي→ک/ی, ZWNJ,
	// whitespace). Match title, description, code, brand title, category title,
	// variant SKU, and tag titles. No GET /search; no extra trgm indexes.
	if pattern := searchtext.LikeContains(f.Search); pattern != "" {
		where = append(where, `(
			rumera_search_normalize(p.title) ILIKE @search ESCAPE E'\\'
			OR rumera_search_normalize(p.description) ILIKE @search ESCAPE E'\\'
			OR rumera_search_normalize(p.code) ILIKE @search ESCAPE E'\\'
			OR EXISTS (
				SELECT 1 FROM brands search_brand
				WHERE search_brand.id = p.brand_id
				  AND rumera_search_normalize(search_brand.title) ILIKE @search ESCAPE E'\\'
			)
			OR EXISTS (
				SELECT 1 FROM categories search_cat
				WHERE search_cat.id = p.category_id
				  AND rumera_search_normalize(search_cat.title) ILIKE @search ESCAPE E'\\'
			)
			OR EXISTS (
				SELECT 1 FROM product_variants search_sku
				WHERE search_sku.product_id = p.id
				  AND rumera_search_normalize(search_sku.sku) ILIKE @search ESCAPE E'\\'
			)
			OR EXISTS (
				SELECT 1 FROM product_tags search_pt
				INNER JOIN tags search_tag ON search_tag.id = search_pt.tag_id
				WHERE search_pt.product_id = p.id
				  AND rumera_search_normalize(search_tag.title) ILIKE @search ESCAPE E'\\'
			)
		)`)
		args["search"] = pattern
	}
	if f.CategoryID != nil {
		args["category_id"] = *f.CategoryID
		if f.IncludeDescendants {
			categoryScope = `RECURSIVE category_scope(id) AS (
			SELECT CAST(@category_id AS BIGINT)
			UNION
			SELECT child.id
			FROM categories child
			INNER JOIN category_scope parent ON child.parent_id = parent.id
		),`
			where = append(where, "p.category_id IN (SELECT id FROM category_scope)")
		} else {
			where = append(where, "p.category_id = @category_id")
		}
	}
	if f.BrandID != nil {
		where = append(where, "p.brand_id = @brand_id")
		args["brand_id"] = *f.BrandID
	}
	if f.BrandSlug != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM brands filter_brand
			WHERE filter_brand.id = p.brand_id AND filter_brand.slug = @brand_slug
		)`)
		args["brand_slug"] = *f.BrandSlug
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
	// Price bands consider only active variants so a retired SKU cannot pull
	// a product into a storefront/admin price facet (PR-070a). Combined
	// min+max is still two EXISTS; each independently requires pv.is_active.
	if f.MinPrice != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_variants pv
			WHERE pv.product_id = p.id AND pv.is_active AND pv.price >= @min_price
		)`)
		args["min_price"] = *f.MinPrice
	}
	if f.MaxPrice != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_variants pv
			WHERE pv.product_id = p.id AND pv.is_active AND pv.price <= @max_price
		)`)
		args["max_price"] = *f.MaxPrice
	}

	return productFilterSQL{
		categoryScope: categoryScope,
		whereSQL:      strings.Join(where, " AND "),
		args:          args,
	}
}

// productListSortExpr maps allowlisted ProductFilter.SortBy values to a stable
// SQL ORDER BY expression. Unknown values fall back to created_at (never
// interpolated raw client input beyond the allowlist).
//
// "price" sorts by the cheapest *active* variant so storefront "ارزان‌ترین" /
// "گران‌ترین" match the min_price band shown on cards. Products without an
// active variant sort last via NULLS LAST on the outer query.
func productListSortExpr(sortBy string) string {
	switch sortBy {
	case "title":
		return "p.title"
	case "updated_at":
		return "p.updated_at"
	case "price":
		return `(SELECT MIN(pv.price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active)`
	default:
		return "p.created_at"
	}
}

func productListSortDirection(orderBy string) string {
	if strings.EqualFold(orderBy, "ASC") {
		return "ASC"
	}
	return "DESC"
}

func (r *repository) GetAll(ctx context.Context, f ProductFilter) ([]*models.ProductListItem, int64, error) {
	// No hardcoded is_active filter — callers decide (the public list forces
	// active, the admin list shows all) via f.IsActive.
	filterSQL := buildProductFilterSQL(f)
	args := filterSQL.args

	sortExpr := productListSortExpr(f.SortBy)
	order := productListSortDirection(f.OrderBy)
	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	// filtered_products is referenced by both the page and total CTEs inside one
	// statement. The LEFT JOIN from total keeps the count available even when an
	// offset is beyond the last page and there are no product rows to return.
	q := fmt.Sprintf(`
	WITH %s
	filtered_products AS (
		SELECT p.id
		FROM products p
		WHERE %s
	),
	paged_products AS (
		SELECT p.id
		FROM products p
		INNER JOIN filtered_products filtered ON filtered.id = p.id
		ORDER BY %s %s NULLS LAST, p.id %s
		LIMIT @limit OFFSET @offset
	),
	product_total AS (
		SELECT COUNT(*) AS total_count FROM filtered_products
	)
    SELECT
        p.id, p.title, p.code, p.slug, p.is_active, p.weight,
        b.title AS brand,
        c.title AS category,
		COALESCE(pr.min_price, 0) AS min_price,
		COALESCE(pr.max_price, 0) AS max_price,
		COALESCE(pr.active_variant_count, 0) AS active_variant_count,
		COALESCE(pr.available_variant_count, 0) AS available_variant_count,
		COALESCE(pr.available_stock, 0) AS available_stock,
		pr.purchasable_variant_id,
		COALESCE(tag_data.ids, ARRAY[]::BIGINT[]) AS tag_ids,
		COALESCE(tag_data.titles, ARRAY[]::TEXT[]) AS tag_titles,
		img.id AS image_id, img.image_url, img.storage_key, img.alt_text, img.width, img.height,
		img.sort_order, img.is_primary,
		product_total.total_count
	FROM product_total
	LEFT JOIN paged_products page ON TRUE
	LEFT JOIN products p ON p.id = page.id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
	LEFT JOIN LATERAL (
		SELECT
			MIN(price) AS min_price,
			MAX(price) AS max_price,
			COUNT(*) AS active_variant_count,
			COUNT(*) FILTER (
				WHERE GREATEST(
					COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0),
					0
				) > 0
			) AS available_variant_count,
			COALESCE(SUM(
				GREATEST(
					COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0),
					0
				)
			), 0) AS available_stock,
			CASE
				WHEN COUNT(*) = 1
					AND COALESCE(MAX(
						GREATEST(
							COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0),
							0
						)
					), 0) > 0
				THEN MIN(pv.id)
			END AS purchasable_variant_id
		FROM product_variants pv
		LEFT JOIN inventory i ON i.product_variant_id = pv.id
		WHERE pv.product_id = p.id AND pv.is_active
	) pr ON TRUE
	LEFT JOIN LATERAL (
		SELECT
			ARRAY_AGG(t.id ORDER BY t.title, t.id) AS ids,
			ARRAY_AGG(t.title ORDER BY t.title, t.id) AS titles
		FROM product_tags pt
		INNER JOIN tags t ON t.id = pt.tag_id
		WHERE pt.product_id = p.id
	) tag_data ON TRUE
    LEFT JOIN LATERAL (
		SELECT id, image_url, storage_key, alt_text, width, height,
			sort_order, COALESCE(is_primary, FALSE) AS is_primary
        FROM product_images pi
        WHERE pi.product_id = p.id AND pi.product_variant_id IS NULL
        ORDER BY pi.is_primary DESC, pi.sort_order ASC
        LIMIT 1	
    ) img ON TRUE
	ORDER BY %s %s NULLS LAST, p.id %s NULLS LAST`,
		filterSQL.categoryScope,
		filterSQL.whereSQL,
		sortExpr,
		order,
		order,
		sortExpr,
		order,
		order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll: %w", err)
	}
	defer rows.Close()

	items := make([]*models.ProductListItem, 0, f.Limit)
	var total int64

	for rows.Next() {
		var (
			productID      *int64
			title          *string
			code           *string
			slug           *string
			isActive       *bool
			weight         *float64
			brand          *string
			category       *string
			minPrice       float64
			maxPrice       float64
			activeCount    int
			availableCount int
			availableStock int64
			purchasableID  *int64
			tagIDs         []int64
			tagTitles      []string
			imgID          *int64
			imgURL         *string
			imgStorageKey  *string
			imgAltText     *string
			imgWidth       *int
			imgHeight      *int
			imgSortOrder   *int
			imgIsPrimary   *bool
		)

		if err := rows.Scan(
			&productID, &title, &code, &slug, &isActive, &weight,
			&brand, &category, &minPrice, &maxPrice,
			&activeCount, &availableCount, &availableStock, &purchasableID,
			&tagIDs, &tagTitles,
			&imgID, &imgURL, &imgStorageKey, &imgAltText, &imgWidth, &imgHeight,
			&imgSortOrder, &imgIsPrimary,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository.GetAll scan: %w", err)
		}
		if productID == nil {
			continue
		}
		if title == nil || isActive == nil {
			return nil, 0, fmt.Errorf("repository.GetAll scan: product %d missing required fields", *productID)
		}
		if len(tagIDs) != len(tagTitles) {
			return nil, 0, fmt.Errorf("repository.GetAll scan: product %d has mismatched tag projection", *productID)
		}
		tags := make([]models.TagResponse, len(tagIDs))
		for i := range tagIDs {
			tags[i] = models.TagResponse{ID: tagIDs[i], Title: tagTitles[i]}
		}

		it := &models.ProductListItem{
			ID:                    *productID,
			Title:                 *title,
			Code:                  code,
			Slug:                  slug,
			Brand:                 brand,
			Category:              category,
			Tags:                  tags,
			IsActive:              *isActive,
			Weight:                weight,
			MinPrice:              minPrice,
			MaxPrice:              maxPrice,
			ActiveVariantCount:    activeCount,
			AvailableVariantCount: availableCount,
			AvailableStock:        availableStock,
			PurchasableVariantID:  purchasableID,
		}

		if imgID != nil && imgURL != nil {
			if imgSortOrder == nil || imgIsPrimary == nil {
				return nil, 0, fmt.Errorf("repository.GetAll scan: image %d missing required fields", *imgID)
			}
			it.Image = &models.ImageResponse{
				ID:         *imgID,
				ImageURL:   *imgURL,
				StorageKey: imgStorageKey,
				AltText:    imgAltText,
				SortOrder:  *imgSortOrder,
				IsPrimary:  *imgIsPrimary,
				Width:      imgWidth,
				Height:     imgHeight,
			}
		}

		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll rows: %w", err)
	}

	return items, total, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH)
// ─────────────────────────────────────────────────────────────

func (r *repository) Update(ctx context.Context, id int64, req UpdateProductReq) (*Product, error) {
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
		return r.GetByIDForAdmin(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE products SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("repository.Update: %w", err)
	}

	product, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Product])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.Update scan: %w", err)
	}
	return &product, nil
}

// ─────────────────────────────────────────────────────────────
// Delete hard-deletes products that have never entered an immutable inventory
// or order audit trail. Current stock and cart rows are operational state, so
// they are removed in the same transaction before variants cascade.
// ─────────────────────────────────────────────────────────────

func (r *repository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.Delete begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM products WHERE id = $1 FOR UPDATE)`, id).Scan(&exists); err != nil {
		return fmt.Errorf("repository.Delete lock: %w", err)
	}
	if !exists {
		return models.ErrNotFound
	}

	var hasHistory bool
	const historyQuery = `
		SELECT EXISTS (
			SELECT 1
			FROM inventory_movements im
			JOIN product_variants pv ON pv.id = im.product_variant_id
			WHERE pv.product_id = $1
			UNION ALL
			SELECT 1 FROM order_items oi WHERE oi.product_id = $1
		)`
	if err := tx.QueryRow(ctx, historyQuery, id).Scan(&hasHistory); err != nil {
		return fmt.Errorf("repository.Delete history check: %w", err)
	}
	if hasHistory {
		return models.ErrProductHasHistory
	}

	// These rows intentionally use restrictive FKs. They are safe to discard
	// only after the audit-history check above succeeds.
	for _, cleanupQuery := range []string{
		`DELETE FROM cart_items
		 WHERE product_variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)`,
		`DELETE FROM inventory
		 WHERE product_variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)`,
	} {
		if _, err := tx.Exec(ctx, cleanupQuery, id); err != nil {
			return fmt.Errorf("repository.Delete cleanup: %w", err)
		}
	}

	res, err := tx.Exec(ctx, `DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return models.ErrProductHasHistory
		}
		return fmt.Errorf("repository.Delete product: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		if isForeignKeyViolation(err) {
			return models.ErrProductHasHistory
		}
		return fmt.Errorf("repository.Delete commit: %w", err)
	}
	return nil
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

// ─────────────────────────────────────────────────────────────
// Tags junction
// ─────────────────────────────────────────────────────────────

func (r *repository) AttachTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.AttachTags begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	if err := insertProductTagsTx(ctx, tx, productID, tagIDs); err != nil {
		return fmt.Errorf("repository.AttachTags insert: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.AttachTags commit: %w", err)
	}
	return nil
}

func (r *repository) DetachTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.DetachTags begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM product_tags WHERE product_id = $1 AND tag_id = ANY($2)`,
		productID, tagIDs,
	); err != nil {
		return fmt.Errorf("repository.DetachTags: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.DetachTags commit: %w", err)
	}
	return nil
}

// SyncTags replaces the product's tags with exactly the given set.
// Called on update when the full tag list is provided.
func (r *repository) SyncTags(ctx context.Context, productID int64, tagIDs []int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.SyncTags begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := touchProductGraphTx(ctx, tx, productID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`DELETE FROM product_tags WHERE product_id = $1`, productID,
	); err != nil {
		return fmt.Errorf("repository.SyncTags delete: %w", err)
	}

	if err := insertProductTagsTx(ctx, tx, productID, tagIDs); err != nil {
		return fmt.Errorf("repository.SyncTags insert: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.SyncTags commit: %w", err)
	}
	return nil
}

func insertProductTagsTx(ctx context.Context, tx pgx.Tx, productID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}
	const q = `
		INSERT INTO product_tags (product_id, tag_id)
		SELECT $1, submitted.tag_id
		FROM (SELECT DISTINCT unnest($2::bigint[]) AS tag_id) submitted
		ON CONFLICT DO NOTHING`
	_, err := tx.Exec(ctx, q, productID, tagIDs)
	return err
}

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

func (r *repository) GetTags(ctx context.Context, productID int64) ([]*tag.Tag, error) {
	const q = `
		SELECT t.id, t.title, t.description, t.created_at, t.updated_at
		FROM tags t
		INNER JOIN product_tags pt ON pt.tag_id = t.id
		WHERE pt.product_id = $1
		ORDER BY t.title ASC`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetTags: %w", err)
	}
	defer rows.Close()

	tags, err := pgx.CollectRows(rows, pgx.RowToStructByName[tag.Tag])
	if err != nil {
		return nil, fmt.Errorf("repository.GetTags scan: %w", err)
	}

	result := make([]*tag.Tag, len(tags))
	for i := range tags {
		result[i] = &tags[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────

func (r *repository) GetImages(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	const q = `
		SELECT * FROM product_images
		WHERE product_id = $1 AND product_variant_id IS NULL
		ORDER BY sort_order ASC, is_primary DESC`

	rows, err := r.db.Query(ctx, q, productID)
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

// ─────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────

func (r *repository) GetVariants(ctx context.Context, productID int64) ([]*catvariant.ProductVariant, error) {
	const q = `
		SELECT * FROM product_variants
		WHERE product_id = $1
		ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetVariants: %w", err)
	}
	defer rows.Close()

	variants, err := pgx.CollectRows(rows, pgx.RowToStructByName[catvariant.ProductVariant])
	if err != nil {
		return nil, fmt.Errorf("repository.GetVariants scan: %w", err)
	}

	result := make([]*catvariant.ProductVariant, len(variants))
	for i := range variants {
		result[i] = &variants[i]
	}
	return result, nil
}

func (r *repository) GetVariantOptions(
	ctx context.Context,
	productID int64,
) (map[int64][]models.OptionValueResponse, error) {
	const q = `
		SELECT
			pv.id,
			ov.id,
			ov.option_type_id,
			ot.title,
			ot.display_name,
			ov.value
		FROM product_variants pv
		INNER JOIN product_variants_options pvo ON pvo.product_variant_id = pv.id
		INNER JOIN option_values ov ON ov.id = pvo.variant_option_id
		INNER JOIN option_types ot ON ot.id = ov.option_type_id
		WHERE pv.product_id = $1
		ORDER BY pv.created_at, pv.id, ot.display_name, ov.sort_order, ov.value, ov.id`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetVariantOptions: %w", err)
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
			return nil, fmt.Errorf("repository.GetVariantOptions scan: %w", err)
		}
		result[variantID] = append(result[variantID], option)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.GetVariantOptions rows: %w", err)
	}
	return result, nil
}

func (r *repository) GetVariantImages(
	ctx context.Context,
	productID int64,
) (map[int64][]*models.ProductImage, error) {
	const q = `
		SELECT pi.*
		FROM product_images pi
		INNER JOIN product_variants pv ON pv.id = pi.product_variant_id
		WHERE pv.product_id = $1
		ORDER BY pv.created_at, pv.id, pi.sort_order, pi.is_primary DESC, pi.id`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetVariantImages: %w", err)
	}
	defer rows.Close()

	images, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ProductImage])
	if err != nil {
		return nil, fmt.Errorf("repository.GetVariantImages scan: %w", err)
	}
	result := make(map[int64][]*models.ProductImage)
	for i := range images {
		if images[i].ProductVariantID == nil {
			continue
		}
		variantID := *images[i].ProductVariantID
		result[variantID] = append(result[variantID], &images[i])
	}
	return result, nil
}

// GetVariantAvailableStock hydrates every variant in one inventory query. A
// missing inventory row is sold out, and inconsistent negative availability is
// clamped at zero at the database boundary.
func (r *repository) GetVariantAvailableStock(ctx context.Context, productID int64) (map[int64]int, error) {
	const q = `
		SELECT
			pv.id,
			GREATEST(
				COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0),
				0
			) AS available_stock
		FROM product_variants pv
		LEFT JOIN inventory i ON i.product_variant_id = pv.id
		WHERE pv.product_id = $1`

	rows, err := r.db.Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetVariantAvailableStock: %w", err)
	}
	defer rows.Close()

	stock := make(map[int64]int)
	for rows.Next() {
		var variantID int64
		var available int
		if err := rows.Scan(&variantID, &available); err != nil {
			return nil, fmt.Errorf("repository.GetVariantAvailableStock scan: %w", err)
		}
		stock[variantID] = available
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository.GetVariantAvailableStock rows: %w", err)
	}
	return stock, nil
}

// ─────────────────────────────────────────────────────────────
// Existence checks
// ─────────────────────────────────────────────────────────────

func (r *repository) ExistsByID(ctx context.Context, id int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, id).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByID: %w", err)
	}
	return exists, nil
}

// GetMediaIdentity resolves an owner for admin media writes without applying the
// public is_active filter. The slug decorates paths; the numeric ID is identity.
func (r *repository) GetMediaIdentity(ctx context.Context, productID int64) (string, error) {
	const q = `SELECT COALESCE(slug, '') FROM products WHERE id = $1`
	var slug string
	if err := r.db.QueryRow(ctx, q, productID).Scan(&slug); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", models.ErrNotFound
		}
		return "", fmt.Errorf("repository.GetMediaIdentity: %w", err)
	}
	return slug, nil
}

func (r *repository) ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM products WHERE slug = $1 AND id <> $2)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, slug, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsBySlug: %w", err)
	}
	return exists, nil
}

func (r *repository) ExistsByCode(ctx context.Context, code string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM products WHERE code = $1 AND id <> $2)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, code, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByCode: %w", err)
	}
	return exists, nil
}
