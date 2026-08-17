package subscription

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// errInvalidAddressID is a missing/invalid addresses.id (FK 23503).
var errInvalidAddressID = errors.New("invalid address_id")

type Repository interface {
	Create(ctx context.Context, sub Subscription) (*Subscription, error)
	ListByUser(ctx context.Context, userID int64) ([]Subscription, error)
	Get(ctx context.Context, id, userID int64) (*Subscription, error)
	UpdateStatus(ctx context.Context, id, userID int64, status SubscriptionStatus) error
	SetNextRenewal(ctx context.Context, id, userID int64, t time.Time) error
	UpdateAddress(ctx context.Context, id, userID, addressID int64) error
	FindDue(ctx context.Context, now time.Time, limit int) ([]DueSubscription, error)
	AdvanceRenewal(ctx context.Context, id int64, next time.Time) error
}

type subscriptionRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &subscriptionRepository{db: db}
}

func (r *subscriptionRepository) Create(ctx context.Context, sub Subscription) (*Subscription, error) {
	const q = `
		INSERT INTO subscriptions (user_id, plan, cadence, address_id, next_renewal_at)
		VALUES (@user_id, @plan, @cadence, @address_id, @next_renewal_at)
		RETURNING *`
	args := pgx.NamedArgs{
		"user_id":         sub.UserID,
		"plan":            sub.Plan,
		"cadence":         sub.Cadence,
		"address_id":      sub.AddressID,
		"next_renewal_at": sub.NextRenewalAt,
	}
	rows, err := r.db.Query(ctx, q, args)
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.Create: %w", err)
	}
	s, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Subscription])
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.Create scan: %w", err)
	}
	return &s, nil
}

func (r *subscriptionRepository) ListByUser(ctx context.Context, userID int64) ([]Subscription, error) {
	const q = `SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.ListByUser: %w", err)
	}
	subs, err := pgx.CollectRows(rows, pgx.RowToStructByName[Subscription])
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.ListByUser scan: %w", err)
	}
	return subs, nil
}

func (r *subscriptionRepository) Get(ctx context.Context, id, userID int64) (*Subscription, error) {
	const q = `SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2`
	rows, err := r.db.Query(ctx, q, id, userID)
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.Get: %w", err)
	}
	s, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Subscription])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("subscriptionRepository.Get scan: %w", err)
	}
	return &s, nil
}

func (r *subscriptionRepository) UpdateStatus(ctx context.Context, id, userID int64, status SubscriptionStatus) error {
	const q = `UPDATE subscriptions SET status = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`
	tag, err := r.db.Exec(ctx, q, id, userID, status)
	if err != nil {
		return fmt.Errorf("subscriptionRepository.UpdateStatus: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *subscriptionRepository) SetNextRenewal(ctx context.Context, id, userID int64, t time.Time) error {
	const q = `UPDATE subscriptions SET next_renewal_at = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`
	tag, err := r.db.Exec(ctx, q, id, userID, t)
	if err != nil {
		return fmt.Errorf("subscriptionRepository.SetNextRenewal: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func (r *subscriptionRepository) UpdateAddress(ctx context.Context, id, userID, addressID int64) error {
	const q = `UPDATE subscriptions SET address_id = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`
	tag, err := r.db.Exec(ctx, q, id, userID, addressID)
	if err != nil {
		if isAddressFKViolation(err) {
			return errInvalidAddressID
		}
		return fmt.Errorf("subscriptionRepository.UpdateAddress: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

func isAddressFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func (r *subscriptionRepository) FindDue(ctx context.Context, now time.Time, limit int) ([]DueSubscription, error) {
	const q = `
		SELECT s.id, s.user_id, u.email AS email, s.cadence, s.next_renewal_at
		FROM subscriptions s
		JOIN users u ON u.id = s.user_id
		WHERE s.status = 'active' AND s.next_renewal_at <= $1 AND u.is_active = true
		ORDER BY s.next_renewal_at
		LIMIT $2`
	rows, err := r.db.Query(ctx, q, now, limit)
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.FindDue: %w", err)
	}
	due, err := pgx.CollectRows(rows, pgx.RowToStructByName[DueSubscription])
	if err != nil {
		return nil, fmt.Errorf("subscriptionRepository.FindDue scan: %w", err)
	}
	return due, nil
}

func (r *subscriptionRepository) AdvanceRenewal(ctx context.Context, id int64, next time.Time) error {
	const q = `UPDATE subscriptions SET next_renewal_at = $2, updated_at = NOW() WHERE id = $1`
	if _, err := r.db.Exec(ctx, q, id, next); err != nil {
		return fmt.Errorf("subscriptionRepository.AdvanceRenewal: %w", err)
	}
	return nil
}
