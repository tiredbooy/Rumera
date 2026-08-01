package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/response"
)

// blankToNil trims a nullable string field and collapses empty values to nil so
// optional fields (e.g. first/last name) are stored as NULL, not "".
func blankToNil(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// SignInInput is the credentials payload for POST /auth/login.
type SignInInput struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// RefreshTokenInput carries the refresh token for refresh and logout.
type RefreshTokenInput struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// TokenResponse is returned by register/login/refresh. User is present for a
// new authenticated session and omitted for token rotation.
type TokenResponse struct {
	AccessToken  string               `json:"access_token"`
	RefreshToken string               `json:"refresh_token,omitempty"`
	User         *models.UserResponse `json:"user,omitempty"`
}

// Register creates a customer account and returns a fresh token pair.
//
// POST /auth/register
func (h *Handler) Register(c *gin.Context) {
	var input models.SignUpInput
	if !h.bindJSON(c, &input) {
		return
	}
	// Normalise blank names to NULL so we never store empty strings.
	input.FirstName = blankToNil(input.FirstName)
	input.LastName = blankToNil(input.LastName)
	req := mappers.MapToCreateUserReq(input)
	if !crypto.PasswordFitsBcrypt(req.Password) {
		response.ValidationError(c, map[string][]string{
			"password": {"password must not exceed 72 UTF-8 bytes"},
		})
		return
	}

	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		log.Println("FAILED TO HASH PASS")
		response.InternalError(c)
		return
	}

	user, err := h.User.Create(c.Request.Context(), req, hash)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	pair, err := h.issueTokens(c.Request.Context(), user.ID, user.UserID.String(), user.Role)
	if err != nil {
		// Account creation already succeeded. Return only the short-lived access
		// token rather than advertising an unwhitelisted refresh credential; the
		// client can establish a full session through normal login.
		if pair.Access == "" {
			response.InternalError(c)
			return
		}
		pair.Refresh = ""
	}

	// Welcome loyalty bonus (idempotent per user; best-effort).
	if h.Loyalty != nil {
		_ = h.Loyalty.AwardSignup(c.Request.Context(), user.ID)
	}

	response.Created(c, TokenResponse{
		AccessToken:  pair.Access,
		RefreshToken: pair.Refresh,
		User:         mappers.MapToUserResponse(user),
	})
}

// Login verifies credentials and issues a token pair.
//
// POST /auth/login
func (h *Handler) Login(c *gin.Context) {
	var req SignInInput
	if !h.bindJSON(c, &req) {
		return
	}

	user, err := h.User.GetByEmail(c.Request.Context(), req.Email)
	if err != nil || user.PasswordHash == nil ||
		!crypto.CheckPasswordHash(req.Password, *user.PasswordHash) {
		// Same response whether the email is unknown or the password is wrong —
		// never reveal which, to prevent account enumeration.
		response.Error(c, response.ErrInvalidCredentials)
		return
	}
	if !user.IsActive || user.IsBanned {
		response.Error(c, response.ErrForbidden)
		return
	}

	pair, err := h.issueTokens(c.Request.Context(), user.ID, user.UserID.String(), user.Role)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.OK(c, TokenResponse{
		AccessToken:  pair.Access,
		RefreshToken: pair.Refresh,
		User:         mappers.MapToUserResponse(user),
	})
}

// Refresh exchanges a valid refresh token for a new token pair. The user's
// current role is re-read so role changes take effect on the next refresh.
//
// POST /auth/refresh
func (h *Handler) Refresh(c *gin.Context) {
	var req RefreshTokenInput
	if !h.bindJSON(c, &req) {
		return
	}

	claims, ok := h.validateRefresh(req.RefreshToken)
	if !ok {
		response.Error(c, response.ErrInvalidToken)
		return
	}

	userUUID, err := uuid.Parse(claims.UserID)
	if err != nil {
		response.Error(c, response.ErrInvalidToken)
		return
	}

	user, err := h.User.GetByIDIncludingInactive(c.Request.Context(), userUUID)
	if err != nil {
		response.Error(c, response.ErrInvalidToken)
		return
	}
	if user.ID != claims.UID {
		response.Error(c, response.ErrInvalidToken)
		return
	}
	if !user.IsActive || user.IsBanned {
		response.Error(c, response.ErrForbidden)
		return
	}

	pair, ok, err := h.rotateTokens(
		c.Request.Context(), claims, user.ID, user.UserID.String(), user.Role,
	)
	if err != nil {
		response.InternalError(c)
		return
	}
	if !ok {
		response.Error(c, response.ErrInvalidToken)
		return
	}

	response.OK(c, TokenResponse{
		AccessToken:  pair.Access,
		RefreshToken: pair.Refresh,
	})
}

// Me returns the authenticated user's profile.
//
// GET /auth/me
func (h *Handler) Me(c *gin.Context) {
	id, ok := h.userUUID(c)
	if !ok {
		return
	}

	user, err := h.User.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.OK(c, mappers.MapToUserResponse(user))
}

// Logout revokes the supplied refresh token so it can no longer be used to mint
// new access tokens. The access token itself is stateless and short-lived, so
// the client should simply discard it. Logout is idempotent — an absent or
// already-revoked token still returns 204.
//
// POST /auth/logout
func (h *Handler) Logout(c *gin.Context) {
	var req RefreshTokenInput
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.revokeRefresh(c.Request.Context(), req.RefreshToken); err != nil {
		if errors.Is(err, errInvalidRefreshToken) {
			response.Error(c, response.ErrInvalidToken)
			return
		}
		response.InternalError(c)
		return
	}
	c.Status(http.StatusNoContent)
}
