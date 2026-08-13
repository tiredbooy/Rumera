package response

import (
	"net/http"
	"strings"

	"github.com/tiredbooy/pkg/apperr"
)

var (
	// =========================================================
	// Generic / System
	// =========================================================

	ErrInternalError      = AppCode{"INTERNAL_ERROR", http.StatusInternalServerError, "an unexpected error occurred"}
	ErrUnknownError       = AppCode{"UNKNOWN_ERROR", http.StatusInternalServerError, "an unknown error occurred"}
	ErrInvalidRequest     = AppCode{"INVALID_REQUEST", http.StatusBadRequest, "invalid request"}
	ErrValidationError    = AppCode{"VALIDATION_ERROR", http.StatusUnprocessableEntity, "validation failed"}
	ErrUnauthorized       = AppCode{"UNAUTHORIZED", http.StatusUnauthorized, "authentication required"}
	ErrForbidden          = AppCode{"FORBIDDEN", http.StatusForbidden, "access denied"}
	ErrNotFound           = AppCode{"NOT_FOUND", http.StatusNotFound, "resource not found"}
	ErrGone               = AppCode{"GONE", http.StatusGone, "this endpoint has been removed"}
	ErrConflict           = AppCode{"CONFLICT", http.StatusConflict, "resource already exists"}
	ErrTooManyRequests    = AppCode{"TOO_MANY_REQUESTS", http.StatusTooManyRequests, "too many requests"}
	ErrServiceUnavailable = AppCode{"SERVICE_UNAVAILABLE", http.StatusServiceUnavailable, "service unavailable"}
	ErrRequestTimeout     = AppCode{"REQUEST_TIMEOUT", http.StatusServiceUnavailable, "request timed out"}

	// =========================================================
	// Request / Input
	// =========================================================

	ErrInvalidJSON       = AppCode{"INVALID_JSON", http.StatusBadRequest, "request body contains invalid JSON"}
	ErrInvalidBody       = AppCode{"INVALID_BODY", http.StatusBadRequest, "request body is invalid"}
	ErrInvalidQuery      = AppCode{"INVALID_QUERY", http.StatusBadRequest, "invalid query parameters"}
	ErrInvalidParams     = AppCode{"INVALID_PARAMS", http.StatusBadRequest, "invalid path parameters"}
	ErrMissingField      = AppCode{"MISSING_FIELD", http.StatusBadRequest, "a required field is missing"}
	ErrInvalidField      = AppCode{"INVALID_FIELD", http.StatusBadRequest, "a field value is invalid"}
	ErrInvalidPagination = AppCode{"INVALID_PAGINATION", http.StatusBadRequest, "invalid pagination parameters"}

	// =========================================================
	// Authentication
	// =========================================================

	ErrInvalidCredentials = AppCode{"INVALID_CREDENTIALS", http.StatusUnauthorized, "invalid email or password"}
	ErrInvalidToken       = AppCode{"INVALID_TOKEN", http.StatusUnauthorized, "token is invalid"}
	ErrExpiredToken       = AppCode{"EXPIRED_TOKEN", http.StatusUnauthorized, "token has expired"}
	ErrMissingToken       = AppCode{"MISSING_TOKEN", http.StatusUnauthorized, "authentication token is required"}
	ErrSessionExpired     = AppCode{"SESSION_EXPIRED", http.StatusUnauthorized, "session has expired"}

	// =========================================================
	// Authorization
	// =========================================================

	ErrInsufficientPermissions = AppCode{"INSUFFICIENT_PERMISSIONS", http.StatusForbidden, "insufficient permissions"}
	ErrAccessDenied            = AppCode{"ACCESS_DENIED", http.StatusForbidden, "access denied"}

	// =========================================================
	// Database
	// =========================================================

	ErrDatabase            = AppCode{"DATABASE_ERROR", http.StatusInternalServerError, "a database error occurred"}
	ErrDuplicateEntry      = AppCode{"DUPLICATE_ENTRY", http.StatusConflict, "a record with this value already exists"}
	ErrForeignKeyViolation = AppCode{"FOREIGN_KEY_VIOLATION", http.StatusConflict, "related record does not exist"}
	ErrRecordNotFound      = AppCode{"RECORD_NOT_FOUND", http.StatusNotFound, "record not found"}

	// =========================================================
	// File / Upload
	// =========================================================

	ErrFileTooLarge    = AppCode{"FILE_TOO_LARGE", http.StatusRequestEntityTooLarge, "file exceeds maximum allowed size"}
	ErrInvalidFileType = AppCode{"INVALID_FILE_TYPE", http.StatusUnsupportedMediaType, "file type is not allowed"}
	ErrUploadFailed    = AppCode{"UPLOAD_FAILED", http.StatusInternalServerError, "file upload failed"}
	ErrFileNotFound    = AppCode{"FILE_NOT_FOUND", http.StatusNotFound, "file not found"}

	// =========================================================
	// Business / E-commerce
	// =========================================================

	ErrOutOfStock         = AppCode{"OUT_OF_STOCK", http.StatusConflict, "not enough stock available for one or more items"}
	ErrCartEmpty          = AppCode{"CART_EMPTY", http.StatusBadRequest, "cart is empty — add items before checkout"}
	ErrInvalidCoupon      = AppCode{"INVALID_COUPON", http.StatusBadRequest, "coupon code is invalid or does not exist"}
	ErrCouponExpired      = AppCode{"COUPON_EXPIRED", http.StatusBadRequest, "this coupon has expired"}
	ErrCouponNotActive    = AppCode{"COUPON_NOT_ACTIVE", http.StatusBadRequest, "this coupon is not active yet"}
	ErrCouponUsageLimit   = AppCode{"COUPON_USAGE_LIMIT", http.StatusConflict, "this coupon has reached its usage limit"}
	ErrCouponUserLimit    = AppCode{"COUPON_USER_LIMIT", http.StatusConflict, "you have already used this coupon the maximum number of times"}
	ErrOrderBelowMin      = AppCode{"ORDER_BELOW_MINIMUM", http.StatusBadRequest, "order total is below the coupon minimum"}
	ErrInvalidShipping    = AppCode{"INVALID_SHIPPING_METHOD", http.StatusBadRequest, "shipping method is invalid or unavailable for this address"}
	ErrInsufficientFunds  = AppCode{"INSUFFICIENT_FUNDS", http.StatusConflict, "insufficient wallet balance"}
	ErrInsufficientPoints = AppCode{"INSUFFICIENT_POINTS", http.StatusConflict, "insufficient loyalty points"}
	ErrWalletNotFound     = AppCode{"WALLET_NOT_FOUND", http.StatusNotFound, "wallet not found"}
	ErrGiftCardInvalid    = AppCode{"GIFT_CARD_INVALID", http.StatusNotFound, "gift card code is invalid or already redeemed"}
	ErrPaymentFailed      = AppCode{"PAYMENT_FAILED", http.StatusPaymentRequired, "payment processing failed"}
	ErrOrderCancelled     = AppCode{"ORDER_CANCELLED", http.StatusConflict, "order has been cancelled"}
	ErrOrderAlreadyPaid   = AppCode{"ORDER_ALREADY_PAID", http.StatusConflict, "order has already been paid"}
	ErrAccountDisabled    = AppCode{"ACCOUNT_DISABLED", http.StatusForbidden, "this account is disabled"}
	ErrInvalidState       = AppCode{"INVALID_STATE", http.StatusConflict, "resource is in an invalid state for this action"}

	// =========================================================
	// User
	// =========================================================

	ErrUserNotFound      = AppCode{"USER_NOT_FOUND", http.StatusNotFound, "user not found"}
	ErrUserAlreadyExists = AppCode{"USER_ALREADY_EXISTS", http.StatusConflict, "a user with this email already exists"}

	// =========================================================
	// Product
	// =========================================================

	ErrProductNotFound    = AppCode{"PRODUCT_NOT_FOUND", http.StatusNotFound, "product not found"}
	ErrProductUnavailable = AppCode{"PRODUCT_UNAVAILABLE", http.StatusConflict, "product is not available"}
	ErrProductHasHistory  = AppCode{"PRODUCT_HAS_HISTORY", http.StatusConflict, "product has inventory or order history and cannot be permanently deleted"}

	// =========================================================
	// Order
	// =========================================================

	ErrOrderNotFound = AppCode{"ORDER_NOT_FOUND", http.StatusNotFound, "order not found"}
)

