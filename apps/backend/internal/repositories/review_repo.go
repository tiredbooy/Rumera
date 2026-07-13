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
	React(ctx context.Context, id int64, userID int64, like bool) error
	HasReviewed(ctx context.Context, userID int64, productID int64) (bool, error)
	HasPurchased(ctx context.Context, userID int64, productID int64) (bool, error)
	GetMine(ctx context.Context, userID int64) ([]models.AccountReviewResponse, error)
	GetPending(ctx context.Context, userID int64) ([]models.PendingReviewResponse, error)
}

type reviewRepository struct {
	db *pgxpool.Pool
}

func NewReviewRepository(db *pgxpool.Pool) ReviewRepository {
	return &reviewRepository{db: db}
}

func (r *reviewRepository) Create(ctx context.Context, userID int64, req models.CreateReviewReq, verifiedPurchase bool) (*models.Review, error) {
	const q = `
		WITH inserted AS (
			INSERT INTO reviews (title, content, rating, user_id, product_id, verified_purchase)
			VALUES (@title, @content, @rating, @user_id, @product_id, @verified_purchase)
			ON CONFLICT (user_id, product_id) WHERE deleted_at IS NULL DO NOTHING
			RETURNING *
		)
		SELECT inserted.*,
			TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS user_full_name
		FROM inserted
		INNER JOIN users u ON u.id = inserted.user_id`

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

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[models.Review])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrConflict
		}
		return nil, fmt.Errorf("reviewRepository.Create scan: %w", err)
	}
	return &review, nil
}

func (r *reviewRepository) GetByID(ctx context.Context, id int64) (*models.Review, error) {
	const q = `
		SELECT r.*,
			TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS user_full_name
		FROM reviews r
		INNER JOIN users u ON u.id = r.user_id
		WHERE r.id = $1 AND r.deleted_at IS NULL`

	rows, err := r.db.Query(ctx, q, id)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.GetByID: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[models.Review])
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
		rev.UserFullName = strings.TrimSpace(userFullName)
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
		WITH updated AS (
			UPDATE reviews SET %s
			WHERE id      = @id
			  AND user_id = @user_id
			  AND deleted_at IS NULL
			RETURNING *
		)
		SELECT updated.*,
			TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS user_full_name
		FROM updated
		INNER JOIN users u ON u.id = updated.user_id`,
		strings.Join(sets, ", "),
	)

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.Update: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[models.Review])
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
		WITH updated AS (
			UPDATE reviews SET status = @status
			WHERE id = @id AND deleted_at IS NULL
			RETURNING *
		)
		SELECT updated.*,
			TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS user_full_name
		FROM updated
		INNER JOIN users u ON u.id = updated.user_id`

	args := pgx.NamedArgs{
		"id":     id,
		"status": req.Status,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.UpdateStatus: %w", err)
	}

	review, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[models.Review])
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

func (r *reviewRepository) React(ctx context.Context, id int64, userID int64, like bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("reviewRepository.React begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var reviewID int64
	if err := tx.QueryRow(ctx, `
		SELECT id FROM reviews
		WHERE id = $1 AND status = 'approved' AND deleted_at IS NULL
		FOR UPDATE`, id).Scan(&reviewID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.ErrNotFound
		}
		return fmt.Errorf("reviewRepository.React lock: %w", err)
	}

	voteType := "dislike"
	if like {
		voteType = "like"
	}
	var previous string
	err = tx.QueryRow(ctx,
		`SELECT vote_type FROM review_votes WHERE review_id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&previous)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("reviewRepository.React previous: %w", err)
	}
	if previous == voteType {
		return tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO review_votes (review_id, user_id, vote_type)
		VALUES ($1, $2, $3)
		ON CONFLICT (review_id, user_id)
		DO UPDATE SET vote_type = EXCLUDED.vote_type`, id, userID, voteType); err != nil {
		return fmt.Errorf("reviewRepository.React vote: %w", err)
	}

	likeDelta, dislikeDelta := 0, 0
	if voteType == "like" {
		likeDelta = 1
		if previous == "dislike" {
			dislikeDelta = -1
		}
	} else {
		dislikeDelta = 1
		if previous == "like" {
			likeDelta = -1
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE reviews
		SET like_count = GREATEST(0, like_count + $2),
			dislike_count = GREATEST(0, dislike_count + $3)
		WHERE id = $1`, id, likeDelta, dislikeDelta); err != nil {
		return fmt.Errorf("reviewRepository.React counters: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("reviewRepository.React commit: %w", err)
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

func (r *reviewRepository) HasPurchased(ctx context.Context, userID int64, productID int64) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM orders o
			INNER JOIN order_items oi ON oi.order_id = o.id
			WHERE o.user_id = $1
			  AND oi.product_id = $2
			  AND o.status = 'delivered'
		)`

	var exists bool
	if err := r.db.QueryRow(ctx, q, userID, productID).Scan(&exists); err != nil {
		return false, fmt.Errorf("reviewRepository.HasPurchased: %w", err)
	}
	return exists, nil
}

func (r *reviewRepository) GetMine(ctx context.Context, userID int64) ([]models.AccountReviewResponse, error) {
	const q = `
		SELECT r.id, r.product_id, p.slug AS product_slug, p.title AS product_title,
			(
				SELECT pi.image_url
				FROM product_images pi
				WHERE pi.product_id = p.id
				ORDER BY pi.is_primary DESC NULLS LAST, pi.sort_order, pi.id
				LIMIT 1
			) AS image_url,
			r.rating, r.content, r.status, r.created_at
		FROM reviews r
		INNER JOIN products p ON p.id = r.product_id
		WHERE r.user_id = $1 AND r.deleted_at IS NULL
		ORDER BY r.created_at DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.GetMine: %w", err)
	}
	defer rows.Close()

	reviews, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.AccountReviewResponse])
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.GetMine scan: %w", err)
	}
	return reviews, nil
}

func (r *reviewRepository) GetPending(ctx context.Context, userID int64) ([]models.PendingReviewResponse, error) {
	const q = `
		SELECT DISTINCT ON (p.id)
			p.id AS product_id, p.slug AS product_slug, p.title AS product_title,
			(
				SELECT pi.image_url
				FROM product_images pi
				WHERE pi.product_id = p.id
				ORDER BY pi.is_primary DESC NULLS LAST, pi.sort_order, pi.id
				LIMIT 1
			) AS image_url,
			o.id AS order_id, o.delivered_at
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		INNER JOIN products p ON p.id = oi.product_id
		LEFT JOIN reviews r
			ON r.user_id = o.user_id
			AND r.product_id = p.id
			AND r.deleted_at IS NULL
		WHERE o.user_id = $1
		  AND o.status = 'delivered'
		  AND r.id IS NULL
		ORDER BY p.id, o.delivered_at DESC NULLS LAST, o.id DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.GetPending: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.PendingReviewResponse])
	if err != nil {
		return nil, fmt.Errorf("reviewRepository.GetPending scan: %w", err)
	}
	return items, nil
}
