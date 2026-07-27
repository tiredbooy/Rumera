package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type HeroSlideRepository interface {
	// GetActive returns slides that are active and within their scheduling
	// window right now, ordered for display.
	GetActive(ctx context.Context) ([]*models.HeroSlide, error)
	// GetAll returns every slide (admin view), ordered for display.
	GetAll(ctx context.Context) ([]*models.HeroSlide, error)
	GetByID(ctx context.Context, id int64) (*models.HeroSlide, error)
	Create(ctx context.Context, req *models.HeroSlideReq) (*models.HeroSlide, error)
	Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error)
	Reorder(ctx context.Context, ids []int64) error
	Delete(ctx context.Context, id int64) error
}

type heroSlideRepository struct{ db *pgxpool.Pool }

func NewHeroSlideRepository(db *pgxpool.Pool) HeroSlideRepository {
	return &heroSlideRepository{db: db}
}

const heroSlideColumns = `id, eyebrow, title, subtitle, badge,
	image_url, mobile_image_url, image_alt,
	cta_label, cta_href, secondary_cta_label, secondary_cta_href,
	theme, sort_order, is_active, starts_at, ends_at, created_at, updated_at`

func scanHeroSlide(row pgx.Row, s *models.HeroSlide) error {
	return row.Scan(
		&s.ID, &s.Eyebrow, &s.Title, &s.Subtitle, &s.Badge,
		&s.ImageURL, &s.MobileImageURL, &s.ImageAlt,
		&s.CTALabel, &s.CTAHref, &s.SecondaryCTALabel, &s.SecondaryCTAHref,
		&s.Theme, &s.SortOrder, &s.IsActive, &s.StartsAt, &s.EndsAt,
		&s.CreatedAt, &s.UpdatedAt,
	)
}

func (r *heroSlideRepository) queryMany(ctx context.Context, query string, args ...any) ([]*models.HeroSlide, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying hero slides: %w", err)
	}
	defer rows.Close()

	var slides []*models.HeroSlide
	for rows.Next() {
		s := &models.HeroSlide{}
		if err := scanHeroSlide(rows, s); err != nil {
			return nil, fmt.Errorf("scanning hero slide: %w", err)
		}
		slides = append(slides, s)
	}
	return slides, rows.Err()
}

func (r *heroSlideRepository) GetActive(ctx context.Context) ([]*models.HeroSlide, error) {
	query := `SELECT ` + heroSlideColumns + `
			  FROM hero_slides
			  WHERE is_active
			    AND NULLIF(BTRIM(image_url), '') IS NOT NULL
			    AND (starts_at IS NULL OR starts_at <= NOW())
			    AND (ends_at   IS NULL OR ends_at   >= NOW())
			  ORDER BY sort_order ASC, id ASC`
	return r.queryMany(ctx, query)
}

func (r *heroSlideRepository) GetAll(ctx context.Context) ([]*models.HeroSlide, error) {
	query := `SELECT ` + heroSlideColumns + ` FROM hero_slides ORDER BY sort_order ASC, id ASC`
	return r.queryMany(ctx, query)
}

func (r *heroSlideRepository) GetByID(ctx context.Context, id int64) (*models.HeroSlide, error) {
	query := `SELECT ` + heroSlideColumns + ` FROM hero_slides WHERE id = $1`

	s := &models.HeroSlide{}
	if err := scanHeroSlide(r.db.QueryRow(ctx, query, id), s); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("hero slide not found: %d: %w", id, models.ErrNotFound)
		}
		return nil, fmt.Errorf("getting hero slide: %w", err)
	}
	return s, nil
}

func (r *heroSlideRepository) Create(ctx context.Context, req *models.HeroSlideReq) (*models.HeroSlide, error) {
	query := `INSERT INTO hero_slides
			  (eyebrow, title, subtitle, badge, image_url, mobile_image_url, image_alt,
			   cta_label, cta_href, secondary_cta_label, secondary_cta_href,
			   theme, sort_order, is_active, starts_at, ends_at)
			  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
			          COALESCE($12,'dark'), COALESCE($13,0), COALESCE($14,TRUE), $15, $16)
			  RETURNING ` + heroSlideColumns

	s := &models.HeroSlide{}
	if err := scanHeroSlide(r.db.QueryRow(ctx, query,
		req.Eyebrow, req.Title, req.Subtitle, req.Badge,
		req.ImageURL, req.MobileImageURL, req.ImageAlt,
		req.CTALabel, req.CTAHref, req.SecondaryCTALabel, req.SecondaryCTAHref,
		req.Theme, req.SortOrder, req.IsActive, req.StartsAt, req.EndsAt,
	), s); err != nil {
		return nil, fmt.Errorf("creating hero slide: %w", heroSlideConstraintError(err))
	}
	return s, nil
}

