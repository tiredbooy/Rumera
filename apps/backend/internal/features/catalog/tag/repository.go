package tag

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

const tagColumns = `id, title, slug, description, created_at, updated_at`

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

type Repository interface {
	Create(ctx context.Context, req CreateTagReq) (*Tag, error)
	GetByID(ctx context.Context, id int64) (*Tag, error)
	GetAll(ctx context.Context, filter TagFilter) ([]*Tag, int64, error)
	Update(ctx context.Context, id int64, req UpdateTagReq) (*Tag, error)
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

func (r *repository) Create(ctx context.Context, req CreateTagReq) (*Tag, error) {
	const q = `
		INSERT INTO tags (title, slug, description)
		VALUES (@title, @slug, @description)
		RETURNING ` + tagColumns

	args := pgx.NamedArgs{
		"title":       req.Title,
		"slug":        req.Slug,
		"description": req.Description,
	}

	tag, err := scanTag(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.Create scan: %w", err)
	}
	return tag, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *repository) GetByID(ctx context.Context, id int64) (*Tag, error) {
	const q = `SELECT ` + tagColumns + ` FROM tags WHERE id = $1`

	tag, err := scanTag(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("repository.GetByID scan: %w", err)
	}
	return tag, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (paginated + filtered)
// ─────────────────────────────────────────────────────────────

func (r *repository) GetAll(ctx context.Context, f TagFilter) ([]*Tag, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "(title ILIKE @search OR slug ILIKE @search OR description ILIKE @search)")
		args["search"] = "%" + f.Search + "%"
	}

	allowed := map[string]bool{
		"created_at": true,
		"updated_at": true,
		"title":      true,
		"slug":       true,
	}
	sortBy := "created_at"
	if allowed[f.SortBy] {
		sortBy = f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	whereSQL := strings.Join(where, " AND ")
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM tags WHERE %s`, whereSQL)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll count: %w", err)
	}
	if total == 0 || int64(f.Offset()) >= total {
		return []*Tag{}, total, nil
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()
	q := fmt.Sprintf(`
		SELECT %s
		FROM tags
		WHERE %s
		ORDER BY %s %s, id %s
		LIMIT @limit OFFSET @offset`,
		tagColumns, whereSQL, sortBy, order, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll: %w", err)
	}
	defer rows.Close()

	tags := make([]*Tag, 0, f.Limit)

	for rows.Next() {
		tag, err := scanTag(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("repository.GetAll scan: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository.GetAll rows: %w", err)
	}

	return tags, total, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH — only non-nil fields applied)
// ─────────────────────────────────────────────────────────────

func (r *repository) Update(ctx context.Context, id int64, req UpdateTagReq) (*Tag, error) {
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
	if req.Description.Set {
		sets = append(sets, "description = @description")
		args["description"] = req.Description.Value
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE tags SET %s
		WHERE id = @id
		RETURNING %s`,
		strings.Join(sets, ", "),
		tagColumns,
	)

	tag, err := scanTag(r.db.QueryRow(ctx, q, args))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("repository.Update scan: %w", err)
	}
	return tag, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

func (r *repository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM tags WHERE id = $1`

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
	const q = `SELECT EXISTS(SELECT 1 FROM tags WHERE title = $1 AND ($2 = 0 OR id <> $2))`

	var exists bool
	if err := r.db.QueryRow(ctx, q, title, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsByTitle: %w", err)
	}
	return exists, nil
}

func (r *repository) ExistsBySlug(ctx context.Context, slug string, excludeID int64) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM tags WHERE slug = $1 AND ($2 = 0 OR id <> $2))`

	var exists bool
	if err := r.db.QueryRow(ctx, q, slug, excludeID).Scan(&exists); err != nil {
		return false, fmt.Errorf("repository.ExistsBySlug: %w", err)
	}
	return exists, nil
}

type tagScanner interface {
	Scan(dest ...any) error
}

func scanTag(row tagScanner) (*Tag, error) {
	var tag Tag
	if err := row.Scan(
		&tag.ID,
		&tag.Title,
		&tag.Slug,
		&tag.Description,
		&tag.CreatedAt,
		&tag.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &tag, nil
}
