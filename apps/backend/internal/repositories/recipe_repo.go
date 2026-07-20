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

// ── Interfaces ────────────────────────────────────────────────────────────────

type RecipeRepository interface {
	GetByID(ctx context.Context, id int64) (*models.Recipe, error)
	GetBySlug(ctx context.Context, slug string) (*models.Recipe, error)
	GetPublishedBySlug(ctx context.Context, slug string) (*models.Recipe, error)
	List(ctx context.Context, filter models.RecipeFilter) ([]*models.Recipe, int64, error)
	Create(ctx context.Context, req *models.RecipeReq) (*models.Recipe, error)
	Update(ctx context.Context, id int64, req *models.RecipeUpdateReq) (*models.Recipe, error)
	Delete(ctx context.Context, id int64) error
	IncrementViewCount(ctx context.Context, id int64) error
	SlugExists(ctx context.Context, slug string) (bool, error)
	PublishedSitemap(ctx context.Context) ([]*models.RecipeSitemapItem, error)

	// ingredients
	GetIngredientsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeIngredient, error)
	CreateIngredient(ctx context.Context, recipeID int64, req *models.RecipeIngredientReq) (*models.RecipeIngredient, error)
	CreateIngredients(ctx context.Context, recipeID int64, reqs []*models.RecipeIngredientReq) ([]*models.RecipeIngredient, error)
	UpdateIngredient(ctx context.Context, id int64, req *models.RecipeIngredientReq) (*models.RecipeIngredient, error)
	DeleteIngredient(ctx context.Context, id int64) error
	DeleteIngredientsByRecipeID(ctx context.Context, recipeID int64) error

	// products (shoppable upsell list)
	GetProductsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeProduct, error)
	GetShoppableProducts(ctx context.Context, recipeID int64) ([]*models.ShoppableProduct, error)
	AssignProducts(ctx context.Context, recipeID int64, reqs []*models.RecipeProductReq) error
	RemoveProducts(ctx context.Context, recipeID int64) error
	// GetRecipeCardsByProductID returns published recipes that use a given product
	// (via its variants), powering "make a cocktail with this" cross-sell.
	GetRecipeCardsByProductID(ctx context.Context, productID int64, limit int) ([]*models.Recipe, error)

	// tags
	GetTagsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeTagInfo, error)
	GetTagIDsByRecipeID(ctx context.Context, recipeID int64) ([]int64, error)
	AssignTags(ctx context.Context, recipeID int64, tagIDs []int64) error
	RemoveTags(ctx context.Context, recipeID int64) error
}

// ── Repository ────────────────────────────────────────────────────────────────

type recipeRepository struct{ db *pgxpool.Pool }

func NewRecipeRepository(db *pgxpool.Pool) RecipeRepository {
	return &recipeRepository{db: db}
}

const recipeColumns = `id, title, slug, excerpt, description, content, difficulty,
	prep_time_minutes, cook_time_minutes, total_time_minutes, servings, calories,
	cocktail_type, glass_type, serving_suggestion,
	image_url, status, is_featured, published_at, view_count,
	meta_title, meta_description, meta_keywords, canonical_url, og_image_url,
	user_id, created_at, updated_at`

// recipeScanDest returns the column→field pointer mapping in recipeColumns order
// so scanning is defined once and reused by every read path.
func recipeScanDest(r *models.Recipe) []any {
	return []any{
		&r.ID, &r.Title, &r.Slug, &r.Excerpt, &r.Description, &r.Content, &r.Difficulty,
		&r.PrepTimeMinutes, &r.CookTimeMinutes, &r.TotalTimeMinutes, &r.Servings, &r.Calories,
		&r.CocktailType, &r.GlassType, &r.ServingSuggestion,
		&r.ImageURL, &r.Status, &r.IsFeatured, &r.PublishedAt, &r.ViewCount,
		&r.MetaTitle, &r.MetaDescription, &r.MetaKeywords, &r.CanonicalURL, &r.OGImageURL,
		&r.UserID, &r.CreatedAt, &r.UpdatedAt,
	}
}

func scanRecipe(row pgx.Row, r *models.Recipe) error {
	return row.Scan(recipeScanDest(r)...)
}

