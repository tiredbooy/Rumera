package response

import (
	"net/http"
	"testing"

	"github.com/tiredbooy/pkg/apperr"
)

func TestFromAppErrorInsufficientFundsNotPaymentFailed(t *testing.T) {
	ac := FromAppError(apperr.ErrInsufficientFunds)
	if ac.Code != "INSUFFICIENT_FUNDS" {
		t.Fatalf("code = %q, want INSUFFICIENT_FUNDS (was wrongly PAYMENT_FAILED)", ac.Code)
	}
	if ac.StatusCode != http.StatusConflict {
		t.Fatalf("status = %d, want 409", ac.StatusCode)
	}
	if ac.Message == "" || ac.Message == ErrPaymentFailed.Message {
		t.Fatalf("message = %q, want wallet balance text", ac.Message)
	}
}

func TestFromAppErrorPrefersAppMessage(t *testing.T) {
	e := apperr.New("OUT_OF_STOCK", "only 2 units left for this variant")
	ac := FromAppError(e)
	if ac.Code != "OUT_OF_STOCK" {
		t.Fatalf("code = %q", ac.Code)
	}
	if ac.Message != "only 2 units left for this variant" {
		t.Fatalf("message = %q, want specific service text", ac.Message)
	}
	if ac.StatusCode != http.StatusConflict {
		t.Fatalf("status = %d", ac.StatusCode)
	}
}

func TestFromAppErrorUnknownCodeDoesNotCollapseToInternal(t *testing.T) {
	e := apperr.New("CUSTOM_DOMAIN_FAIL", "please try a different payment method")
	ac := FromAppError(e)
	if ac.Code != "CUSTOM_DOMAIN_FAIL" {
		t.Fatalf("code = %q, want CUSTOM_DOMAIN_FAIL not INTERNAL_ERROR", ac.Code)
	}
	if ac.Message != "please try a different payment method" {
		t.Fatalf("message = %q", ac.Message)
	}
	if ac.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 default", ac.StatusCode)
	}
}

func TestFromAppErrorMoneyCodes(t *testing.T) {
	cases := []struct {
		err    *apperr.AppError
		code   string
		status int
	}{
		{apperr.ErrOutOfStock, "OUT_OF_STOCK", http.StatusConflict},
		{apperr.ErrCartEmpty, "CART_EMPTY", http.StatusBadRequest},
		{apperr.ErrInvalidCoupon, "INVALID_COUPON", http.StatusBadRequest},
		{apperr.ErrInsufficientPoints, "INSUFFICIENT_POINTS", http.StatusConflict},
		{apperr.ErrLoyaltyDisabled, "LOYALTY_DISABLED", http.StatusConflict},
		{apperr.ErrGiftCardInvalid, "GIFT_CARD_INVALID", http.StatusNotFound},
		{apperr.ErrAccountDisabled, "ACCOUNT_DISABLED", http.StatusForbidden},
		{apperr.ErrOrderAlreadyPaid, "ORDER_ALREADY_PAID", http.StatusConflict},
	}
	for _, tc := range cases {
		ac := FromAppError(tc.err)
		if ac.Code != tc.code {
			t.Fatalf("%s: code = %q", tc.code, ac.Code)
		}
		if ac.StatusCode != tc.status {
			t.Fatalf("%s: status = %d, want %d", tc.code, ac.StatusCode, tc.status)
		}
		if ac.Message == "" {
			t.Fatalf("%s: empty message", tc.code)
		}
	}
}
