package reviews

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ImageRepository interface {
	GetImagesByReviewID(ctx context.Context, reviewID int64) ([]*ReviewImage, error)
	CreateReviewImage(ctx context.Context, req *ReviewImageReq) (*ReviewImage, error)
	CreateReviewImages(ctx context.Context, reqs []*ReviewImageReq) ([]*ReviewImage, error)
	UpdateReviewImageMeta(ctx context.Context, id int64, altTxt *string, sortOrder *int) (*ReviewImage, error) // metadata only
	DeleteReviewImage(ctx context.Context, id int64) error
	DeleteImagesByReviewID(ctx context.Context, reviewID int64) error
}

type imageRepository struct {
	db *pgxpool.Pool
}

func NewImageRepository(db *pgxpool.Pool) ImageRepository {
	return &imageRepository{db: db}
}

func (r *imageRepository) Create(ctx context.Context, req ReviewImageReq) (int64, error) {
	query := `INSERT INTO review_images
			(review_id, image_url, alt_text, sort_order)	
			VALUES (@review_id, @image_url, @alt_text, @sort_order)
			RETURNING id
	`
	args := pgx.NamedArgs{
		"review_id":  req.ReviewID,
		"image_url":  req.ImageURL,
		"alt_text":   req.AltTxt,
		"sort_order": req.SortOrder,
	}

	var id int64

	err := r.db.QueryRow(ctx, query, args).Scan(&id)
	if err != nil {
		return 0, err
	}

	return id, nil
}

func (r *imageRepository) CreateReviewImage(ctx context.Context, req *ReviewImageReq) (*ReviewImage, error) {
	query := `INSERT INTO review_images (review_id, image_url, alt_text, sort_order)
			  VALUES ($1, $2, $3, COALESCE($4, 0))
			  RETURNING id, review_id, image_url, alt_text, sort_order, created_at, updated_at`

	img := &ReviewImage{}
	err := r.db.QueryRow(ctx, query,
		req.ReviewID,
		req.ImageURL,
		req.AltTxt,
		req.SortOrder,
	).Scan(
		&img.ID,
		&img.ReviewID,
		&img.ImageURL,
		&img.AltTxt,
		&img.SortOrder,
		&img.CreatedAt,
		&img.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating review image: %w", err)
	}

	return img, nil
}

func (r *imageRepository) CreateReviewImages(ctx context.Context, reqs []*ReviewImageReq) ([]*ReviewImage, error) {
	if len(reqs) == 0 {
		return nil, nil
	}

	batch := &pgx.Batch{}
	query := `INSERT INTO review_images (review_id, image_url, alt_text, sort_order)
			  VALUES ($1, $2, $3, COALESCE($4, 0))
			  RETURNING id, review_id, image_url, alt_text, sort_order, created_at, updated_at`

	for _, req := range reqs {
		batch.Queue(query, req.ReviewID, req.ImageURL, req.AltTxt, req.SortOrder)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	images := make([]*ReviewImage, 0, len(reqs))
	for range reqs {
		img := &ReviewImage{}
		if err := br.QueryRow().Scan(
			&img.ID,
			&img.ReviewID,
			&img.ImageURL,
			&img.AltTxt,
			&img.SortOrder,
			&img.CreatedAt,
			&img.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning batch review image: %w", err)
		}
		images = append(images, img)
	}

	return images, nil
}

func (r *imageRepository) GetImagesByReviewID(ctx context.Context, reviewID int64) ([]*ReviewImage, error) {
	query := `SELECT id, review_id, image_url, alt_text, sort_order, created_at, updated_at 
			  FROM review_images WHERE review_id = $1 ORDER BY sort_order ASC`

	rows, err := r.db.Query(ctx, query, reviewID)
	if err != nil {
		return nil, fmt.Errorf("querying review images: %w", err)
	}
	defer rows.Close()

	images := make([]*ReviewImage, 0, 8)
	for rows.Next() {
		img := &ReviewImage{}
		if err := rows.Scan(
			&img.ID,
			&img.ReviewID,
			&img.ImageURL,
			&img.AltTxt,
			&img.SortOrder,
			&img.CreatedAt,
			&img.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning review image: %w", err)
		}
		images = append(images, img)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating review images: %w", err)
	}

	return images, nil
}

func (r *imageRepository) GetSingleImage(ctx context.Context, imageID int64) (*ReviewImage, error) {
	query := `SELECT id, review_id, image_url, alt_text, sort_order, created_at, updated_at FROM review_images WHERE id = $1`

	var img *ReviewImage

	err := r.db.QueryRow(ctx, query, imageID).Scan(&img.ID, &img.ReviewID, &img.ImageURL, &img.AltTxt, &img.SortOrder, &img.CreatedAt, &img.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("Failed to Scan Image With ID(%d): Cause: %w", imageID, err)
	}

	return img, nil
}

func (r *imageRepository) UpdateReviewImageMeta(ctx context.Context, id int64, altTxt *string, sortOrder *int) (*ReviewImage, error) {
	query := `UPDATE review_images 
			  SET alt_text = COALESCE($2, alt_text), 
			      sort_order = COALESCE($3, sort_order),
			      updated_at = NOW()
			  WHERE id = $1
			  RETURNING id, review_id, image_url, alt_text, sort_order, created_at, updated_at`

	img := &ReviewImage{}
	err := r.db.QueryRow(ctx, query, id, altTxt, sortOrder).Scan(
		&img.ID,
		&img.ReviewID,
		&img.ImageURL,
		&img.AltTxt,
		&img.SortOrder,
		&img.CreatedAt,
		&img.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("review image not found: %d", id)
		}
		return nil, fmt.Errorf("updating review image meta: %w", err)
	}

	return img, nil
}

func (r *imageRepository) DeleteReviewImage(ctx context.Context, id int64) error {
	query := `DELETE FROM review_images WHERE id = $1`

	ct, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("deleting review image: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("review image not found: %d", id)
	}

	return nil
}

func (r *imageRepository) DeleteImagesByReviewID(ctx context.Context, reviewID int64) error {
	query := `DELETE FROM review_images WHERE review_id = $1`

	_, err := r.db.Exec(ctx, query, reviewID)
	if err != nil {
		return fmt.Errorf("deleting review images by review_id: %w", err)
	}

	return nil
}
