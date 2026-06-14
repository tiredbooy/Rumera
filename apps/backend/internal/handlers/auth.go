package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/response"
)

// LoginReq is the credentials payload for POST /auth/login.
type LoginReq struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// RefreshReq carries the refresh token for POST /auth/refresh.
type RefreshReq struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// AuthResponse is returned by register/login/refresh.
type AuthResponse struct {
	AccessToken  string               `json:"access_token"`
	RefreshToken string               `json:"refresh_token"`
	User         *models.UserResponse `json:"user,omitempty"`
}

// Register creates a customer account and returns a fresh token pair.
//
// POST /auth/register
func (h *Handler) Register(c *gin.Context) {
	var req models.CreateUserReq
	if !h.bindJSON(c, &req) {
		return
	}
	// Never let a client self-assign a privileged role.
	req.Role = "customer"

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
		response.InternalError(c)
		return
	}

	response.Created(c, AuthResponse{
		AccessToken:  pair.Access,
		RefreshToken: pair.Refresh,
		User:         mappers.MapToUserResponse(user),
	})
}

// Login verifies credentials and issues a token pair.
//
// POST /auth/login
func (h *Handler) Login(c *gin.Context) {
	var req LoginReq
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
	if !user.IsActive {
		response.Error(c, response.ErrForbidden)
		return
	}

	pair, err := h.issueTokens(c.Request.Context(), user.ID, user.UserID.String(), user.Role)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.OK(c, AuthResponse{
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
	var req RefreshReq
	if !h.bindJSON(c, &req) {
		return
	}

	// consumeRefresh validates the token and, when Redis is present, enforces
	// single-use rotation — the old refresh token is invalidated here.
	claims, ok := h.consumeRefresh(c.Request.Context(), req.RefreshToken)
	if !ok {
		response.Error(c, response.ErrInvalidToken)
		return
	}

	userUUID, err := uuid.Parse(claims.UserID)
	if err != nil {
		response.Error(c, response.ErrInvalidToken)
		return
	}

	user, err := h.User.GetByID(c.Request.Context(), userUUID)
	if err != nil {
		response.Error(c, response.ErrInvalidToken)
		return
	}
	if !user.IsActive {
		response.Error(c, response.ErrForbidden)
		return
	}

	pair, err := h.issueTokens(c.Request.Context(), user.ID, user.UserID.String(), user.Role)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.OK(c, AuthResponse{
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
	var req RefreshReq
	// Body is optional; bind best-effort.
	_ = c.ShouldBindJSON(&req)
	h.revokeRefresh(c.Request.Context(), req.RefreshToken)
	c.Status(http.StatusNoContent)
}
