package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/notify"
)

const resetTokenTTL = 1 * time.Hour

// PasswordResetNotifier delivers the reset email (inline mailer or async outbox).
type PasswordResetNotifier interface {
	DispatchPasswordReset(ctx context.Context, to, subject, htmlBody, correlationID, idempotencyKey string) error
}

// SessionKiller is called after a successful password reset so refresh-token
// whitelists (and any other session material) can be purged. Implementations
// must be safe when the cache is unavailable.
type SessionKiller interface {
	// InvalidateUserSessions drops server-side session material for userUID
	// (public UUID string). Best-effort: errors are logged by the caller.
	InvalidateUserSessions(ctx context.Context, userUID string) error
}

type PasswordResetService struct {
	resetRepo repositories.PasswordResetRepository
	userRepo  repositories.UserRepository
	mailer    notify.Mailer
	// notifier, when set, is preferred over mailer (async Kafka path).
	notifier PasswordResetNotifier
	// sessions, when set, revokes refresh tokens after a successful reset.
	sessions SessionKiller
}

func NewPasswordResetService(
	resetRepo repositories.PasswordResetRepository,
	userRepo repositories.UserRepository,
	mailer notify.Mailer,
) *PasswordResetService {
	return &PasswordResetService{
		resetRepo: resetRepo,
		userRepo:  userRepo,
		mailer:    mailer,
	}
}

// WithNotifier enables async (or unified) notification delivery.
func (s *PasswordResetService) WithNotifier(n PasswordResetNotifier) *PasswordResetService {
	s.notifier = n
	return s
}

// WithSessionKiller registers the callback used to revoke refresh tokens after
// a successful password reset (access tokens die via sessions_invalidated_at).
func (s *PasswordResetService) WithSessionKiller(k SessionKiller) *PasswordResetService {
	s.sessions = k
	return s
}

// RequestReset looks up the user by email and creates a hashed reset token.
// It always returns nil — even if the email doesn't exist — so callers
// can't use this endpoint to enumerate registered addresses.
func (s *PasswordResetService) RequestReset(ctx context.Context, email string) error {
	if email == "" {
		return apperr.ErrInvalidRequest
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		// Intentional silent return — don't reveal whether the email exists.
		return nil
	}

	rawToken, err := generateSecureToken()
	if err != nil {
		return apperr.ErrInternal
	}
	tokenHash := crypto.HashToken(rawToken)

	req := models.CreatePasswordResetReq{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(resetTokenTTL),
	}

	if _, err := s.resetRepo.Create(ctx, req); err != nil {
		return apperr.ErrInternal
	}

	// Deliver the raw token out-of-band. A mail failure must not change the
	// response (still 202), so we don't propagate the error.
	to, subject, body := user.Email, "Reset your password", resetEmailBody(rawToken)
	// Idempotency key uses the hash so the plaintext never lands in outbox keys.
	idem := fmt.Sprintf("password_reset:%d:%s", user.ID, tokenHash[:16])
	go func() {
		sendCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if s.notifier != nil {
			_ = s.notifier.DispatchPasswordReset(sendCtx, to, subject, body, "", idem)
			return
		}
		if s.mailer != nil {
			_ = s.mailer.Send(sendCtx, to, subject, body)
		}
	}()

	return nil
}

func resetEmailBody(token string) string {
	return fmt.Sprintf(
		`<p>We received a request to reset your password.</p>`+
			`<p>Use the following token to set a new password. It expires in one hour:</p>`+
			`<p style="font-size:18px"><strong>%s</strong></p>`+
			`<p>If you didn't request this, you can safely ignore this email.</p>`,
		token,
	)
}

// ValidateToken fetches and validates a token without consuming it.
// Used to verify a token is still valid before showing the reset-password form.
func (s *PasswordResetService) ValidateToken(ctx context.Context, token string) (*models.PasswordReset, error) {
	if token == "" {
		return nil, apperr.ErrInvalidRequest
	}

	reset, err := s.resetRepo.GetByTokenHash(ctx, crypto.HashToken(token))
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrInvalidToken
		}
		return nil, apperr.ErrInternal
	}

	if err := assertTokenValid(reset); err != nil {
		return nil, err
	}

	return reset, nil
}

// ResetPassword consumes a valid token, sets the new password hash, and
// invalidates every existing session for that user — all in one DB transaction
// plus a best-effort refresh-token wipe.
func (s *PasswordResetService) ResetPassword(ctx context.Context, token string, newPasswordHash string) error {
	if token == "" || newPasswordHash == "" {
		return apperr.ErrInvalidRequest
	}

	tokenHash := crypto.HashToken(token)
	userID, err := s.resetRepo.ConsumeAndResetPassword(ctx, tokenHash, newPasswordHash)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrInvalidToken
		}
		return apperr.ErrInternal
	}

	// Best-effort: drop refresh whitelist entries if a session killer is wired.
	// Access tokens are already dead via sessions_invalidated_at on the user row.
	if s.sessions != nil {
		if user, uerr := s.userRepo.GetAuthUserByUID(ctx, userID); uerr == nil && user != nil {
			_ = s.sessions.InvalidateUserSessions(ctx, user.UserID.String())
		}
	}

	return nil
}

// DeleteExpired is called by your background cleanup job.
func (s *PasswordResetService) DeleteExpired(ctx context.Context) error {
	if err := s.resetRepo.DeleteExpired(ctx); err != nil {
		return apperr.ErrInternal
	}
	return nil
}

// ── private helpers ───────────────────────────────────────────────────────────

func assertTokenValid(reset *models.PasswordReset) error {
	if reset.UsedAt != nil {
		return apperr.ErrInvalidToken
	}
	if time.Now().After(reset.ExpiresAt) {
		return apperr.ErrExpiredToken
	}
	return nil
}

// generateSecureToken produces a 32-byte cryptographically random hex string.
func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
