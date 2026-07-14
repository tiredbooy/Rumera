package handlers

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/pkg/cache"
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
	if !h.bindJSON(c, &req) {
		return
	}
	phone, ok := normalizeIranPhone(req.Phone)
	if !ok {
		response.Error(c, response.ErrInvalidField)
		return
	}

	ctx := c.Request.Context()

	// Cap codes requested per phone per hour (on top of the per-IP route throttle).
	if sent, err := h.Cache.Incr(ctx, cache.KeyOTPSend(phone), time.Hour); err == nil && sent > otpMaxSendsPerHour {
		response.TooManyRequests(c)
		return
	}

	code := generateOTP()
	if err := h.Cache.Set(ctx, cache.KeyOTP(phone), code, h.OTPTTL); err != nil {
		response.InternalError(c)
		return
	}
	// Fresh code → reset the verify-attempt counter.
	_ = h.Cache.Delete(ctx, cache.KeyOTPVerify(phone))

	// Send off the request path; a slow gateway must never block the response,
	// and we don't reveal delivery success to the caller.
	msg := fmt.Sprintf("کد ورود شما به رومرا: %s", code)
	go func() {
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := h.SMS.Send(sctx, phone, msg); err != nil {
			h.Log.Warn("otp sms send failed", zap.String("phone", phone), zap.Error(err))
		}
	}()

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
	if !h.bindJSON(c, &req) {
		return
	}
	phone, ok := normalizeIranPhone(req.Phone)
	if !ok {
		response.Error(c, response.ErrInvalidField)
		return
	}

	ctx := c.Request.Context()

	// Throttle verify attempts to defeat code brute-forcing within the TTL window.
	if tries, err := h.Cache.Incr(ctx, cache.KeyOTPVerify(phone), h.OTPTTL); err == nil && tries > otpMaxVerifyTries {
		response.TooManyRequests(c)
		return
	}

	stored, err := h.Cache.Get(ctx, cache.KeyOTP(phone))
	if err != nil || stored == "" || stored != req.Code {
		// Expired, never requested, or wrong — same generic response either way.
		response.Error(c, response.ErrInvalidCredentials)
		return
	}

	// Single-use: burn the code (and its counters) immediately on success.
	_ = h.Cache.Delete(ctx, cache.KeyOTP(phone), cache.KeyOTPVerify(phone))

	user, err := h.User.GetOrCreateByPhone(ctx, phone)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	if !user.IsActive {
		response.Error(c, response.ErrForbidden)
		return
	}

	pair, err := h.issueTokens(ctx, user.ID, user.UserID.String(), user.Role)
	if err != nil {
		response.InternalError(c)
		return
	}

	// Welcome loyalty bonus on first sign-up (idempotent per user; best-effort).
	if h.Loyalty != nil {
		_ = h.Loyalty.AwardSignup(ctx, user.ID)
	}

	response.OK(c, TokenResponse{
		AccessToken:  pair.Access,
		RefreshToken: pair.Refresh,
		User:         mappers.MapToUserResponse(user),
	})
}

// generateOTP returns a zero-padded 6-digit crypto-random code.
func generateOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		// rand.Int only errors if the reader fails; fall back to a fixed-width 0.
		return "000000"
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// normalizeIranPhone canonicalises common Iranian mobile inputs to "09XXXXXXXXX".
// Accepts ASCII/Persian/Arabic digits and +98 / 0098 / 98 / 9… prefixes.
func normalizeIranPhone(raw string) (string, bool) {
	var b strings.Builder
	for _, r := range raw {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r >= '۰' && r <= '۹': // Persian digits U+06F0..U+06F9
			b.WriteRune('0' + (r - '۰'))
		case r >= '٠' && r <= '٩': // Arabic-Indic digits U+0660..U+0669
			b.WriteRune('0' + (r - '٠'))
		}
	}
	d := b.String()

	switch {
	case strings.HasPrefix(d, "0098"):
		d = "0" + d[4:]
	case strings.HasPrefix(d, "98") && len(d) == 12:
		d = "0" + d[2:]
	case strings.HasPrefix(d, "9") && len(d) == 10:
		d = "0" + d
	}

	if len(d) == 11 && strings.HasPrefix(d, "09") {
		return d, true
	}
	return "", false
}
