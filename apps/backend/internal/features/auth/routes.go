package auth

import (
	"time"

	"github.com/gin-gonic/gin"
	mw "github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/token"
)

// RegisterPublic mounts unauthenticated auth endpoints on /api/v1/auth.
//
//	POST /auth/login|register|password/forgot|otp/*|refresh|logout|password/*
func RegisterPublic(v1 *gin.RouterGroup, h *Handler, jwt token.Manager, store cache.Store) {
	if h == nil {
		h = &Handler{}
	}
	auth := v1.Group("/auth")

	// Throttle credential-sensitive endpoints: max 10 attempts per IP per minute.
	throttle := mw.LoginRateLimit(store, 10, time.Minute)
	auth.POST("/login", throttle, h.Login)
	auth.POST("/register", throttle, h.Register)
	auth.POST("/password/forgot", throttle, h.ForgotPassword)

	// SMS OTP login (phone-first).
	auth.POST("/otp/request", throttle, h.RequestOTP)
	auth.POST("/otp/verify", throttle, h.VerifyOTP)

	auth.POST("/refresh", h.Refresh)
	auth.POST("/logout", h.Logout)
	auth.GET("/password/validate", h.ValidateResetToken)
	auth.POST("/password/reset", h.ResetPassword)
}

// RegisterCustomer mounts authenticated self-service auth routes.
// Parent group must already apply Auth middleware (typically the /auth group).
//
//	GET /auth/me
// Profile PATCH is owned by features/users.RegisterCustomer.
func RegisterCustomer(me *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	me.GET("/me", h.Me)
}

// RegisterAdmin is a no-op for auth (no admin-only auth routes).
func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
