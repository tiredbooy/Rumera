package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

type ReferralRepository interface {
	GetCode(ctx context.Context, userID int64) (string, error)
	CreateCode(ctx context.Context, userID int64, code string) error
	GetUserByCode(ctx context.Context, code string) (int64, error)
	HasReferral(ctx context.Context, refereeID int64) (bool, error)
	CreateReferral(ctx context.Context, referrerID, refereeID int64, reward int) error
	FindPendingByReferee(ctx context.Context, refereeID int64) (*models.Referral, error)
	Complete(ctx context.Context, id int64) error
	Counts(ctx context.Context, referrerID int64) (pending, completed int, err error)
}

type referralRepository struct {
	db *pgxpool.Pool
}

func NewReferralRepository(db *pgxpool.Pool) ReferralRepository {
	return &referralRepository{db: db}
}

func (r *referralRepository) GetCode(ctx context.Context, userID int64) (string, error) {
	var code string
	err := r.db.QueryRow(ctx, `SELECT code FROM referral_codes WHERE user_id = $1`, userID).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", models.ErrNotFound
		}
		return "", fmt.Errorf("referralRepository.GetCode: %w", err)
	}
	return code, nil
}

// CreateCode inserts a code for the user. Returns models.ErrConflict if the code
// (or user) already exists, so the caller can retry with a fresh code.
func (r *referralRepository) CreateCode(ctx context.Context, userID int64, code string) error {
	const q = `
		INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`
	tag, err := r.db.Exec(ctx, q, userID, code)
	if err != nil {
		return fmt.Errorf("referralRepository.CreateCode: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return models.ErrConflict
	}
	return nil
}

func (r *referralRepository) GetUserByCode(ctx context.Context, code string) (int64, error) {
	var userID int64
	err := r.db.QueryRow(ctx, `SELECT user_id FROM referral_codes WHERE code = $1`, code).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("referralRepository.GetUserByCode: %w", err)
	}
	return userID, nil
}

func (r *referralRepository) HasReferral(ctx context.Context, refereeID int64) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM referrals WHERE referee_user_id = $1)`, refereeID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("referralRepository.HasReferral: %w", err)
	}
	return exists, nil
}

func (r *referralRepository) CreateReferral(ctx context.Context, referrerID, refereeID int64, reward int) error {
	const q = `
		INSERT INTO referrals (referrer_user_id, referee_user_id, reward_points)
		VALUES ($1, $2, $3)
		ON CONFLICT (referee_user_id) DO NOTHING`
	if _, err := r.db.Exec(ctx, q, referrerID, refereeID, reward); err != nil {
		return fmt.Errorf("referralRepository.CreateReferral: %w", err)
	}
	return nil
}

func (r *referralRepository) FindPendingByReferee(ctx context.Context, refereeID int64) (*models.Referral, error) {
	const q = `
		SELECT id, referrer_user_id, referee_user_id, status, reward_points, created_at, completed_at
		FROM referrals
		WHERE referee_user_id = $1 AND status = $2`
	rows, err := r.db.Query(ctx, q, refereeID, models.ReferralStatusPending)
	if err != nil {
		return nil, fmt.Errorf("referralRepository.FindPendingByReferee: %w", err)
	}
	ref, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.Referral])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("referralRepository.FindPendingByReferee scan: %w", err)
	}
	return &ref, nil
}

func (r *referralRepository) Complete(ctx context.Context, id int64) error {
	const q = `UPDATE referrals SET status = $2, completed_at = NOW() WHERE id = $1 AND status = $3`
	if _, err := r.db.Exec(ctx, q, id, models.ReferralStatusCompleted, models.ReferralStatusPending); err != nil {
		return fmt.Errorf("referralRepository.Complete: %w", err)
	}
	return nil
}

func (r *referralRepository) Counts(ctx context.Context, referrerID int64) (pending, completed int, err error) {
	const q = `
		SELECT
			COUNT(*) FILTER (WHERE status = $2) AS pending,
			COUNT(*) FILTER (WHERE status = $3) AS completed
		FROM referrals WHERE referrer_user_id = $1`
	if err = r.db.QueryRow(
		ctx,
		q,
		referrerID,
		models.ReferralStatusPending,
		models.ReferralStatusCompleted,
	).Scan(&pending, &completed); err != nil {
		return 0, 0, fmt.Errorf("referralRepository.Counts: %w", err)
	}
	return pending, completed, nil
}
