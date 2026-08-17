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

	// Shared per-IP limiter (10/min): login, register, forgot, OTP,
	// refresh, logout, and password validate/reset. Same helper as login so
	// a Redis outage still falls back to the in-memory window.
	throttle := mw.LoginRateLimit(store, 10, time.Minute)
	auth.POST("/login", throttle, h.Login)
	auth.POST("/register", throttle, h.Register)
	auth.POST("/password/forgot", throttle, h.ForgotPassword)

	// SMS OTP login (phone-first).
	auth.POST("/otp/request", throttle, h.RequestOTP)
	auth.POST("/otp/verify", throttle, h.VerifyOTP)

	auth.POST("/refresh", throttle, h.Refresh)
	auth.POST("/logout", throttle, h.Logout)
	auth.GET("/password/validate", throttle, h.ValidateResetToken)
	auth.POST("/password/reset", throttle, h.ResetPassword)
}

// RegisterCustomer mounts authenticated self-service auth routes.
// Parent group must already apply Auth middleware (typically the /auth group).
//
//	GET /auth/me
//	POST /auth/me/phone/otp
//	POST /auth/me/phone/verify
//
// Profile PATCH is owned by features/users.RegisterCustomer.
func RegisterCustomer(me *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	me.GET("/me", h.Me)
	me.POST("/me/phone/otp", h.RequestPhoneChangeOTP)
	me.POST("/me/phone/verify", h.VerifyPhoneChangeOTP)
}

// RegisterAdmin is a no-op for auth (no admin-only auth routes).
func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