// ── Recipe CRUD ───────────────────────────────────────────────────────────────

func (r *recipeRepository) GetByID(ctx context.Context, id int64) (*models.Recipe, error) {
	rec := &models.Recipe{}
	err := scanRecipe(r.db.QueryRow(ctx,
		`SELECT `+recipeColumns+` FROM recipes WHERE id = $1`, id,
	), rec)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting recipe: %w", err)
	}
	return rec, nil
}

func (r *recipeRepository) GetBySlug(ctx context.Context, slug string) (*models.Recipe, error) {
	rec := &models.Recipe{}
	err := scanRecipe(r.db.QueryRow(ctx,
		`SELECT `+recipeColumns+` FROM recipes WHERE slug = $1`, slug,
	), rec)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting recipe by slug: %w", err)
	}
	return rec, nil
}

// GetPublishedBySlug restricts to published recipes — the public storefront read.
func (r *recipeRepository) GetPublishedBySlug(ctx context.Context, slug string) (*models.Recipe, error) {
	rec := &models.Recipe{}
	err := scanRecipe(r.db.QueryRow(ctx,
		`SELECT `+recipeColumns+` FROM recipes WHERE slug = $1 AND status = 'published'`, slug,
	), rec)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("getting published recipe by slug: %w", err)
	}
	return rec, nil
}

func (r *recipeRepository) List(ctx context.Context, f models.RecipeFilter) ([]*models.Recipe, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "(r.title ILIKE @search OR r.excerpt ILIKE @search)")
		args["search"] = "%" + f.Search + "%"
	}
	if f.Status != nil {
		where = append(where, "r.status = @status")
		args["status"] = string(*f.Status)
	}
	if f.Difficulty != nil {
		where = append(where, "r.difficulty = @difficulty")
		args["difficulty"] = string(*f.Difficulty)
	}
	if f.IsFeatured != nil {
		where = append(where, "r.is_featured = @is_featured")
		args["is_featured"] = *f.IsFeatured
	}
	if f.MaxTime != nil {
		where = append(where, "r.total_time_minutes <= @max_time")
		args["max_time"] = *f.MaxTime
	}
	if f.TagID != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = @tag_id
		)`)
		args["tag_id"] = *f.TagID
	}
	if f.VariantID != nil {
		where = append(where, `(
			EXISTS (SELECT 1 FROM recipe_products rp WHERE rp.recipe_id = r.id AND rp.product_variant_id = @variant_id)
			OR EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.recipe_id = r.id AND ri.product_variant_id = @variant_id)
		)`)
		args["variant_id"] = *f.VariantID
	}

	allowed := map[string]string{
		"published_at": "r.published_at",
		"created_at":   "r.created_at",
		"updated_at":   "r.updated_at",
		"title":        "r.title",
		"view_count":   "r.view_count",
		"total_time":   "r.total_time_minutes",
	}
	sortBy := "r.published_at"
	if col, ok := allowed[f.SortBy]; ok {
		sortBy = col
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	// NULLS LAST keeps unpublished/draft recipes from floating to the top when
	// sorting by published_at.
	q := fmt.Sprintf(`
		SELECT `+recipeColumns+`, COUNT(*) OVER() AS total_count
		FROM recipes r
		WHERE %s
		ORDER BY %s %s NULLS LAST, r.id DESC
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("listing recipes: %w", err)
	}
	defer rows.Close()

	var (
		recipes []*models.Recipe
		total   int64
	)
	for rows.Next() {
		rec := &models.Recipe{}
		dest := append(recipeScanDest(rec), &total)
		if err := rows.Scan(dest...); err != nil {
			return nil, 0, fmt.Errorf("scanning recipe: %w", err)
		}
		recipes = append(recipes, rec)
	}
	return recipes, total, rows.Err()
}

