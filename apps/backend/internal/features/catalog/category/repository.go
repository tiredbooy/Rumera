package category

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

type Repository interface {
	Create(ctx context.Context, req CreateCategoryReq) (*Category, error)
	GetByID(ctx context.Context, id int64) (*Category, error)
	GetBySlug(ctx context.Context, slug string) (*Category, error)
	GetAll(ctx context.Context, filter CategoryFilter) ([]*Category, int64, error)

	// GetTree fetches the full category hierarchy in one query using
	// a recursive CTE — the service builds the nested structure from it.
	GetTree(ctx context.Context) ([]*Category, error)

	// GetChildren fetches only direct children of a given parent.
	GetChildren(ctx context.Context, parentID int64) ([]*Category, error)

	// GetFeatured fetches categories flagged for homepage display,
	// ordered for direct rendering into the big-card/small-card layout.
	GetFeatured(ctx context.Context) ([]*Category, error)

	Update(ctx context.Context, id int64, req UpdateCategoryReq) (*Category, error)
	Delete(ctx context.Context, id int64) error
	ExistsByName(ctx context.Context, name string, excludeID int64) (bool, error)
	ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error)
	ExistsByID(ctx context.Context, id int64) (bool, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type repository struct {
	db *pgxpool.Pool
}

const categoryHierarchyLockKey int64 = 0x43415445474f5259

func NewRepository(db *pgxpool.Pool) Repository {
	return &repository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

func (r *repository) Create(ctx context.Context, req CreateCategoryReq) (*Category, error) {
	const q = `
		INSERT INTO categories (title, description, parent_id, slug, image_url, is_featured, card_size, display_order)
		VALUES (@title, @description, @parent_id, @slug, @image_url, @is_featured, @card_size, @display_order)
		RETURNING *`

	// Defaults mirror the table's own DEFAULTs so a request that omits these
	// fields still inserts a valid row instead of NULL-ing a NOT NULL column.
	isFeatured := false
	if req.IsFeatured != nil {
		isFeatured = *req.IsFeatured
	}
	cardSize := "small"
	if req.CardSize != nil {
		cardSize = *req.CardSize
	}
	var displayOrder int16
	if req.DisplayOrder != nil {
		displayOrder = *req.DisplayOrder
	}

	args := pgx.NamedArgs{
		"title":         req.Title,
		"description":   req.Description,
		"parent_id":     req.ParentID,
		"slug":          req.Slug,
		"image_url":     req.ImageURL,
		"is_featured":   isFeatured,
		"card_size":     cardSize,
		"display_order": displayOrder,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrAlreadyExists
		}
		return nil, fmt.Errorf("repository.Create: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Category])
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrAlreadyExists
		}
		return nil, fmt.Errorf("repository.Create scan: %w", err)
	}
	return &category, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *repository) GetByID(ctx context.Context, id int64) (*Category, error) {
	const q = `SELECT * FROM categories WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Category])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return &category, nil
}

// GetBySlug resolves the public category identity with an exact slug match.
func (r *repository) GetBySlug(ctx context.Context, slug string) (*Category, error) {
	const q = `SELECT * FROM categories WHERE slug = $1`

	rows, err := r.db.Query(ctx, q, slug)
	if err != nil {
		return nil, fmt.Errorf("repository.GetBySlug: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Category])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetBySlug scan: %w", err)
	}
	return &category, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (flat paginated list — for admin panel)
// ─────────────────────────────────────────────────────────────

func (r *repository) GetAll(ctx context.Context, f CategoryFilter) ([]*Category, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "title ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}
	if f.ParentID != nil {
		where = append(where, "parent_id = @parent_id")
		args["parent_id"] = *f.ParentID
	}
	if f.IsFeatured != nil {
		where = append(where, "is_featured = @is_featured")
		args["is_featured"] = *f.IsFeatured
	}

	allowed := map[string]bool{
		"created_at":    true,
		"title":         true,
		"display_order": true,
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
		ORDER BY %s %s, id %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		categories []*Category
		total      int64
	)

	for rows.Next() {
		var c Category
		if err := rows.Scan(
			&c.ID, &c.Title, &c.Description,
			&c.ParentID, &c.Slug,
			&c.ImageURL, &c.IsFeatured, &c.CardSize, &c.DisplayOrder,
			&c.CreatedAt, &c.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository.GetAll scan: %w", err)
		}
		categories = append(categories, &c)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll rows: %w", err)
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

func (r *repository) GetTree(ctx context.Context) ([]*Category, error) {
	const q = `
		SELECT * FROM categories
		ORDER BY parent_id NULLS FIRST, id ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("repository.GetTree: %w", err)
	}
	defer rows.Close()

	categories, err := pgx.CollectRows(rows, pgx.RowToStructByName[Category])
	if err != nil {
		return nil, fmt.Errorf("repository.GetTree scan: %w", err)
	}

	result := make([]*Category, len(categories))
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

func (r *repository) GetChildren(ctx context.Context, parentID int64) ([]*Category, error) {
	const q = `
		SELECT * FROM categories
		WHERE parent_id = $1
		ORDER BY title ASC`

	rows, err := r.db.Query(ctx, q, parentID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetChildren: %w", err)
	}
	defer rows.Close()

	categories, err := pgx.CollectRows(rows, pgx.RowToStructByName[Category])
	if err != nil {
		return nil, fmt.Errorf("repository.GetChildren scan: %w", err)
	}

	result := make([]*Category, len(categories))
	for i := range categories {
		result[i] = &categories[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// GetFeatured
// Categories flagged for the homepage, ordered so the caller can
// render directly into the big-card/small-card grid without any
// extra sorting in the service layer.
// ─────────────────────────────────────────────────────────────

func (r *repository) GetFeatured(ctx context.Context) ([]*Category, error) {
	const q = `
		SELECT * FROM categories
		WHERE is_featured = TRUE
		ORDER BY display_order ASC, id ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("repository.GetFeatured: %w", err)
	}
	defer rows.Close()

	categories, err := pgx.CollectRows(rows, pgx.RowToStructByName[Category])
	if err != nil {
		return nil, fmt.Errorf("repository.GetFeatured scan: %w", err)
	}

	result := make([]*Category, len(categories))
	for i := range categories {
		result[i] = &categories[i]
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH — only non-nil fields applied)
// ─────────────────────────────────────────────────────────────

func (r *repository) Update(ctx context.Context, id int64, req UpdateCategoryReq) (*Category, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.Description.Set {
		sets = append(sets, "description = @description")
		args["description"] = req.Description.Value
	}
	if req.ParentID.Set {
		sets = append(sets, "parent_id = @parent_id")
		args["parent_id"] = req.ParentID.Value
	}
	if req.Slug.Set {
		sets = append(sets, "slug = @slug")
		args["slug"] = req.Slug.Value
	}
	if req.ImageURL.Set {
		sets = append(sets, "image_url = @image_url")
		args["image_url"] = req.ImageURL.Value
	}
	if req.IsFeatured != nil {
		sets = append(sets, "is_featured = @is_featured")
		args["is_featured"] = *req.IsFeatured
	}
	if req.CardSize != nil {
		sets = append(sets, "card_size = @card_size")
		args["card_size"] = *req.CardSize
	}
	if req.DisplayOrder != nil {
		sets = append(sets, "display_order = @display_order")
		args["display_order"] = *req.DisplayOrder
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	query := r.db.Query
	var tx pgx.Tx
	if req.ParentID.Set {
		var err error
		tx, err = r.db.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("repository.Update begin: %w", err)
		}
		defer func() { _ = tx.Rollback(ctx) }()

		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, categoryHierarchyLockKey); err != nil {
			return nil, fmt.Errorf("repository.Update lock hierarchy: %w", err)
		}
		if req.ParentID.Value != nil {
			const cycleQuery = `
				WITH RECURSIVE descendants(id) AS (
					SELECT id FROM categories WHERE id = $1
					UNION
					SELECT child.id
					FROM categories child
					INNER JOIN descendants parent ON child.parent_id = parent.id
				)
				SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2)`
			var createsCycle bool
			if err := tx.QueryRow(ctx, cycleQuery, id, *req.ParentID.Value).Scan(&createsCycle); err != nil {
				return nil, fmt.Errorf("repository.Update inspect hierarchy: %w", err)
			}
			if createsCycle {
				return nil, models.ErrInvalidState
			}
		}
		query = tx.Query
	}

	q := fmt.Sprintf(`
		UPDATE categories SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := query(ctx, q, args)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrAlreadyExists
		}
		return nil, fmt.Errorf("repository.Update: %w", err)
	}

	category, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Category])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, models.ErrAlreadyExists
		}
		return nil, fmt.Errorf("repository.Update scan: %w", err)
	}
	if tx != nil {
		if err := tx.Commit(ctx); err != nil {
			if isUniqueViolation(err) {
				return nil, models.ErrAlreadyExists
			}
			return nil, fmt.Errorf("repository.Update commit: %w", err)
		}
	}
	return &category, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// The service must check for children before calling this —
// deleting a parent with children would orphan them since
// parent_id has no ON DELETE CASCADE.
// ─────────────────────────────────────────────────────────────

func (r *repository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM categories WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("repository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// ExistsByName
// ─────────────────────────────────────────────────────────────

func (r *repository) ExistsByName(ctx context.Context, name string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM categories WHERE title = $1 AND ($2 = 0 OR id <> $2))`

	var exists bool
	if err := r.db.QueryRow(ctx, q, name, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByName: %w", err)
	}
	return exists, nil
}

func (r *repository) ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM categories WHERE slug = $1 AND ($2 = 0 OR id <> $2))`

	var exists bool
	if err := r.db.QueryRow(ctx, q, slug, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsBySlug: %w", err)
	}
	return exists, nil
}

// ─────────────────────────────────────────────────────────────
// ExistsByID
// ─────────────────────────────────────────────────────────────

func (r *repository) ExistsByID(ctx context.Context, id int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, id).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByID: %w", err)
	}
	return exists, nil
}