func (r *heroSlideRepository) Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error) {
	query := `UPDATE hero_slides SET
			      eyebrow             = CASE WHEN $2::boolean THEN $3::text ELSE eyebrow END,
			      title               = COALESCE($4::text, title),
			      subtitle            = CASE WHEN $5::boolean THEN $6::text ELSE subtitle END,
			      badge               = CASE WHEN $7::boolean THEN $8::text ELSE badge END,
			      image_storage_key   = CASE
			          WHEN $9::boolean AND $10::text IS DISTINCT FROM image_url THEN NULL
			          ELSE image_storage_key
			      END,
			      image_url           = CASE WHEN $9::boolean THEN $10::text ELSE image_url END,
			      mobile_image_storage_key = CASE
			          WHEN $11::boolean AND $12::text IS DISTINCT FROM mobile_image_url THEN NULL
			          ELSE mobile_image_storage_key
			      END,
			      mobile_image_url    = CASE WHEN $11::boolean THEN $12::text ELSE mobile_image_url END,
			      image_alt           = CASE WHEN $13::boolean THEN $14::text ELSE image_alt END,
			      cta_label           = CASE WHEN $15::boolean THEN $16::text ELSE cta_label END,
			      cta_href            = CASE WHEN $17::boolean THEN $18::text ELSE cta_href END,
			      secondary_cta_label = CASE WHEN $19::boolean THEN $20::text ELSE secondary_cta_label END,
			      secondary_cta_href  = CASE WHEN $21::boolean THEN $22::text ELSE secondary_cta_href END,
			      theme               = COALESCE($23::text, theme),
			      sort_order          = COALESCE($24::integer, sort_order),
			      is_active           = COALESCE($25::boolean, is_active),
			      starts_at           = CASE WHEN $26::boolean THEN $27::timestamptz ELSE starts_at END,
			      ends_at             = CASE WHEN $28::boolean THEN $29::timestamptz ELSE ends_at END,
			      updated_at          = NOW()
			  WHERE id = $1
			    AND (NOT $30::boolean OR image_url IS NOT DISTINCT FROM $31::text)
			    AND (NOT $32::boolean OR mobile_image_url IS NOT DISTINCT FROM $33::text)
			  RETURNING ` + heroSlideColumns

	s := &models.HeroSlide{}
	if err := scanHeroSlide(r.db.QueryRow(ctx, query,
		id,
		req.Eyebrow.Set, req.Eyebrow.Value,
		req.Title,
		req.Subtitle.Set, req.Subtitle.Value,
		req.Badge.Set, req.Badge.Value,
		req.ImageURL.Set, req.ImageURL.Value,
		req.MobileImageURL.Set, req.MobileImageURL.Value,
		req.ImageAlt.Set, req.ImageAlt.Value,
		req.CTALabel.Set, req.CTALabel.Value,
		req.CTAHref.Set, req.CTAHref.Value,
		req.SecondaryCTALabel.Set, req.SecondaryCTALabel.Value,
		req.SecondaryCTAHref.Set, req.SecondaryCTAHref.Value,
		req.Theme, req.SortOrder, req.IsActive,
		req.StartsAt.Set, req.StartsAt.Value,
		req.EndsAt.Set, req.EndsAt.Value,
		req.ExpectedImageURL.Set, req.ExpectedImageURL.Value,
		req.ExpectedMobileImageURL.Set, req.ExpectedMobileImageURL.Value,
	), s); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if req.ExpectedImageURL.Set || req.ExpectedMobileImageURL.Set {
				return nil, fmt.Errorf("hero slide media changed concurrently: %w", models.ErrConflict)
			}
			return nil, fmt.Errorf("hero slide not found: %d: %w", id, models.ErrNotFound)
		}
		return nil, fmt.Errorf("updating hero slide: %w", heroSlideConstraintError(err))
	}
	return s, nil
}

func heroSlideConstraintError(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}
	switch pgErr.ConstraintName {
	case "hero_slides_schedule_ordered":
		return fmt.Errorf("%s: %w", pgErr.ConstraintName, models.ErrHeroSchedule)
	case "hero_slides_primary_cta_complete", "hero_slides_primary_cta_safe":
		return fmt.Errorf("%s: %w", pgErr.ConstraintName, models.ErrHeroPrimaryCTA)
	case "hero_slides_secondary_cta_complete", "hero_slides_secondary_cta_safe":
		return fmt.Errorf("%s: %w", pgErr.ConstraintName, models.ErrHeroSecondaryCTA)
	default:
		return err
	}
}

func (r *heroSlideRepository) Reorder(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return models.ErrInvalidState
	}
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return models.ErrInvalidState
		}
		if _, duplicate := seen[id]; duplicate {
			return models.ErrInvalidState
		}
		seen[id] = struct{}{}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("heroSlideRepository.Reorder begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// A table lock prevents inserts or deletes from changing the required
	// permutation between validation and the batch update.
	if _, err := tx.Exec(ctx, `LOCK TABLE hero_slides IN SHARE ROW EXCLUSIVE MODE`); err != nil {
		return fmt.Errorf("heroSlideRepository.Reorder lock: %w", err)
	}
	var matches bool
	if err := tx.QueryRow(ctx, `
		SELECT count(*) = $2
		   AND count(*) = (SELECT count(*) FROM hero_slides)
		FROM hero_slides
		WHERE id = ANY($1::bigint[])`, ids, len(ids)).Scan(&matches); err != nil {
		return fmt.Errorf("heroSlideRepository.Reorder validate: %w", err)
	}
	if !matches {
		return models.ErrInvalidState
	}

	orders := make([]int32, len(ids))
	for i := range ids {
		orders[i] = int32(i)
	}
	tag, err := tx.Exec(ctx, `
		UPDATE hero_slides AS slide
		SET sort_order = ordered.position, updated_at = NOW()
		FROM unnest($1::bigint[], $2::integer[]) AS ordered(id, position)
		WHERE slide.id = ordered.id`, ids, orders)
	if err != nil {
		return fmt.Errorf("heroSlideRepository.Reorder update: %w", err)
	}
	if tag.RowsAffected() != int64(len(ids)) {
		return models.ErrInvalidState
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("heroSlideRepository.Reorder commit: %w", err)
	}
	return nil
}

func (r *heroSlideRepository) Delete(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM hero_slides WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting hero slide: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("hero slide not found: %d: %w", id, models.ErrNotFound)
	}
	return nil
}
