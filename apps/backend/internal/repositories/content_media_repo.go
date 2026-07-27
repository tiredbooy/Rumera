package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// ContentMediaRepository owns the server-controlled URL/key pair for single
// media slots. Callers pass only values from the closed media owner/role grammar;
// every query remains static so path parameters can never become SQL identifiers.
type ContentMediaRepository interface {
	OwnerExists(ctx context.Context, ownerType string, ownerID int64) (bool, error)
	Attach(ctx context.Context, ownerType, role string, ownerID int64, url, key string, alt models.NullablePatch[string]) (*ContentMediaAttachment, error)
}

type ContentMediaAttachment struct {
	DetachedKey *string
	OwnerSlug   string
}

type contentMediaRepository struct{ db *pgxpool.Pool }

func NewContentMediaRepository(db *pgxpool.Pool) ContentMediaRepository {
	return &contentMediaRepository{db: db}
}

func (r *contentMediaRepository) OwnerExists(ctx context.Context, ownerType string, ownerID int64) (bool, error) {
	var query string
	switch ownerType {
	case "hero-slides":
		query = `SELECT EXISTS(SELECT 1 FROM hero_slides WHERE id = $1)`
	case "recipes":
		query = `SELECT EXISTS(SELECT 1 FROM recipes WHERE id = $1)`
	case "journal":
		query = `SELECT EXISTS(SELECT 1 FROM blogs WHERE id = $1 AND deleted_at IS NULL)`
	default:
		return false, fmt.Errorf("content media: unsupported owner %q", ownerType)
	}

	var exists bool
	if err := r.db.QueryRow(ctx, query, ownerID).Scan(&exists); err != nil {
		return false, fmt.Errorf("content media: check %s owner: %w", ownerType, err)
	}
	return exists, nil
}

func (r *contentMediaRepository) Attach(
	ctx context.Context,
	ownerType, role string,
	ownerID int64,
	url, key string,
	alt models.NullablePatch[string],
) (*ContentMediaAttachment, error) {
	var (
		selectQuery string
		updateQuery string
		args        []any
	)
	switch {
	case ownerType == "hero-slides" && role == "desktop":
		selectQuery = `SELECT image_storage_key, '' FROM hero_slides WHERE id = $1 FOR UPDATE`
		updateQuery = `UPDATE hero_slides
			SET image_url = $2, image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	case ownerType == "hero-slides" && role == "mobile":
		selectQuery = `SELECT mobile_image_storage_key, '' FROM hero_slides WHERE id = $1 FOR UPDATE`
		updateQuery = `UPDATE hero_slides
			SET mobile_image_url = $2, mobile_image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	case ownerType == "recipes" && role == "cover":
		selectQuery = `SELECT image_storage_key, slug FROM recipes WHERE id = $1 FOR UPDATE`
		updateQuery = `UPDATE recipes
			SET image_url = $2, image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	case ownerType == "recipes" && role == "og":
		selectQuery = `SELECT og_image_storage_key, slug FROM recipes WHERE id = $1 FOR UPDATE`
		updateQuery = `UPDATE recipes
			SET og_image_url = $2, og_image_storage_key = $3, updated_at = NOW()
			WHERE id = $1`
		args = []any{ownerID, url, key}
	case ownerType == "journal" && role == "cover":
		selectQuery = `SELECT image_storage_key, slug FROM blogs
			WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`
		updateQuery = `UPDATE blogs
			SET image_url = $2, image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1 AND deleted_at IS NULL`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	default:
		return nil, fmt.Errorf("content media: unsupported owner/role %q/%q", ownerType, role)
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("content media: begin attach %s/%s: %w", ownerType, role, err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	attachment := &ContentMediaAttachment{}
	if err := tx.QueryRow(ctx, selectQuery, ownerID).Scan(&attachment.DetachedKey, &attachment.OwnerSlug); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("content media: lock %s/%s owner: %w", ownerType, role, err)
	}
	result, err := tx.Exec(ctx, updateQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("content media: attach %s/%s: %w", ownerType, role, err)
	}
	if result.RowsAffected() == 0 {
		return nil, models.ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("content media: commit %s/%s: %w", ownerType, role, err)
	}
	if attachment.DetachedKey != nil && *attachment.DetachedKey == key {
		attachment.DetachedKey = nil
	}
	return attachment, nil
}
