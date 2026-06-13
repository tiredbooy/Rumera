// internal/repositories/review_repository.go
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

type ReviewRepository interface {
	Create(ctx context.Context, userID int64, req models.CreateReviewReq, verifiedPurchase bool) (*models.Review, error)
	GetByID(ctx context.Context, id int64) (*models.Review, error)
	GetAll(ctx context.Context, filter models.ReviewFilter) ([]*models.Review, int64, error)
	Update(ctx context.Context, id int64, userID int64, req models.UpdateReviewReq) (*models.Review, error)
	UpdateStatus(ctx context.Context, id int64, req models.UpdateReviewStatusReq) (*models.Review, error)
	Delete(ctx context.Context, id int64, userID int64) error
	GetRatingSummary(ctx context.Context, productID int64) (*models.ProductRatingSummary, error)
	React(ctx context.Context, id int64, like bool) error
	HasReviewed(ctx context.Context, userID int64, productID int64) (bool, error)
}

type reviewRepository struct {
	db *pgxpool.Pool
}

func NewReviewRepository(db *pgxpool.Pool) ReviewRepository {
	return &reviewRepository{db: db}
}

func (r *reviewRepository) Create(ctx context.Context, userID int64, req models.CreateReviewReq, verifiedPurchase bool) (*models.Review, error) {
	const q = `
		INSERT INTO reviews (title, content, rating, user_id, product_id, verified_purchase)
		VALUES (@title, @content, @rating, @user_id, @product_id, @verified_purchase)
		RETURNING *`

	args := pgx.NamedArgs{
		"title":             req.Title,
		"content":           req.Content,
		"rating":            req.Rating,
		"user_id":           userID,
		"product_id":        req.ProductID,
		"verified_purchase": verifiedPurchase,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.Create: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Review])
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.Create scan: %w", err)
	}
	return &review, nil
}

func (r *reviewRepository) GetByID(ctx context.Context, id int64) (*models.Review, error) {
	const q = `SELECT * FROM reviews WHERE id = $1 AND deleted_at IS NULL`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.GetByID: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Review])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("reviewRepository.GetByID scan: %w", err)
	}
	return &review, nil
}

func (r *reviewRepository) GetAll(ctx context.Context, f models.ReviewFilter) ([]*models.Review, int64, error) {
	where := []string{"r.deleted_at IS NULL"}
	args := pgx.NamedArgs{}

	if f.ProductID != nil {
		where = append(where, "r.product_id = @product_id")
		args["product_id"] = *f.ProductID
	}
	if f.UserID != nil {
		where = append(where, "r.user_id = @user_id")
		args["user_id"] = *f.UserID
	}
	if f.Status != nil {
		where = append(where, "r.status = @status")
		args["status"] = *f.Status
	}
	if f.Rating != nil {
		where = append(where, "r.rating = @rating")
		args["rating"] = *f.Rating
	}
	if f.Verified != nil {
		where = append(where, "r.verified_purchase = @verified")
		args["verified"] = *f.Verified
	}

	allowed := map[string]bool{
		"created_at": true,
		"rating":     true,
		"like_count": true,
	}
	sortBy := "r.created_at"
	if allowed[f.SortBy] {
		sortBy = "r." + f.SortBy
	}
	order := "DESC"
	if strings.ToUpper(f.OrderBy) == "ASC" {
		order = "ASC"
	}

	args["limit"] = f.Limit
	args["offset"] = f.Offset()

	q := fmt.Sprintf(`
		SELECT
			r.*,
			COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS user_full_name,
			COUNT(*) OVER() AS total_count
		FROM reviews r
		INNER JOIN users u ON u.id = r.user_id
		WHERE %s
		ORDER BY %s %s
		LIMIT @limit OFFSET @offset`,
		strings.Join(where, " AND "), sortBy, order,
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, 0, fmt.Errorf("reviewRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var (
		reviews []*models.Review
		total   int64
	)

	for rows.Next() {
		var rev models.Review
		var userFullName string
		if err := rows.Scan(
			&rev.ID, &rev.Title, &rev.Content, &rev.Rating,
			&rev.UserID, &rev.ProductID,
			&rev.LikeCount, &rev.DislikeCount,
			&rev.VerifiedPurchase, &rev.Status,
			&rev.CreatedAt, &rev.UpdatedAt, &rev.DeletedAt,
			&userFullName,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("reviewRepository.GetAll scan: %w", err)
		}
		reviews = append(reviews, &rev)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("reviewRepository.GetAll rows: %w", err)
	}

	return reviews, total, nil
}

func (r *reviewRepository) Update(ctx context.Context, id int64, userID int64, req models.UpdateReviewReq) (*models.Review, error) {
	sets := []string{"status = 'pending'"}
	args := pgx.NamedArgs{"id": id, "user_id": userID}

	if req.Title != nil {
		sets = append(sets, "title = @title")
		args["title"] = *req.Title
	}
	if req.Content != nil {
		sets = append(sets, "content = @content")
		args["content"] = *req.Content
	}
	if req.Rating != nil {
		sets = append(sets, "rating = @rating")
		args["rating"] = *req.Rating
	}

	q := fmt.Sprintf(`
		UPDATE reviews SET %s
		WHERE id      = @id
		  AND user_id = @user_id
		  AND deleted_at IS NULL
		RETURNING *`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.Update: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Review])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("reviewRepository.Update scan: %w", err)
	}
	return &review, nil
}

