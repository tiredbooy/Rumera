// internal/repositories/tag_repository.go
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

type TagRepository interface {
	Create(ctx context.Context, req models.CreateTagReq) (*models.Tag, error)
	GetByID(ctx context.Context, id int64) (*models.Tag, error)
	GetAll(ctx context.Context, filter models.TagFilter) ([]*models.Tag, int64, error)
	Update(ctx context.Context, id int64, req models.UpdateTagReq) (*models.Tag, error)
	Delete(ctx context.Context, id int64) error
	ExistsByTitle(ctx context.Context, title string) (bool, error)
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type tagRepository struct {
	db *pgxpool.Pool
}

func NewTagRepository(db *pgxpool.Pool) TagRepository {
	return &tagRepository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

func (r *tagRepository) Create(ctx context.Context, req models.CreateTagReq) (*models.Tag, error) {
	const q = `
		INSERT INTO tags (title, description)
		VALUES (@title, @description)
		RETURNING *`

	args := pgx.NamedArgs{
		"title":       req.Title,
		"description": req.Description,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("tagRepository.Create: %w", err)
	}

	tag, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Tag])
	if err != nil {
		return nil, fmt.Errorf("tagRepository.Create scan: %w", err)
	}
	return &tag, nil
}

// ─────────────────────────────────────────────────────────────
// GetByID
// ─────────────────────────────────────────────────────────────

func (r *tagRepository) GetByID(ctx context.Context, id int64) (*models.Tag, error) {
	const q = `SELECT * FROM tags WHERE id = $1`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("tagRepository.GetByID: %w", err)
	}

	tag, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Tag])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("tagRepository.GetByID scan: %w", err)
	}
	return &tag, nil
}

// ─────────────────────────────────────────────────────────────
// GetAll  (paginated + filtered)
// ─────────────────────────────────────────────────────────────

func (r *tagRepository) GetAll(ctx context.Context, f models.TagFilter) ([]*models.Tag, int64, error) {
	where := []string{"1=1"}
	args := pgx.NamedArgs{}

	if f.Search != "" {
		where = append(where, "title ILIKE @search")
		args["search"] = "%" + f.Search + "%"
	}

	allowed := map[string]bool{
		"created_at": true,
		"title":      true,
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
		FROM tags
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("tagRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		tags  []*models.Tag
		total int64
	)

	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(
			&t.ID, &t.Title, &t.Description,
			&t.CreatedAt, &t.UpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("tagRepository.GetAll scan: %w", err)
		}
		tags = append(tags, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("tagRepository.GetAll rows: %w", err)
	}

	return tags, total, nil
}

// ─────────────────────────────────────────────────────────────
// Update  (PATCH — only non-nil fields applied)
// ─────────────────────────────────────────────────────────────

func (r *tagRepository) Update(ctx context.Context, id int64, req models.UpdateTagReq) (*models.Tag, error) {
	sets := []string{}
	args := pgx.NamedArgs{"id": id}

	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.Description != nil {
		sets = append(sets, "description = @description")
		args["description"] = *req.Description
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	q := fmt.Sprintf(`
		UPDATE tags SET %s
		WHERE id = @id
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("tagRepository.Update: %w", err)
	}

	tag, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Tag])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("tagRepository.Update scan: %w", err)
	}
	return &tag, nil
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

func (r *tagRepository) Delete(ctx context.Context, id int64) error {
	const q = `DELETE FROM tags WHERE id = $1`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("tagRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// ExistsByTitle
// ─────────────────────────────────────────────────────────────

func (r *tagRepository) ExistsByTitle(ctx context.Context, title string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM tags WHERE title = $1)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, title).Scan(&exists); err != nil {
		return false, fmt.Errorf("tagRepository.ExistsByTitle: %w", err)
	}
	return exists, nil
}
