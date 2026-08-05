package models

import (
	"time"
)

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type PasswordReset struct {
	ID        int64      `db:"id"`
	// UserID is the internal users.id (bigint FK), not the public UUID.
	UserID    int64      `db:"user_id"`
	// TokenHash is SHA-256 hex of the opaque token emailed to the user.
	// The plaintext token is never persisted.
	TokenHash string     `db:"token_hash"`
	ExpiresAt time.Time  `db:"expires_at"`
	UsedAt    *time.Time `db:"used_at"`
	CreatedAt time.Time  `db:"created_at"`
}

type CreatePasswordResetReq struct {
	UserID    int64
	// TokenHash is the SHA-256 hex digest of the raw token (never plaintext).
	TokenHash string
	ExpiresAt time.Time
}