func (r *reviewRepository) UpdateStatus(ctx context.Context, id int64, req models.UpdateReviewStatusReq) (*models.Review, error) {
	const q = `
		UPDATE reviews SET status = @status
		WHERE id = @id AND deleted_at IS NULL
		RETURNING *`

	args := pgx.NamedArgs{
		"id":     id,
		"status": req.Status,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.UpdateStatus: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Review])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("reviewRepository.UpdateStatus scan: %w", err)
	}
	return &review, nil
}

func (r *reviewRepository) Delete(ctx context.Context, id int64, userID int64) error {
	const q = `
		UPDATE reviews SET deleted_at = NOW()
		WHERE id      = $1
		  AND user_id = $2
		  AND deleted_at IS NULL`

	res, err := r.db.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("reviewRepository.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *reviewRepository) GetRatingSummary(ctx context.Context, productID int64) (*models.ProductRatingSummary, error) {
	const q = `
		SELECT
			COUNT(*)                                         AS total,
			COALESCE(ROUND(AVG(rating::NUMERIC), 2), 0)     AS average,
			COUNT(*) FILTER (WHERE rating = 1)               AS r1,
			COUNT(*) FILTER (WHERE rating = 2)               AS r2,
			COUNT(*) FILTER (WHERE rating = 3)               AS r3,
			COUNT(*) FILTER (WHERE rating = 4)               AS r4,
			COUNT(*) FILTER (WHERE rating = 5)               AS r5
		FROM reviews
		WHERE product_id = $1
		  AND status     = 'approved'
		  AND deleted_at IS NULL`

	var (
		total              int
		average            float64
		r1, r2, r3, r4, r5 int
	)

	if err := r.db.QueryRow(ctx, q, productID).Scan(
		&total, &average,
		&r1, &r2, &r3, &r4, &r5,
	); err != nil {
		return nil, fmt.Errorf("reviewRepository.GetRatingSummary: %w", err)
	}

	return &models.ProductRatingSummary{
		ProductID:     productID,
		AverageRating: average,
		TotalReviews:  total,
		Distribution: map[int]int{
			1: r1, 2: r2, 3: r3, 4: r4, 5: r5,
		},
	}, nil
}

func (r *reviewRepository) React(ctx context.Context, id int64, like bool) error {
	var q string
	if like {
		q = `UPDATE reviews SET like_count = like_count + 1 WHERE id = $1 AND deleted_at IS NULL`
	} else {
		q = `UPDATE reviews SET dislike_count = dislike_count + 1 WHERE id = $1 AND deleted_at IS NULL`
	}

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("reviewRepository.React: %w", err)
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *reviewRepository) HasReviewed(ctx context.Context, userID int64, productID int64) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1 FROM reviews
			WHERE user_id    = $1
			  AND product_id = $2
			  AND deleted_at IS NULL
		)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, userID, productID).Scan(&exists); err != nil {
		return false, fmt.Errorf("reviewRepository.HasReviewed: %w", err)
	}
	return exists, nil
}
