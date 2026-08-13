package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/response"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func recordHandleError(err error) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	HandleError(c, err)
	return w
}

type errBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func parseErr(t *testing.T, w *httptest.ResponseRecorder) errBody {
	t.Helper()
	var body errBody
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v body=%s", err, w.Body.String())
	}
	return body
}

func TestHandleErrorMapsDomainSentinels(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		code   string
		msgSub string
	}{
		{"not_found", models.ErrNotFound, http.StatusNotFound, "NOT_FOUND", "not found"},
		{"conflict", models.ErrConflict, http.StatusConflict, "CONFLICT", ""},
		{"stock", models.ErrInsufficientStock, http.StatusConflict, "OUT_OF_STOCK", "stock"},
		{"funds", models.ErrInsufficientFunds, http.StatusConflict, "INSUFFICIENT_FUNDS", "wallet"},
		{"cart_empty", models.ErrCartEmpty, http.StatusBadRequest, "CART_EMPTY", "cart"},
		{"coupon_expired", models.ErrCouponExpired, http.StatusBadRequest, "COUPON_EXPIRED", "expired"},
		{"coupon_limit", models.ErrCouponUsageLimitReached, http.StatusConflict, "COUPON_USAGE_LIMIT", "usage"},
		{"shipping", models.ErrInvalidShippingMethod, http.StatusBadRequest, "INVALID_SHIPPING_METHOD", "shipping"},
		{"wrapped_not_found", errors.Join(errors.New("wrap"), models.ErrNotFound), http.StatusNotFound, "NOT_FOUND", ""},
		{"apperr_not_found", apperr.ErrNotFound, http.StatusNotFound, "NOT_FOUND", ""},
		{"apperr_gift", apperr.ErrGiftCardInvalid, http.StatusNotFound, "GIFT_CARD_INVALID", "gift card"},
		{"apperr_points", apperr.ErrInsufficientPoints, http.StatusConflict, "INSUFFICIENT_POINTS", "loyalty"},
		{"apperr_funds_not_payment", apperr.ErrInsufficientFunds, http.StatusConflict, "INSUFFICIENT_FUNDS", "wallet"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := recordHandleError(tc.err)
			if w.Code != tc.status {
				t.Fatalf("status = %d, want %d body=%s", w.Code, tc.status, w.Body.String())
			}
			body := parseErr(t, w)
			if body.Error.Code != tc.code {
				t.Fatalf("code = %q, want %q", body.Error.Code, tc.code)
			}
			if body.Error.Message == "" {
				t.Fatal("empty message")
			}
			if body.Error.Code == "INTERNAL_ERROR" {
				t.Fatal("known domain error must not be INTERNAL_ERROR")
			}
			if body.Error.Code == "PAYMENT_FAILED" && tc.code == "INSUFFICIENT_FUNDS" {
				t.Fatal("INSUFFICIENT_FUNDS must not map to PAYMENT_FAILED")
			}
			if tc.msgSub != "" && !containsFold(body.Error.Message, tc.msgSub) {
				t.Fatalf("message %q should mention %q", body.Error.Message, tc.msgSub)
			}
		})
	}
}

func TestHandleErrorNilLikeInternal(t *testing.T) {
	w := recordHandleError(errors.New("sql: connection reset"))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", w.Code)
	}
	body := parseErr(t, w)
	if body.Error.Code != "INTERNAL_ERROR" {
		t.Fatalf("code = %q", body.Error.Code)
	}
	// Never leak the raw SQL string to the client.
	if containsFold(body.Error.Message, "sql") || containsFold(body.Error.Message, "connection reset") {
		t.Fatalf("leaked internals: %q", body.Error.Message)
	}
}

func TestHandleErrorUsesStableResponseCodes(t *testing.T) {
	// Sanity: httpx path for stock matches package response defaults.
	w := recordHandleError(models.ErrInsufficientStock)
	body := parseErr(t, w)
	if body.Error.Code != response.ErrOutOfStock.Code {
		t.Fatalf("code = %q", body.Error.Code)
	}
}

func containsFold(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && (s == sub ||
		containsASCIIFold(s, sub)))
}

func containsASCIIFold(s, sub string) bool {
	// small helper — messages are English ASCII
	sl, subl := make([]byte, len(s)), make([]byte, len(sub))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		sl[i] = c
	}
	for i := 0; i < len(sub); i++ {
		c := sub[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		subl[i] = c
	}
	return stringIndex(string(sl), string(subl)) >= 0
}

func stringIndex(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
