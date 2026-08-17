package brand

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
	Create(ctx context.Context, req CreateBrandReq) (*Brand, error)
	GetByID(ctx context.Context, id int64) (*Brand, error)
	GetBySlug(ctx context.Context, slug string) (*Brand, error)
	GetAll(ctx context.Context, filter BrandFilter) ([]*Brand, int64, error)
	Update(ctx context.Context, id int64, req UpdateBrandReq) (*Brand, error)
	Delete(ctx context.Context, id int64) error
	ExistsByTitle(ctx context.Context, title string, excludeID int64) (bool, error)
	ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error)
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
// ─────────────────────────────────────────────────────────────

func (r *repository) Create(ctx context.Context, req CreateBrandReq) (*Brand, error) {
	const q = `
		INSERT INTO brands (title, slug, country, founded_year, image_url, description)
		VALUES (@title, @slug, @country, @founded_year, @image_url, @description)
		RETURNING id, title, slug, country, founded_year, image_url, description,
		          created_at, updated_at`

	args := pgx.NamedArgs{
		"title":        req.Title,
		"slug":         req.Slug,
		"country":      req.Country,
		"founded_year": req.FoundedYear,
		"image_url":    req.ImageURL,
		"description":  req.Description,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("repository.Create: %w", err)
	}

	brand, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Brand])
	if err != nil {
		return nil, fmt.Errorf("repository.Create scan: %w", err)
	}
	return &brand, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *repository) GetByID(ctx context.Context, id int64) (*Brand, error) {
	const q = `
		SELECT id, title, slug, country, founded_year, image_url, description,
		       created_at, updated_at
		FROM brands WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}

	brand, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Brand])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return &brand, nil
}

func (r *repository) GetBySlug(ctx context.Context, slug string) (*Brand, error) {
	const q = `
		SELECT id, title, slug, country, founded_year, image_url, description,
		       created_at, updated_at
		FROM brands WHERE slug = $1`

	rows, err := r.db.Query(ctx, q, slug)
	if err != nil {
		return nil, fmt.Errorf("repository.GetBySlug: %w", err)
	}
	brand, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Brand])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetBySlug scan: %w", err)
	}
	return &brand, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (paginated + filtered)
// ─────────────────────────────────────────────────────────────

func (r *repository) GetAll(ctx context.Context, f BrandFilter) ([]*Brand, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "title ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}
	if f.Country != nil {
		where = append(where, "country = @country")
		args["country"] = *f.Country
	}
	if f.FoundedFrom != nil {
		where = append(where, "founded_year >= @founded_from")
		args["founded_from"] = *f.FoundedFrom
	}
	if f.FoundedTo != nil {
		where = append(where, "founded_year <= @founded_to")
		args["founded_to"] = *f.FoundedTo
	}

	allowed := map[string]bool{
		"created_at":   true,
		"title":        true,
		"founded_year": true,
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
		SELECT id, title, slug, country, founded_year, image_url, description,
		       created_at, updated_at, COUNT(*) OVER() AS total_count
		FROM brands
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		brands []*Brand
		total  int64
	)

	for rows.Next() {
		var b Brand
		if err := rows.Scan(
			&b.ID, &b.Title, &b.Slug, &b.Country,
			&b.FoundedYear, &b.ImageURL, &b.Description,
			&b.CreatedAt, &b.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository.GetAll scan: %w", err)
		}
		brands = append(brands, &b)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll rows: %w", err)
	}

	return brands, total, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH — only non-nil fields applied)
// ─────────────────────────────────────────────────────────────

func (r *repository) Update(ctx context.Context, id int64, req UpdateBrandReq) (*Brand, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.Slug != nil {
		sets = append(sets, "slug = @slug")
		args["slug"] = *req.Slug
	}
	if req.Country != nil {
		sets = append(sets, "country = @country")
		args["country"] = *req.Country
	}
	if req.FoundedYear != nil {
		sets = append(sets, "founded_year = @founded_year")
		args["founded_year"] = *req.FoundedYear
	}
	if req.ImageURL != nil {
		sets = append(sets, "image_url = @image_url")
		args["image_url"] = *req.ImageURL
	}
	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE brands SET %s
		WHERE id = @id
		RETURNING id, title, slug, country, founded_year, image_url, description,
		          created_at, updated_at`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("repository.Update: %w", err)
	}

	brand, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Brand])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.Update scan: %w", err)
	}
	return &brand, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

func (r *repository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM brands WHERE id = $1`

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
// Existence checks exclude the row being edited so unchanged unique values are valid.
// ─────────────────────────────────────────────────────────────

func (r *repository) ExistsByTitle(ctx context.Context, title string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM brands WHERE title = $1 AND ($2 = 0 OR id <> $2))`

	var exists bool
	if err := r.db.QueryRow(ctx, q, title, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByTitle: %w", err)
	}
	return exists, nil
}

func (r *repository) ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM brands WHERE slug = $1 AND id <> $2)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, slug, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsBySlug: %w", err)
	}
	return exists, nil
}
