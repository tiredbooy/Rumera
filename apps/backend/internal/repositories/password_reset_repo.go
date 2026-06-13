// internal/repositories/password_reset_repository.go
package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
)

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

type PasswordResetRepository interface {
	// Create stores a new reset token, invalidating any previous
	// unused tokens for the same user in the same query.
	Create(ctx context.Context, req models.CreatePasswordResetReq) (*models.PasswordReset, error)

	// GetByToken fetches a token record — service validates expiry and used_at.
	GetByToken(ctx context.Context, token string) (*models.PasswordReset, error)

	// MarkUsed stamps used_at so the token can never be replayed.
	MarkUsed(ctx context.Context, id int64) error

	// DeleteExpired is called by a background cleanup job — keeps the table small.
	DeleteExpired(ctx context.Context) error
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type passwordResetRepository struct {
	db *pgxpool.Pool
}

func NewPasswordResetRepository(db *pgxpool.Pool) PasswordResetRepository {
	return &passwordResetRepository{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// Invalidates previous unused tokens for this user in the same
// transaction — no user should ever have two active reset tokens.
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepository) Create(ctx context.Context, req models.CreatePasswordResetReq) (*models.PasswordReset, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepository.Create begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Invalidate any existing unused tokens for this user
	const invalidate = `
		UPDATE password_resets
		SET used_at = NOW()
		WHERE user_id = @user_id
		  AND used_at IS NULL
		  AND expires_at > NOW()`

	if _, err := tx.Exec(ctx, invalidate, pgx.NamedArgs{
		"user_id": req.UserID,
	}); err != nil {
		return nil, fmt.Errorf("passwordResetRepository.Create invalidate: %w", err)
	}

	const insert = `
		INSERT INTO password_resets (user_id, token, expires_at)
		VALUES (@user_id, @token, @expires_at)
		RETURNING *`

	args := pgx.NamedArgs{
		"user_id":    req.UserID,
		"token":      req.Token,
		"expires_at": req.ExpiresAt,
	}

	rows, err := tx.Query(ctx, insert, args)
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepository.Create insert: %w", err)
	}

	reset, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.PasswordReset])
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepository.Create scan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("passwordResetRepository.Create commit: %w", err)
	}

	return &reset, nil
}

// ─────────────────────────────────────────────────────────────
// GetByToken
// Fetches the raw record — the service is responsible for
// checking expiry and used_at, not the repo.
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepository) GetByToken(ctx context.Context, token string) (*models.PasswordReset, error) {
	const q = `
		SELECT * FROM password_resets
		WHERE token = $1`

	rows, err := r.db.Query(ctx, q, token)
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepository.GetByToken: %w", err)
	}

	reset, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[models.PasswordReset])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("passwordResetRepository.GetByToken scan: %w", err)
	}
	return &reset, nil
}

// ─────────────────────────────────────────────────────────────
// MarkUsed
// Stamps used_at — makes the token single-use.
// Only marks it if it hasn't been used already and isn't expired,
// so a race between two simultaneous requests is safe.
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepository) MarkUsed(ctx context.Context, id int64) error {
	const q = `
		UPDATE password_resets
		SET used_at = NOW()
		WHERE id = $1
		  AND used_at IS NULL
		  AND expires_at > NOW()`

	res, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("passwordResetRepository.MarkUsed: %w", err)
	}
	if res.RowsAffected() == 0 {
		// either already used or expired — both mean invalid from the service's view
		return models.ErrNotFound
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// DeleteExpired
// Run this on a schedule (e.g. every night via a cron job or
// a ticker in your background worker). Keeps the table lean.
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepository) DeleteExpired(ctx context.Context) error {
	const q = `DELETE FROM password_resets WHERE expires_at < NOW()`

	if _, err := r.db.Exec(ctx, q); err != nil {
		return fmt.Errorf("passwordResetRepository.DeleteExpired: %w", err)
	}
	return nil
}
