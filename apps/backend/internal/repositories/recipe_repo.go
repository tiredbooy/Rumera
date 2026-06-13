package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// ── Interfaces ────────────────────────────────────────────────────────────────

type RecipeRepository interface {
	GetByID(ctx context.Context, id int64) (*models.Recipe, error)
	GetBySlug(ctx context.Context, slug string) (*models.Recipe, error)
	GetAll(ctx context.Context) ([]*models.Recipe, error)
	Create(ctx context.Context, req *models.RecipeReq) (*models.Recipe, error)
	Update(ctx context.Context, id int64, req *models.RecipeUpdateReq) (*models.Recipe, error)
	Delete(ctx context.Context, id int64) error

	// ingredients
	GetIngredientsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeIngredient, error)
	CreateIngredient(ctx context.Context, recipeID int64, req *models.RecipeIngredientReq) (*models.RecipeIngredient, error)
	CreateIngredients(ctx context.Context, recipeID int64, reqs []*models.RecipeIngredientReq) ([]*models.RecipeIngredient, error)
	UpdateIngredient(ctx context.Context, id int64, req *models.RecipeIngredientReq) (*models.RecipeIngredient, error)
	DeleteIngredient(ctx context.Context, id int64) error
	DeleteIngredientsByRecipeID(ctx context.Context, recipeID int64) error

	// products
	GetProductsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeProduct, error)
	AssignProducts(ctx context.Context, recipeID int64, reqs []*models.RecipeProductReq) error
	RemoveProducts(ctx context.Context, recipeID int64) error

	// tags
	GetTagIDsByRecipeID(ctx context.Context, recipeID int64) ([]int64, error)
	AssignTags(ctx context.Context, recipeID int64, tagIDs []int64) error
	RemoveTags(ctx context.Context, recipeID int64) error
}

// ── Repository ────────────────────────────────────────────────────────────────

type recipeRepository struct{ db *pgxpool.Pool }

func NewRecipeRepository(db *pgxpool.Pool) RecipeRepository {
	return &recipeRepository{db: db}
}

const recipeColumns = `id, title, slug, description, content, difficulty,
					   prep_time_minutes, cook_time_minutes, servings,
					   image_url, user_id, created_at, updated_at`

func scanRecipe(row pgx.Row, r *models.Recipe) error {
	return row.Scan(
		&r.ID, &r.Title, &r.Slug, &r.Description, &r.Content, &r.Difficulty,
		&r.PrepTimeMinutes, &r.CookTimeMinutes, &r.Servings,
		&r.ImageURL, &r.UserID, &r.CreatedAt, &r.UpdatedAt,
	)
}

// ── Recipe CRUD ───────────────────────────────────────────────────────────────

func (r *recipeRepository) GetByID(ctx context.Context, id int64) (*models.Recipe, error) {
	rec := &models.Recipe{}
	err := scanRecipe(r.db.QueryRow(ctx,
		`SELECT `+recipeColumns+` FROM recipes WHERE id = $1`, id,
	), rec)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("recipe not found: %d", id)
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
			return nil, fmt.Errorf("recipe not found: %s", slug)
		}
		return nil, fmt.Errorf("getting recipe by slug: %w", err)
	}
	return rec, nil
}

func (r *recipeRepository) GetAll(ctx context.Context) ([]*models.Recipe, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+recipeColumns+` FROM recipes ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipes: %w", err)
	}
	defer rows.Close()

	var recipes []*models.Recipe
	for rows.Next() {
		rec := &models.Recipe{}
		if err := rows.Scan(
			&rec.ID, &rec.Title, &rec.Slug, &rec.Description, &rec.Content, &rec.Difficulty,
			&rec.PrepTimeMinutes, &rec.CookTimeMinutes, &rec.Servings,
			&rec.ImageURL, &rec.UserID, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning recipe: %w", err)
		}
		recipes = append(recipes, rec)
	}
	return recipes, rows.Err()
}

func (r *recipeRepository) Create(ctx context.Context, req *models.RecipeReq) (*models.Recipe, error) {
	query := `INSERT INTO recipes
			  (title, slug, description, content, difficulty, prep_time_minutes, cook_time_minutes, servings, image_url, user_id)
			  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			  RETURNING ` + recipeColumns

	rec := &models.Recipe{}
	if err := scanRecipe(r.db.QueryRow(ctx, query,
		req.Title, req.Slug, req.Description, req.Content, req.Difficulty,
		req.PrepTimeMinutes, req.CookTimeMinutes, req.Servings,
		req.ImageURL, req.UserID,
	), rec); err != nil {
		return nil, fmt.Errorf("creating recipe: %w", err)
	}
	return rec, nil
}

func (r *recipeRepository) Update(ctx context.Context, id int64, req *models.RecipeUpdateReq) (*models.Recipe, error) {
	query := `UPDATE recipes
			  SET title            = COALESCE($2, title),
			      slug             = COALESCE($3, slug),
			      description      = COALESCE($4, description),
			      content          = COALESCE($5, content),
			      difficulty       = COALESCE($6, difficulty),
			      prep_time_minutes= COALESCE($7, prep_time_minutes),
			      cook_time_minutes= COALESCE($8, cook_time_minutes),
			      servings         = COALESCE($9, servings),
			      image_url        = COALESCE($10, image_url),
			      updated_at       = NOW()
			  WHERE id = $1
			  RETURNING ` + recipeColumns

	rec := &models.Recipe{}
	if err := scanRecipe(r.db.QueryRow(ctx, query,
		id, req.Title, req.Slug, req.Description, req.Content, req.Difficulty,
		req.PrepTimeMinutes, req.CookTimeMinutes, req.Servings, req.ImageURL,
	), rec); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("recipe not found: %d", id)
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
		return fmt.Errorf("recipe not found: %d", id)
	}
	return nil
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
		`SELECT `+ingredientColumns+` FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY sort_order ASC`,
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
			return nil, fmt.Errorf("recipe ingredient not found: %d", id)
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
		return fmt.Errorf("recipe ingredient not found: %d", id)
	}
	return nil
}

func (r *recipeRepository) DeleteIngredientsByRecipeID(ctx context.Context, recipeID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM recipe_ingredients WHERE recipe_id = $1`, recipeID)
	return err
}

// ── Products ──────────────────────────────────────────────────────────────────

func (r *recipeRepository) GetProductsByRecipeID(ctx context.Context, recipeID int64) ([]*models.RecipeProduct, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, recipe_id, product_variant_id, quantity, unit FROM recipe_products WHERE recipe_id = $1`,
		recipeID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying recipe products: %w", err)
	}
	defer rows.Close()

	var products []*models.RecipeProduct
	for rows.Next() {
		p := &models.RecipeProduct{}
		if err := rows.Scan(&p.ID, &p.RecipeID, &p.ProductVariantID, &p.Quantity, &p.Unit); err != nil {
			return nil, fmt.Errorf("scanning recipe product: %w", err)
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
	for _, req := range reqs {
		batch.Queue(
			`INSERT INTO recipe_products (recipe_id, product_variant_id, quantity, unit)
			 VALUES ($1,$2,$3,$4)
			 ON CONFLICT (recipe_id, product_variant_id) DO UPDATE
			 SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit`,
			recipeID, req.ProductVariantID, req.Quantity, req.Unit,
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

// ── Tags ──────────────────────────────────────────────────────────────────────

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
