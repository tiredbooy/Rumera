package auth

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/async"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/crypto"
	"github.com/tiredbooy/pkg/response"
	"go.uber.org/zap"
)

// RequestOTPReq / VerifyOTPReq are the SMS-login payloads. Phone is normalised
// server-side, so we keep validation lenient here (just "present").
type RequestOTPReq struct {
	Phone string `json:"phone" validate:"required"`
}

type VerifyOTPReq struct {
	Phone string `json:"phone" validate:"required"`
	Code  string `json:"code"  validate:"required,len=6,numeric"`
}

const (
	otpMaxSendsPerHour = 5
	otpMaxVerifyTries  = 5
)

// RequestOTP issues a one-time code for SMS login.
//
// POST /auth/otp/request
// Always returns 202 (enumeration-safe) once the phone is well-formed; the code
// is stored in Redis and sent via the configured SMS gateway.
func (h *Handler) RequestOTP(c *gin.Context) {
	if h.Cache == nil {
		// OTP requires Redis to store/validate the code.
		response.Error(c, response.ErrServiceUnavailable)
		return
	}

	var req RequestOTPReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	phone, ok := users.NormalizeIranPhone(req.Phone)
	if !ok {
		response.Error(c, response.ErrInvalidField)
		return
	}

	ctx := c.Request.Context()

	// Cap codes requested per phone per hour (on top of the per-IP route throttle).
	// Fail closed on counter errors so a Redis blip cannot disable the cap.
	sent, err := h.Cache.Incr(ctx, cache.KeyOTPSend(phone), time.Hour)
	if err != nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	if sent > otpMaxSendsPerHour {
		response.TooManyRequests(c)
		return
	}

	code, err := generateOTP()
	if err != nil {
		response.InternalError(c)
		return
	}
	if err := h.Cache.Set(ctx, cache.KeyOTP(phone), code, h.OTPTTL); err != nil {
		response.InternalError(c)
		return
	}
	// Fresh code → reset the verify-attempt counter.
	_ = h.Cache.Delete(ctx, cache.KeyOTPVerify(phone))

	// Deliver off the request path (async outbox or inline SMS). Never block
	// the response or reveal delivery success to the caller. Panic-safe (PH-013a).
	requestID := c.GetString("request_id")
	async.GoCtx("auth.otp_sms", 10*time.Second, func(sctx context.Context) {
		var err error
		if h.Notifications != nil {
			err = h.Notifications.DispatchOTP(sctx, phone, code, "login", requestID)
		} else if h.SMS != nil {
			msg := fmt.Sprintf("کد ورود شما به رومرا: %s", code)
			err = h.SMS.Send(sctx, phone, msg)
		}
		if err != nil {
			h.Log.Warn("otp sms dispatch failed", zap.String("phone", phone), zap.Error(err))
		}
	})

	c.Status(http.StatusAccepted)
}

// VerifyOTP checks a code and, on success, logs the user in (creating a
// phone-only account on first use) and returns a token pair.
//
// POST /auth/otp/verify
func (h *Handler) VerifyOTP(c *gin.Context) {
	if h.Cache == nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}

	var req VerifyOTPReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	phone, ok := users.NormalizeIranPhone(req.Phone)
	if !ok {
		response.Error(c, response.ErrInvalidField)
		return
	}

	ctx := c.Request.Context()

	// Throttle verify attempts to defeat code brute-forcing within the TTL window.
	// Fail closed on counter errors so a Redis blip cannot disable the cap.
	tries, err := h.Cache.Incr(ctx, cache.KeyOTPVerify(phone), h.OTPTTL)
	if err != nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	if tries > otpMaxVerifyTries {
		response.TooManyRequests(c)
		return
	}

	stored, err := h.Cache.Get(ctx, cache.KeyOTP(phone))
	if err != nil || stored == "" || !crypto.ConstantTimeEqual(stored, req.Code) {
		// Expired, never requested, or wrong — same generic response either way.
		response.Error(c, response.ErrInvalidCredentials)
		return
	}

	// Single-use: burn the code (and its counters) immediately on success.
	_ = h.Cache.Delete(ctx, cache.KeyOTP(phone), cache.KeyOTPVerify(phone))

	user, err := h.Users.GetOrCreateByPhone(ctx, phone)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if !user.IsActive || user.IsBanned {
		response.Error(c, response.ErrAccountDisabled)
		return
	}

	pair, err := h.issueTokens(ctx, user.ID, user.UserID.String(), user.Role)
	if err != nil {
		if pair.Access == "" {
			response.InternalError(c)
			return
		}
		pair.Refresh = ""
	}

	// Welcome loyalty bonus on first sign-up (idempotent per user; best-effort).
	if h.Loyalty != nil {
		_ = h.Loyalty.AwardSignup(ctx, user.ID)
	}

	response.OK(c, TokenResponse{
		AccessToken:  pair.Access,
		RefreshToken: pair.Refresh,
		User:         users.MapToUserResponse(user),
	})
}