func (r *recipeRepository) Create(ctx context.Context, req *models.RecipeReq) (*models.Recipe, error) {
	query := `INSERT INTO recipes
		(title, slug, excerpt, description, content, difficulty,
		 prep_time_minutes, cook_time_minutes, servings, calories,
		 cocktail_type, glass_type, serving_suggestion,
		 image_url, status, is_featured, published_at,
		 meta_title, meta_description, meta_keywords, canonical_url, og_image_url,
		 user_id)
		VALUES ($1,$2,$3,$4,$5,$6,
		        $7,$8,$9,$10,
		        $11,$12,$13,
		        $14,$15,$16,$17,
		        $18,$19,$20,$21,$22,
		        $23)
		RETURNING ` + recipeColumns

	rec := &models.Recipe{}
	if err := scanRecipe(r.db.QueryRow(ctx, query,
		req.Title, req.Slug, req.Excerpt, req.Description, req.Content, req.Difficulty,
		req.PrepTimeMinutes, req.CookTimeMinutes, req.Servings, req.Calories,
		req.CocktailType, req.GlassType, req.ServingSuggestion,
		req.ImageURL, req.Status, req.IsFeatured, req.PublishedAt,
		req.MetaTitle, req.MetaDescription, req.MetaKeywords, req.CanonicalURL, req.OGImageURL,
		req.UserID,
	), rec); err != nil {
		return nil, fmt.Errorf("creating recipe: %w", err)
	}
	return rec, nil
}

func (r *recipeRepository) Update(ctx context.Context, id int64, req *models.RecipeUpdateReq) (*models.Recipe, error) {
	sets := []string{"updated_at = NOW()"}
	args := pgx.NamedArgs{"id": id}

	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf("%s = @%s", col, col))
		args[col] = val
	}

	if req.Title != nil {
		add("title", *req.Title)
	}
	if req.Slug != nil {
		add("slug", *req.Slug)
	}
	if req.Excerpt != nil {
		add("excerpt", *req.Excerpt)
	}
	if req.Description != nil {
		add("description", *req.Description)
	}
	if req.Content != nil {
		add("content", *req.Content)
	}
	if req.Difficulty != nil {
		add("difficulty", string(*req.Difficulty))
	}
	if req.PrepTimeMinutes != nil {
		add("prep_time_minutes", *req.PrepTimeMinutes)
	}
	if req.CookTimeMinutes != nil {
		add("cook_time_minutes", *req.CookTimeMinutes)
	}
	if req.Servings != nil {
		add("servings", *req.Servings)
	}
	if req.Calories != nil {
		add("calories", *req.Calories)
	}
	if req.CocktailType != nil {
		add("cocktail_type", *req.CocktailType)
	}
	if req.GlassType != nil {
		add("glass_type", *req.GlassType)
	}
	if req.ServingSuggestion != nil {
		add("serving_suggestion", *req.ServingSuggestion)
	}
	if req.ImageURL != nil {
		sets = append(sets,
			"image_storage_key = CASE WHEN image_url IS DISTINCT FROM @image_url THEN NULL ELSE image_storage_key END",
		)
		add("image_url", *req.ImageURL)
	}
	if req.Status != nil {
		add("status", string(*req.Status))
	}
	if req.IsFeatured != nil {
		add("is_featured", *req.IsFeatured)
	}
	if req.PublishedAt != nil {
		add("published_at", *req.PublishedAt)
	}
	if req.MetaTitle != nil {
		add("meta_title", *req.MetaTitle)
	}
	if req.MetaDescription != nil {
		add("meta_description", *req.MetaDescription)
	}
	if req.MetaKeywords != nil {
		add("meta_keywords", req.MetaKeywords)
	}
	if req.CanonicalURL != nil {
		add("canonical_url", *req.CanonicalURL)
	}
	if req.OGImageURL != nil {
		sets = append(sets,
			"og_image_storage_key = CASE WHEN og_image_url IS DISTINCT FROM @og_image_url THEN NULL ELSE og_image_storage_key END",
		)
		add("og_image_url", *req.OGImageURL)
	}

	query := fmt.Sprintf(
		`UPDATE recipes SET %s WHERE id = @id RETURNING `+recipeColumns,
		strings.Join(sets, ", "),
	)

	rec := &models.Recipe{}
	if err := scanRecipe(r.db.QueryRow(ctx, query, args), rec); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("updating recipe: %w", err)
	}
	return rec, nil
}

