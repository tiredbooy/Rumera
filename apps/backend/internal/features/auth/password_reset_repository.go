// internal/repositories/password_reset_repository.go
package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
	)

// ─────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────

type PasswordResetRepo interface {
	// Create stores a new reset token hash, invalidating any previous
	// unused tokens for the same user in the same query.
	Create(ctx context.Context, req CreatePasswordResetReq) (*PasswordReset, error)

	// GetByTokenHash fetches a token record — service validates expiry and used_at.
	GetByTokenHash(ctx context.Context, tokenHash string) (*PasswordReset, error)

	// ConsumeAndResetPassword atomically marks the token used, sets the new
	// password hash, and bumps sessions_invalidated_at so existing JWTs die.
	// Returns the internal user id on success.
	ConsumeAndResetPassword(ctx context.Context, tokenHash, newPasswordHash string) (userID int64, err error)

	// DeleteExpired is called by a background cleanup job — keeps the table small.
	DeleteExpired(ctx context.Context) error
}

// ─────────────────────────────────────────────────────────────
// Struct + constructor
// ─────────────────────────────────────────────────────────────

type passwordResetRepo struct {
	db *pgxpool.Pool
}

func NewPasswordResetRepo(db *pgxpool.Pool) PasswordResetRepo {
	return &passwordResetRepo{db: db}
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepo) Create(ctx context.Context, req CreatePasswordResetReq) (*PasswordReset, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepo.Create begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const invalidate = `
		UPDATE password_resets
		SET used_at = NOW()
		WHERE user_id = @user_id
		  AND used_at IS NULL
		  AND expires_at > NOW()`

	if _, err := tx.Exec(ctx, invalidate, pgx.NamedArgs{
		"user_id": req.UserID,
	}); err != nil {
		return nil, fmt.Errorf("passwordResetRepo.Create invalidate: %w", err)
	}

	const insert = `
		INSERT INTO password_resets (user_id, token_hash, expires_at)
		VALUES (@user_id, @token_hash, @expires_at)
		RETURNING *`

	args := pgx.NamedArgs{
		"user_id":    req.UserID,
		"token_hash": req.TokenHash,
		"expires_at": req.ExpiresAt,
	}

	rows, err := tx.Query(ctx, insert, args)
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepo.Create insert: %w", err)
	}

	reset, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PasswordReset])
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepo.Create scan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("passwordResetRepo.Create commit: %w", err)
	}

	return &reset, nil
}

// ─────────────────────────────────────────────────────────────
// GetByTokenHash
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*PasswordReset, error) {
	const q = `
		SELECT * FROM password_resets
		WHERE token_hash = $1`

	rows, err := r.db.Query(ctx, q, tokenHash)
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepo.GetByTokenHash: %w", err)
	}

	reset, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[PasswordReset])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("passwordResetRepo.GetByTokenHash scan: %w", err)
	}
	return &reset, nil
}

// ─────────────────────────────────────────────────────────────
// ConsumeAndResetPassword
// Single transaction: consume token → set password → kill sessions.
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepo) ConsumeAndResetPassword(
	ctx context.Context,
	tokenHash, newPasswordHash string,
) (int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("passwordResetRepo.ConsumeAndResetPassword begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const consume = `
		UPDATE password_resets
		SET used_at = NOW()
		WHERE token_hash = $1
		  AND used_at IS NULL
		  AND expires_at > NOW()
		RETURNING user_id`

	var userID int64
	if err := tx.QueryRow(ctx, consume, tokenHash).Scan(&userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, models.ErrNotFound
		}
		return 0, fmt.Errorf("passwordResetRepo.ConsumeAndResetPassword consume: %w", err)
	}

	const setPassword = `
		UPDATE users
		SET password_hash = $1,
		    sessions_invalidated_at = $2,
		    updated_at = $2
		WHERE id = $3`

	now := time.Now().UTC()
	tag, err := tx.Exec(ctx, setPassword, newPasswordHash, now, userID)
	if err != nil {
		return 0, fmt.Errorf("passwordResetRepo.ConsumeAndResetPassword update user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return 0, models.ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("passwordResetRepo.ConsumeAndResetPassword commit: %w", err)
	}
	return userID, nil
}

// ─────────────────────────────────────────────────────────────
// DeleteExpired
// ─────────────────────────────────────────────────────────────

func (r *passwordResetRepo) DeleteExpired(ctx context.Context) error {
	const q = `DELETE FROM password_resets WHERE expires_at < NOW()`

	if _, err := r.db.Exec(ctx, q); err != nil {
		return fmt.Errorf("passwordResetRepo.DeleteExpired: %w", err)
	}
	return nil
}
