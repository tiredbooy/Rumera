// internal/repositories/category_repository.go
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

type CategoryRepository interface {
	Create(ctx context.Context, req models.CreateCategoryReq) (*models.Category, error)
	GetByID(ctx context.Context, id int64) (*models.Category, error)
	GetAll(ctx context.Context, filter models.CategoryFilter) ([]*models.Category, int64, error)

	// GetTree fetches the full category hierarchy in one query using
	// a recursive CTE — the service builds the nested structure from it.
	GetTree(ctx context.Context) ([]*models.Category, error)

	// GetChildren fetches only direct children of a given parent.
	GetChildren(ctx context.Context, parentID int64) ([]*models.Category, error)

	Update(ctx context.Context, id int64, req models.UpdateCategoryReq) (*models.Category, error)
	Delete(ctx context.Context, id int64) error
	ExistsByName(ctx context.Context, name string) (bool, error)
	ExistsByID(ctx context.Context, id int64) (bool, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type categoryRepository struct {
	db *pgxpool.Pool
}

func NewCategoryRepository(db *pgxpool.Pool) CategoryRepository {
	return &categoryRepository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) Create(ctx context.Context, req models.CreateCategoryReq) (*models.Category, error) {
	const q = `
		INSERT INTO categories (name, description, parent_id, slug)
		VALUES (@name, @description, @parent_id, @slug)
		RETURNING *`

	args := pgx.NamedArgs{
		"name":        req.Name,
		"description": req.Description,
		"parent_id":   req.ParentID,
		"slug":        req.Slug,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.Create: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Category])
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.Create scan: %w", err)
	}
	return &category, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) GetByID(ctx context.Context, id int64) (*models.Category, error) {
	const q = `SELECT * FROM categories WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.GetByID: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Category])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("categoryRepository.GetByID scan: %w", err)
	}
	return &category, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (flat paginated list — for admin panel)
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) GetAll(ctx context.Context, f models.CategoryFilter) ([]*models.Category, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "name ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}
	if f.ParentID != nil {
		where = append(where, "parent_id = @parent_id")
		args["parent_id"] = *f.ParentID
	}

	allowed := map[string]bool{
		"created_at": true,
		"name":       true,
	}
	sortBy := "created_at"
	if allowed[f.SortBy] {
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT *, COUNT(*) OVER() AS total_count
		FROM categories
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("categoryRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		categories []*models.Category
		total      int64
	)

	for rows.Next() {
		var c models.Category
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Description,
			&c.ParentID, &c.Slug,
			&c.CreatedAt, &c.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("categoryRepository.GetAll scan: %w", err)
		}
		categories = append(categories, &c)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("categoryRepository.GetAll rows: %w", err)
	}

	return categories, total, nil
}

// ─────────────────────────────────────────────────────────────
// GetTree
// Fetches ALL categories ordered so parents always come before
// their children (ORDER BY parent_id NULLS FIRST, id).
// The service layer builds the nested CategoryTree from this
// flat list — O(n) with a map, no recursion needed.
//
// Why not recursive CTE here?
// A recursive CTE builds the tree in SQL but forces you to scan
// into a fixed depth or use array aggregation — both are fragile.
// Fetching flat + building in Go is simpler, faster to read,
// and handles unlimited depth cleanly.
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) GetTree(ctx context.Context) ([]*models.Category, error) {
	const q = `
		SELECT * FROM categories
		ORDER BY parent_id NULLS FIRST, id ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.GetTree: %w", err)
	}
	defer rows.Close()

	categories, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Category])
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.GetTree scan: %w", err)
	}

	result := make([]*models.Category, len(categories))
	for i := range categories {
		result[i] = &categories[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// GetChildren
// Direct children only — useful for lazy-loading a single level
// of the tree in a UI dropdown or breadcrumb.
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) GetChildren(ctx context.Context, parentID int64) ([]*models.Category, error) {
	const q = `
		SELECT * FROM categories
		WHERE parent_id = $1
		ORDER BY name ASC`

	rows, err := r.db.Query(ctx, q, parentID)
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.GetChildren: %w", err)
	}
	defer rows.Close()

	categories, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.Category])
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.GetChildren scan: %w", err)
	}

	result := make([]*models.Category, len(categories))
	for i := range categories {
		result[i] = &categories[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH — only non-nil fields applied)
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) Update(ctx context.Context, id int64, req models.UpdateCategoryReq) (*models.Category, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Name != nil {
		sets = append(sets, "name = @name")
		args["name"] = *req.Name
	}
	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}
	if req.ParentID != nil {
		sets = append(sets, "parent_id = @parent_id")
		args["parent_id"] = *req.ParentID
	}
	if req.Slug != nil {
		sets = append(sets, "slug = @slug")
		args["slug"] = *req.Slug
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE categories SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("categoryRepository.Update: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Category])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("categoryRepository.Update scan: %w", err)
	}
	return &category, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// The service must check for children before calling this —
// deleting a parent with children would orphan them since
// parent_id has no ON DELETE CASCADE.
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM categories WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("categoryRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// ExistsByName
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) ExistsByName(ctx context.Context, name string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM categories WHERE name = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, name).Scan(&exists); err != nil {
		return false, fmt.Errorf("categoryRepository.ExistsByName: %w", err)
	}
	return exists, nil
}

// ─────────────────────────────────────────────────────────────
// ExistsByID
// ─────────────────────────────────────────────────────────────

func (r *categoryRepository) ExistsByID(ctx context.Context, id int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, id).Scan(&exists); err != nil {
		return false, fmt.Errorf("categoryRepository.ExistsByID: %w", err)
	}
	return exists, nil
}