func (r *recipeRepository) Delete(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM recipes WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting recipe: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *recipeRepository) IncrementViewCount(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `UPDATE recipes SET view_count = view_count + 1 WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("incrementing recipe view count: %w", err)
	}
	return nil
}

func (r *recipeRepository) SlugExists(ctx context.Context, slug string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM recipes WHERE slug = $1)`, slug,
	).Scan(&exists); err != nil {
		return false, fmt.Errorf("checking recipe slug: %w", err)
	}
	return exists, nil
}

func (r *recipeRepository) PublishedSitemap(ctx context.Context) ([]*models.RecipeSitemapItem, error) {
	rows, err := r.db.Query(ctx,
		`SELECT slug, updated_at, og_image_url
		 FROM recipes WHERE status = 'published' ORDER BY updated_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipe sitemap: %w", err)
	}
	defer rows.Close()

	var items []*models.RecipeSitemapItem
	for rows.Next() {
		it := &models.RecipeSitemapItem{}
		if err := rows.Scan(&it.Slug, &it.UpdatedAt, &it.ImageURL); err != nil {
			return nil, fmt.Errorf("scanning sitemap item: %w", err)
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// ── Ingredients ───────────────────────────────────────────────────────────────

const ingredientColumns = `id, recipe_id, product_variant_id, ingredient_name,
						   quantity, unit, optional, notes, sort_order, created_at, updated_at`

func scanIngredient(row pgx.Row, i *models.RecipeIngredient) error {
	return row.Scan(
		&i.ID, &i.RecipeID, &i.ProductVariantID, &i.IngredientName,
		&i.Quantity, &i.Unit, &i.Optional, &i.Notes,
		&i.SortOrder, &i.CreatedAt, &i.UpdatedAt,
	)
}

func (r *recipeRepository) GetIngredientsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeIngredient, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+ingredientColumns+` FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY sort_order ASC, id ASC`,
		recipeID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipe ingredients: %w", err)
	}
	defer rows.Close()

	var ingredients []*models.RecipeIngredient
	for rows.Next() {
		i := &models.RecipeIngredient{}
		if err := rows.Scan(
			&i.ID, &i.RecipeID, &i.ProductVariantID, &i.IngredientName,
			&i.Quantity, &i.Unit, &i.Optional, &i.Notes,
			&i.SortOrder, &i.CreatedAt, &i.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning recipe ingredient: %w", err)
		}
		ingredients = append(ingredients, i)
	}
	return ingredients, rows.Err()
}

func (r *recipeRepository) CreateIngredient(ctx context.Context, recipeID int64, req *models.RecipeIngredientReq) (*models.RecipeIngredient, error) {
	query := `INSERT INTO recipe_ingredients
			  (recipe_id, product_variant_id, ingredient_name, quantity, unit, optional, notes, sort_order)
			  VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,0))
			  RETURNING ` + ingredientColumns

	i := &models.RecipeIngredient{}
	if err := scanIngredient(r.db.QueryRow(ctx, query,
		recipeID, req.ProductVariantID, req.IngredientName,
		req.Quantity, req.Unit, req.Optional, req.Notes, req.SortOrder,
	), i); err != nil {
		return nil, fmt.Errorf("creating recipe ingredient: %w", err)
	}
	return i, nil
}

func (r *recipeRepository) CreateIngredients(ctx context.Context, recipeID int64, reqs []*models.RecipeIngredientReq) ([]*models.RecipeIngredient, error) {
	if len(reqs) == 0 {
		return nil, nil
	}

	query := `INSERT INTO recipe_ingredients
			  (recipe_id, product_variant_id, ingredient_name, quantity, unit, optional, notes, sort_order)
			  VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,0))
			  RETURNING ` + ingredientColumns

	batch := &pgx.Batch{}
	for _, req := range reqs {
		batch.Queue(query,
			recipeID, req.ProductVariantID, req.IngredientName,
			req.Quantity, req.Unit, req.Optional, req.Notes, req.SortOrder,
		)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	ingredients := make([]*models.RecipeIngredient, 0, len(reqs))
	for range reqs {
		i := &models.RecipeIngredient{}
		if err := scanIngredient(br.QueryRow(), i); err != nil {
			return nil, fmt.Errorf("scanning batch ingredient: %w", err)
		}
		ingredients = append(ingredients, i)
	}
	return ingredients, nil
}

func (r *recipeRepository) UpdateIngredient(ctx context.Context, id int64, req *models.RecipeIngredientReq) (*models.RecipeIngredient, error) {
	query := `UPDATE recipe_ingredients
			  SET product_variant_id = COALESCE($2, product_variant_id),
			      ingredient_name    = COALESCE($3, ingredient_name),
			      quantity           = COALESCE($4, quantity),
			      unit               = COALESCE($5, unit),
			      optional           = $6,
			      notes              = COALESCE($7, notes),
			      sort_order         = COALESCE($8, sort_order),
			      updated_at         = NOW()
			  WHERE id = $1
			  RETURNING ` + ingredientColumns

	i := &models.RecipeIngredient{}
	if err := scanIngredient(r.db.QueryRow(ctx, query,
		id, req.ProductVariantID, req.IngredientName,
		req.Quantity, req.Unit, req.Optional, req.Notes, req.SortOrder,
	), i); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("updating recipe ingredient: %w", err)
	}
	return i, nil
}

func (r *recipeRepository) DeleteIngredient(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM recipe_ingredients WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting recipe ingredient: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *recipeRepository) DeleteIngredientsByRecipeID(ctx context.Context, recipeID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM recipe_ingredients WHERE recipe_id = $1`, recipeID)
	return err
}