var registry = map[string]AppCode{
	// Generic
	"INTERNAL_ERROR":   ErrInternalError,
	"NOT_FOUND":        ErrNotFound,
	"CONFLICT":         ErrConflict,
	"ACCESS_DENIED":    ErrAccessDenied,
	"UNAUTHORIZED":     ErrUnauthorized,
	"VALIDATION_ERROR": ErrValidationError,
	"INVALID_REQUEST":  ErrInvalidRequest,
	"INVALID_STATE":    ErrInvalidState,

	// User / auth
	"USER_NOT_FOUND":      ErrUserNotFound,
	"USER_ALREADY_EXISTS": ErrUserAlreadyExists,
	"ACCOUNT_DISABLED":    ErrAccountDisabled,
	"INVALID_CREDENTIALS": ErrInvalidCredentials,
	"INVALID_TOKEN":       ErrInvalidToken,
	"EXPIRED_TOKEN":       ErrExpiredToken,

	// Wallet / loyalty / gift
	"INSUFFICIENT_FUNDS":  ErrInsufficientFunds,
	"INSUFFICIENT_POINTS": ErrInsufficientPoints,
	"WALLET_NOT_FOUND":    ErrWalletNotFound,
	"GIFT_CARD_INVALID":   ErrGiftCardInvalid,

	// Wishlist
	"WISHLIST_NOT_FOUND": AppCode{"WISHLIST_NOT_FOUND", http.StatusNotFound, "wishlist not found"},

	// Order / shipping / payment
	"ORDER_NOT_FOUND":         ErrOrderNotFound,
	"ORDER_CANCELLED":         ErrOrderCancelled,
	"ORDER_ALREADY_PAID":      ErrOrderAlreadyPaid,
	"INVALID_SHIPPING_METHOD": ErrInvalidShipping,
	"PAYMENT_FAILED":          ErrPaymentFailed,

	// Product / stock
	"PRODUCT_NOT_FOUND":   ErrProductNotFound,
	"PRODUCT_UNAVAILABLE": ErrProductUnavailable,
	"PRODUCT_HAS_HISTORY": ErrProductHasHistory,
	"OUT_OF_STOCK":        ErrOutOfStock,

	// Cart
	"CART_EMPTY": ErrCartEmpty,

	// Coupon
	"INVALID_COUPON":      ErrInvalidCoupon,
	"COUPON_EXPIRED":      ErrCouponExpired,
	"COUPON_NOT_ACTIVE":   ErrCouponNotActive,
	"COUPON_USAGE_LIMIT":  ErrCouponUsageLimit,
	"COUPON_USER_LIMIT":   ErrCouponUserLimit,
	"ORDER_BELOW_MINIMUM": ErrOrderBelowMin,
}

