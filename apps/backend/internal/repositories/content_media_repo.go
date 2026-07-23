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
	Attach(ctx context.Context, ownerType, role string, ownerID int64, url, key string, alt models.NullablePatch[string]) error
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
) error {
	var (
		query string
		args  []any
	)
	switch {
	case ownerType == "hero-slides" && role == "desktop":
		query = `UPDATE hero_slides
			SET image_url = $2, image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1 RETURNING id`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	case ownerType == "hero-slides" && role == "mobile":
		query = `UPDATE hero_slides
			SET mobile_image_url = $2, mobile_image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1 RETURNING id`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	case ownerType == "recipes" && role == "cover":
		query = `UPDATE recipes
			SET image_url = $2, image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1 RETURNING id`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	case ownerType == "recipes" && role == "og":
		query = `UPDATE recipes
			SET og_image_url = $2, og_image_storage_key = $3, updated_at = NOW()
			WHERE id = $1 RETURNING id`
		args = []any{ownerID, url, key}
	case ownerType == "journal" && role == "cover":
		query = `UPDATE blogs
			SET image_url = $2, image_storage_key = $3,
			    image_alt = CASE WHEN $4 THEN $5::text ELSE image_alt END,
			    updated_at = NOW()
			WHERE id = $1 AND deleted_at IS NULL RETURNING id`
		args = []any{ownerID, url, key, alt.Set, alt.Value}
	default:
		return fmt.Errorf("content media: unsupported owner/role %q/%q", ownerType, role)
	}

	var attachedID int64
	if err := r.db.QueryRow(ctx, query, args...).Scan(&attachedID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.ErrNotFound
		}
		return fmt.Errorf("content media: attach %s/%s: %w", ownerType, role, err)
	}
	return nil
}
