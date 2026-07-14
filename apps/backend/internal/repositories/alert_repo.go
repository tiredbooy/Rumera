package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type AlertRepository interface {
	Create(ctx context.Context, a models.ProductAlert) (*models.ProductAlert, error)
	ListByUser(ctx context.Context, userID int64) ([]models.ProductAlert, error)
	Delete(ctx context.Context, userID, id int64) error
	// FindPending returns un-notified alerts whose condition is now satisfied.
	FindPending(ctx context.Context, limit int) ([]models.PendingAlert, error)
	// MarkNotified stamps notified_at on the given alert ids.
	MarkNotified(ctx context.Context, ids []int64) error
}

type alertRepository struct {
	db *pgxpool.Pool
}

func NewAlertRepository(db *pgxpool.Pool) AlertRepository {
	return &alertRepository{db: db}
}

func (r *alertRepository) Create(ctx context.Context, a models.ProductAlert) (*models.ProductAlert, error) {
	const q = `
		INSERT INTO product_alerts (user_id, product_variant_id, alert_type, target_price, reference_price)
		VALUES (@user_id, @variant_id, @alert_type, @target_price, @reference_price)
		ON CONFLICT (user_id, product_variant_id, alert_type) DO UPDATE
			SET target_price    = EXCLUDED.target_price,
			    reference_price = EXCLUDED.reference_price,
			    notified_at     = NULL,
			    created_at      = NOW()
		RETURNING id, user_id, product_variant_id, alert_type, target_price,
		          reference_price, notified_at, created_at`

	args := pgx.NamedArgs{
		"user_id":         a.UserID,
		"variant_id":      a.ProductVariantID,
		"alert_type":      a.AlertType,
		"target_price":    a.TargetPrice,
		"reference_price": a.ReferencePrice,
	}

	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("alertRepository.Create: %w", err)
	}
	alert, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.ProductAlert])
	if err != nil {
		return nil, fmt.Errorf("alertRepository.Create scan: %w", err)
	}
	return &alert, nil
}

func (r *alertRepository) ListByUser(ctx context.Context, userID int64) ([]models.ProductAlert, error) {
	const q = `
		SELECT id, user_id, product_variant_id, alert_type, target_price,
		       reference_price, notified_at, created_at
		FROM product_alerts
		WHERE user_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("alertRepository.ListByUser: %w", err)
	}
	alerts, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.ProductAlert])
	if err != nil {
		return nil, fmt.Errorf("alertRepository.ListByUser scan: %w", err)
	}
	return alerts, nil
}

func (r *alertRepository) Delete(ctx context.Context, userID, id int64) error {
	const q = `DELETE FROM product_alerts WHERE id = $1 AND user_id = $2`

	tag, err := r.db.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("alertRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *alertRepository) FindPending(ctx context.Context, limit int) ([]models.PendingAlert, error) {
	const q = `
		SELECT a.id,
		       u.email                       AS email,
		       a.alert_type                  AS alert_type,
		       p.title                       AS product_title,
		       p.slug                        AS product_slug,
		       v.price                       AS current_price
		FROM product_alerts a
		JOIN product_variants v ON v.id = a.product_variant_id
		JOIN products p         ON p.id = v.product_id
		JOIN users u            ON u.id = a.user_id
		LEFT JOIN inventory i   ON i.product_variant_id = a.product_variant_id
		WHERE a.notified_at IS NULL
		  AND u.is_active = true
		  AND (
		        (a.alert_type = 'restock'
		            AND COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0) > 0)
		     OR (a.alert_type = 'price_drop'
		            AND v.price < COALESCE(a.target_price, a.reference_price))
		      )
		ORDER BY a.created_at
		LIMIT $1`

	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("alertRepository.FindPending: %w", err)
	}
	pending, err := pgx.CollectRows(rows, pgx.RowToStructByName[models.PendingAlert])
	if err != nil {
		return nil, fmt.Errorf("alertRepository.FindPending scan: %w", err)
	}
	return pending, nil
}

func (r *alertRepository) MarkNotified(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	const q = `UPDATE product_alerts SET notified_at = NOW() WHERE id = ANY($1)`
	if _, err := r.db.Exec(ctx, q, ids); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("alertRepository.MarkNotified: %w", err)
	}
	return nil
}