// FromAppError maps a typed *apperr.AppError to a stable HTTP AppCode.
// Registry entries fix status + default message; a non-empty AppError.Message
// is preferred so services can be more specific without inventing new codes.
// Unknown codes no longer collapse to INTERNAL_ERROR when Code+Message are set
// (PH-012c) — FE/ops must still see a stable machine code and human text.
func FromAppError(e *apperr.AppError) AppCode {
	if e == nil {
		return ErrInternalError
	}
	if ac, ok := registry[e.Code]; ok {
		msg := ac.Message
		if e.Message != "" {
			msg = e.Message
		}
		return AppCode{Code: ac.Code, StatusCode: ac.StatusCode, Message: msg}
	}
	msg := e.Message
	if msg == "" {
		msg = "request failed"
	}
	if e.Code == "" {
		return ErrInternalError
	}
	return AppCode{
		Code:       e.Code,
		StatusCode: guessStatusForCode(e.Code),
		Message:    msg,
	}
}

func guessStatusForCode(code string) int {
	switch code {
	case "INTERNAL_ERROR", "DATABASE_ERROR", "UNKNOWN_ERROR":
		return http.StatusInternalServerError
	case "UNAUTHORIZED", "INVALID_TOKEN", "EXPIRED_TOKEN", "MISSING_TOKEN", "INVALID_CREDENTIALS", "SESSION_EXPIRED":
		return http.StatusUnauthorized
	case "FORBIDDEN", "ACCESS_DENIED", "INSUFFICIENT_PERMISSIONS", "ACCOUNT_DISABLED":
		return http.StatusForbidden
	case "NOT_FOUND":
		return http.StatusNotFound
	case "CONFLICT", "INVALID_STATE":
		return http.StatusConflict
	case "VALIDATION_ERROR":
		return http.StatusUnprocessableEntity
	case "PAYMENT_FAILED":
		return http.StatusPaymentRequired
	}
	switch {
	case strings.HasSuffix(code, "_NOT_FOUND"):
		return http.StatusNotFound
	case strings.HasPrefix(code, "INSUFFICIENT"),
		strings.HasPrefix(code, "OUT_OF_"),
		strings.Contains(code, "ALREADY"),
		strings.Contains(code, "CONFLICT"),
		strings.Contains(code, "LIMIT"):
		return http.StatusConflict
	default:
		return http.StatusBadRequest
	}
}