// ── Products (shoppable) ────────────────────────────────────────────────────────

func (r *recipeRepository) GetProductsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeProduct, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, recipe_id, product_variant_id, quantity, unit, sort_order, is_primary, role
		 FROM recipe_products WHERE recipe_id = $1 ORDER BY is_primary DESC, sort_order ASC, id ASC`,
		recipeID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipe products: %w", err)
	}
	defer rows.Close()

	var products []*models.RecipeProduct
	for rows.Next() {
		p := &models.RecipeProduct{}
		if err := rows.Scan(&p.ID, &p.RecipeID, &p.ProductVariantID, &p.Quantity, &p.Unit,
			&p.SortOrder, &p.IsPrimary, &p.Role); err != nil {
			return nil, fmt.Errorf("scanning recipe product: %w", err)
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

// GetShoppableProducts joins the recipe's curated products to live catalogue data
// (price, brand, image, availability) so the recipe page can sell directly.
func (r *recipeRepository) GetShoppableProducts(ctx context.Context, recipeID int64) ([]*models.ShoppableProduct, error) {
	const q = `
		SELECT
			rp.id,
			rp.product_variant_id,
			p.id            AS product_id,
			p.title         AS product_title,
			p.slug          AS product_slug,
			b.title         AS brand,
			pv.sku,
			pv.price,
			pv.compare_at_price,
			img.image_url,
			(pv.is_active AND p.is_active) AS is_available,
			rp.quantity,
			rp.unit,
			rp.sort_order,
			rp.is_primary,
			rp.role
		FROM recipe_products rp
		JOIN product_variants pv ON pv.id = rp.product_variant_id
		JOIN products p          ON p.id = pv.product_id
		LEFT JOIN brands b       ON b.id = p.brand_id
		LEFT JOIN LATERAL (
			SELECT image_url FROM product_images pi
			WHERE pi.product_variant_id = pv.id OR pi.product_id = p.id
			ORDER BY (pi.product_variant_id = pv.id) DESC, pi.is_primary DESC, pi.sort_order ASC
			LIMIT 1
		) img ON TRUE
		WHERE rp.recipe_id = $1
		ORDER BY rp.is_primary DESC, rp.sort_order ASC, rp.id ASC`

	rows, err := r.db.Query(ctx, q, recipeID)
	if err != nil {
		return nil, fmt.Errorf("querying shoppable products: %w", err)
	}
	defer rows.Close()

	var products []*models.ShoppableProduct
	for rows.Next() {
		p := &models.ShoppableProduct{}
		if err := rows.Scan(
			&p.RecipeProductID, &p.ProductVariantID, &p.ProductID, &p.ProductTitle,
			&p.ProductSlug, &p.Brand, &p.SKU, &p.Price, &p.CompareAtPrice,
			&p.ImageURL, &p.IsAvailable, &p.Quantity, &p.Unit,
			&p.SortOrder, &p.IsPrimary, &p.Role,
		); err != nil {
			return nil, fmt.Errorf("scanning shoppable product: %w", err)
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

func (r *recipeRepository) AssignProducts(ctx context.Context, recipeID int64, reqs []*models.RecipeProductReq) error {
	if len(reqs) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i, req := range reqs {
		sortOrder := i
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}
		batch.Queue(
			`INSERT INTO recipe_products (recipe_id, product_variant_id, quantity, unit, sort_order, is_primary, role)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)
			 ON CONFLICT (recipe_id, product_variant_id) DO UPDATE
			 SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit,
			     sort_order = EXCLUDED.sort_order, is_primary = EXCLUDED.is_primary, role = EXCLUDED.role`,
			recipeID, req.ProductVariantID, req.Quantity, req.Unit, sortOrder, req.IsPrimary, req.Role,
		)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range reqs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("assigning recipe product: %w", err)
		}
	}
	return nil
}

func (r *recipeRepository) RemoveProducts(ctx context.Context, recipeID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM recipe_products WHERE recipe_id = $1`, recipeID)
	return err
}