// generateOTP returns a zero-padded 6-digit crypto-random code.
// On RNG failure it returns an error rather than a predictable fallback.
func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

const otpPurposePhoneChange = "phone_change"

// phoneChangeOTPScope / phoneChangePendingScope reuse the login OTP key
// helpers with a user-scoped suffix so a phone-change code cannot be
// consumed as a login OTP (and vice versa).
func phoneChangeOTPScope(userID uuid.UUID) string {
	return "chg:" + userID.String()
}

func phoneChangePendingScope(userID uuid.UUID) string {
	return "chgpend:" + userID.String()
}

// RequestPhoneChangeOTP issues a one-time code to a NEW number. The number
// is not written until VerifyPhoneChangeOTP succeeds.
//
// POST /auth/me/phone/otp
func (h *Handler) RequestPhoneChangeOTP(c *gin.Context) {
	if h.Cache == nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	userID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}

	var req RequestOTPReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	phone, ok := users.NormalizeIranPhone(req.Phone)
	if !ok {
		response.Error(c, response.ErrInvalidField)
		return
	}

	ctx := c.Request.Context()
	current, err := h.Users.GetByID(ctx, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if current.Phone != nil {
		if existing, ok := users.NormalizeIranPhone(*current.Phone); ok && existing == phone {
			response.Error(c, response.ErrInvalidField)
			return
		}
	}
	if err := h.Users.CheckPhoneAvailable(ctx, userID, phone); err != nil {
		httpx.HandleError(c, err)
		return
	}

	// Same per-phone hourly cap as login OTP (shared KeyOTPSend).
	sent, err := h.Cache.Incr(ctx, cache.KeyOTPSend(phone), time.Hour)
	if err != nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	if sent > otpMaxSendsPerHour {
		response.TooManyRequests(c)
		return
	}

	code, err := generateOTP()
	if err != nil {
		response.InternalError(c)
		return
	}
	scope := phoneChangeOTPScope(userID)
	if err := h.Cache.Set(ctx, cache.KeyOTP(scope), code, h.OTPTTL); err != nil {
		response.InternalError(c)
		return
	}
	if err := h.Cache.Set(ctx, cache.KeyOTP(phoneChangePendingScope(userID)), phone, h.OTPTTL); err != nil {
		response.InternalError(c)
		return
	}
	_ = h.Cache.Delete(ctx, cache.KeyOTPVerify(scope))

	requestID := c.GetString("request_id")
	async.GoCtx("auth.phone_change_otp_sms", 10*time.Second, func(sctx context.Context) {
		var err error
		if h.Notifications != nil {
			err = h.Notifications.DispatchOTP(sctx, phone, code, otpPurposePhoneChange, requestID)
		} else if h.SMS != nil {
			msg := fmt.Sprintf("کد تایید شماره جدید شما در رومرا: %s", code)
			err = h.SMS.Send(sctx, phone, msg)
		}
		if err != nil && h.Log != nil {
			h.Log.Warn("phone-change otp sms dispatch failed", zap.String("phone", phone), zap.Error(err))
		}
	})

	c.Status(http.StatusAccepted)
}

// VerifyPhoneChangeOTP checks the code sent to the new number and, on
// success, persists that number on the authenticated account.
//
// POST /auth/me/phone/verify
func (h *Handler) VerifyPhoneChangeOTP(c *gin.Context) {
	if h.Cache == nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	userID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}

	var req VerifyOTPReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	phone, ok := users.NormalizeIranPhone(req.Phone)
	if !ok {
		response.Error(c, response.ErrInvalidField)
		return
	}

	ctx := c.Request.Context()
	pending, err := h.Cache.Get(ctx, cache.KeyOTP(phoneChangePendingScope(userID)))
	if err != nil || pending == "" || pending != phone {
		response.Error(c, response.ErrInvalidCredentials)
		return
	}

	scope := phoneChangeOTPScope(userID)
	tries, err := h.Cache.Incr(ctx, cache.KeyOTPVerify(scope), h.OTPTTL)
	if err != nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	if tries > otpMaxVerifyTries {
		response.TooManyRequests(c)
		return
	}

	stored, err := h.Cache.Get(ctx, cache.KeyOTP(scope))
	if err != nil || stored == "" || !crypto.ConstantTimeEqual(stored, req.Code) {
		response.Error(c, response.ErrInvalidCredentials)
		return
	}

	_ = h.Cache.Delete(ctx,
		cache.KeyOTP(scope),
		cache.KeyOTPVerify(scope),
		cache.KeyOTP(phoneChangePendingScope(userID)),
	)

	user, err := h.Users.ApplyVerifiedPhone(ctx, userID, phone)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, users.MapToUserResponse(user))
}
