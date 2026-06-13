package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/notify"
)

const resetTokenTTL = 1 * time.Hour

type PasswordResetService struct {
	resetRepo repositories.PasswordResetRepository
	userRepo  repositories.UserRepository
	mailer    notify.Mailer
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

// RequestReset looks up the user by email and creates a signed reset token.
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

	token, err := generateSecureToken()
	if err != nil {
		return apperr.ErrInternal
	}

	req := models.CreatePasswordResetReq{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(resetTokenTTL),
	}

	if _, err := s.resetRepo.Create(ctx, req); err != nil {
		return apperr.ErrInternal
	}

	// Deliver the token out-of-band, off the request path. A mail failure must
	// not change the response (still 202), so we don't propagate the error.
	if s.mailer != nil {
		email, subject, body := user.Email, "Reset your password", resetEmailBody(token)
		go func() {
			sendCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			_ = s.mailer.Send(sendCtx, email, subject, body)
		}()
	}

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

	reset, err := s.resetRepo.GetByToken(ctx, token)
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

// ResetPassword validates the token, updates the user's password hash,
// then marks the token as used — all three steps must succeed.
func (s *PasswordResetService) ResetPassword(ctx context.Context, token string, newPasswordHash string) error {
	if token == "" || newPasswordHash == "" {
		return apperr.ErrInvalidRequest
	}

	reset, err := s.resetRepo.GetByToken(ctx, token)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrInvalidToken
		}
		return apperr.ErrInternal
	}

	if err := assertTokenValid(reset); err != nil {
		return err
	}

	// Fetch the user so we have their UUID for the update call
	user, err := s.userRepo.GetByID(ctx, uuid.UUID(reset.UserID))
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrUserNotFound
		}
		return apperr.ErrInternal
	}

	updateReq := models.UpdateUserReq{
		PasswordHash: &newPasswordHash,
	}

	if _, err := s.userRepo.Update(ctx, user.UserID, updateReq); err != nil {
		return apperr.ErrInternal
	}

	// Consume the token — prevents replay attacks.
	// If this fails after the password update the user can just log in;
	// the token will expire naturally via DeleteExpired.
	if err := s.resetRepo.MarkUsed(ctx, reset.ID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			// Token was already used or expired between our check and now —
			// the password was already updated so this is still a success.
			return nil
		}
		return apperr.ErrInternal
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

// assertTokenValid checks expiry and used_at — the repo intentionally
// returns the raw record so the service owns these business rules.
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