func (r *recipeRepository) GetRecipeCardsByProductID(ctx context.Context, productID int64, limit int) ([]*models.Recipe, error) {
	if limit <= 0 {
		limit = 8
	}
	const q = `
		SELECT DISTINCT ` + recipeColumns + `
		FROM recipes r
		WHERE r.status = 'published'
		  AND EXISTS (
			SELECT 1 FROM recipe_products rp
			JOIN product_variants pv ON pv.id = rp.product_variant_id
			WHERE rp.recipe_id = r.id AND pv.product_id = $1
			UNION
			SELECT 1 FROM recipe_ingredients ri
			JOIN product_variants pv2 ON pv2.id = ri.product_variant_id
			WHERE ri.recipe_id = r.id AND pv2.product_id = $1
		  )
		ORDER BY r.view_count DESC, r.published_at DESC NULLS LAST
		LIMIT $2`

	rows, err := r.db.Query(ctx, q, productID, limit)
	if err != nil {
		return nil, fmt.Errorf("querying recipes by product: %w", err)
	}
	defer rows.Close()

	var recipes []*models.Recipe
	for rows.Next() {
		rec := &models.Recipe{}
		if err := rows.Scan(recipeScanDest(rec)...); err != nil {
			return nil, fmt.Errorf("scanning recipe card: %w", err)
		}
		recipes = append(recipes, rec)
	}
	return recipes, rows.Err()
}

// ── Tags ──────────────────────────────────────────────────────────────────────

func (r *recipeRepository) GetTagsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeTagInfo, error) {
	rows, err := r.db.Query(ctx,
		`SELECT t.id, t.title FROM tags t
		 JOIN recipe_tags rt ON rt.tag_id = t.id
		 WHERE rt.recipe_id = $1 ORDER BY t.title ASC`, recipeID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipe tags: %w", err)
	}
	defer rows.Close()

	var tags []*models.RecipeTagInfo
	for rows.Next() {
		t := &models.RecipeTagInfo{}
		if err := rows.Scan(&t.ID, &t.Title); err != nil {
			return nil, fmt.Errorf("scanning recipe tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (r *recipeRepository) GetTagIDsByRecipeID(ctx context.Context, recipeID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx,
		`SELECT tag_id FROM recipe_tags WHERE recipe_id = $1`, recipeID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipe tags: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning tag id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *recipeRepository) AssignTags(ctx context.Context, recipeID int64, tagIDs []int64) error {
	if len(tagIDs) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, tid := range tagIDs {
		batch.Queue(
			`INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
			recipeID, tid,
		)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range tagIDs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("assigning recipe tag: %w", err)
		}
	}
	return nil
}

func (r *recipeRepository) RemoveTags(ctx context.Context, recipeID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM recipe_tags WHERE recipe_id = $1`, recipeID)
	return err
}
