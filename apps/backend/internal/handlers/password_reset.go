package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/response"
)

type forgotPasswordReq struct {
	Email string `json:"email" validate:"required,email"`
}

type resetPasswordReq struct {
	Token       string `json:"token"        validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

// ForgotPassword starts the reset flow. It always responds 202 regardless of
// whether the email exists, so the endpoint can't be used to enumerate accounts.
//
// POST /auth/password/forgot
func (h *Handler) ForgotPassword(c *gin.Context) {
	var req forgotPasswordReq
	if !h.bindJSON(c, &req) {
		return
	}
	// Errors are intentionally swallowed — never reveal whether the email exists.
	_ = h.PasswordReset.RequestReset(c.Request.Context(), req.Email)
	response.Success(c, 202, gin.H{"message": "if the email exists, a reset link has been sent"})
}

// ValidateResetToken — GET /auth/password/validate?token=...
func (h *Handler) ValidateResetToken(c *gin.Context) {
	tok := c.Query("token")
	if tok == "" {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	if _, err := h.PasswordReset.ValidateToken(c.Request.Context(), tok); err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, gin.H{"valid": true})
}

// ResetPassword sets a new password using a valid reset token.
//
// POST /auth/password/reset
func (h *Handler) ResetPassword(c *gin.Context) {
	var req resetPasswordReq
	if !h.bindJSON(c, &req) {
		return
	}
	if !crypto.PasswordFitsBcrypt(req.NewPassword) {
		response.ValidationError(c, map[string][]string{
			"new_password": {"password must not exceed 72 UTF-8 bytes"},
		})
		return
	}
	hash, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		response.InternalError(c)
		return
	}
	if err := h.PasswordReset.ResetPassword(c.Request.Context(), req.Token, hash); err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "password updated"})
}
