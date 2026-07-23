package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
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
		return nil, fmt.Errorf("creating hero slide: %w", err)
	}
	return s, nil
}

func (r *heroSlideRepository) Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error) {
	query := `UPDATE hero_slides SET
			      eyebrow             = COALESCE($2, eyebrow),
			      title               = COALESCE($3, title),
			      subtitle            = COALESCE($4, subtitle),
			      badge               = COALESCE($5, badge),
			      image_storage_key   = CASE
			          WHEN $6::boolean AND $7::text IS DISTINCT FROM image_url THEN NULL
			          ELSE image_storage_key
			      END,
			      image_url           = CASE WHEN $6::boolean THEN $7::text ELSE image_url END,
			      mobile_image_storage_key = CASE
			          WHEN $8::boolean AND $9::text IS DISTINCT FROM mobile_image_url THEN NULL
			          ELSE mobile_image_storage_key
			      END,
			      mobile_image_url    = CASE WHEN $8::boolean THEN $9::text ELSE mobile_image_url END,
			      image_alt           = CASE WHEN $10::boolean THEN $11::text ELSE image_alt END,
			      cta_label           = COALESCE($12, cta_label),
			      cta_href            = COALESCE($13, cta_href),
			      secondary_cta_label = COALESCE($14, secondary_cta_label),
			      secondary_cta_href  = COALESCE($15, secondary_cta_href),
			      theme               = COALESCE($16, theme),
			      sort_order          = COALESCE($17, sort_order),
			      is_active           = COALESCE($18, is_active),
			      starts_at           = COALESCE($19, starts_at),
			      ends_at             = COALESCE($20, ends_at),
			      updated_at          = NOW()
			  WHERE id = $1
			    AND (NOT $21::boolean OR image_url IS NOT DISTINCT FROM $22::text)
			    AND (NOT $23::boolean OR mobile_image_url IS NOT DISTINCT FROM $24::text)
			  RETURNING ` + heroSlideColumns

	s := &models.HeroSlide{}
	if err := scanHeroSlide(r.db.QueryRow(ctx, query,
		id, req.Eyebrow, req.Title, req.Subtitle, req.Badge,
		req.ImageURL.Set, req.ImageURL.Value,
		req.MobileImageURL.Set, req.MobileImageURL.Value,
		req.ImageAlt.Set, req.ImageAlt.Value,
		req.CTALabel, req.CTAHref, req.SecondaryCTALabel, req.SecondaryCTAHref,
		req.Theme, req.SortOrder, req.IsActive, req.StartsAt, req.EndsAt,
		req.ExpectedImageURL.Set, req.ExpectedImageURL.Value,
		req.ExpectedMobileImageURL.Set, req.ExpectedMobileImageURL.Value,
	), s); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if req.ExpectedImageURL.Set || req.ExpectedMobileImageURL.Set {
				return nil, fmt.Errorf("hero slide media changed concurrently: %w", models.ErrConflict)
			}
			return nil, fmt.Errorf("hero slide not found: %d: %w", id, models.ErrNotFound)
		}
		return nil, fmt.Errorf("updating hero slide: %w", err)
	}
	return s, nil
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
