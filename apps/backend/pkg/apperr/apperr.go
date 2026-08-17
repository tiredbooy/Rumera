package apperr

import "errors"

type AppError struct {
	Code    string
	Message string
}

func (e *AppError) Error() string { return e.Message }

func New(code, message string) *AppError {
	return &AppError{Code: code, Message: message}
}

// FieldAppError adds request-field detail while preserving the underlying
// AppError code/status mapping through errors.As and errors.Is.
type FieldAppError struct {
	Cause  *AppError
	Fields map[string][]string
}

func (e *FieldAppError) Error() string { return e.Cause.Error() }
func (e *FieldAppError) Unwrap() error { return e.Cause }

func WithFields(cause *AppError, fields map[string][]string) error {
	return &FieldAppError{Cause: cause, Fields: fields}
}

func Fields(err error) (map[string][]string, bool) {
	var fieldErr *FieldAppError
	if !errors.As(err, &fieldErr) {
		return nil, false
	}
	return fieldErr.Fields, true
}

var (
	// Generic / System
	ErrInternal       = New("INTERNAL_ERROR", "an unexpected error occurred")
	ErrNotFound       = New("NOT_FOUND", "resource not found")
	ErrConflict       = New("CONFLICT", "resource already exists")
	ErrAccessDenied   = New("ACCESS_DENIED", "access denied")
	ErrUnauthorized   = New("UNAUTHORIZED", "authentication required")
	ErrValidation     = New("VALIDATION_ERROR", "validation failed")
	ErrInvalidRequest = New("INVALID_REQUEST", "invalid request")

	// Authentication
	ErrInvalidToken = New("INVALID_TOKEN", "token is invalid")
	ErrExpiredToken = New("EXPIRED_TOKEN", "token has expired")

	// User
	ErrUserNotFound      = New("USER_NOT_FOUND", "user not found")
	ErrUserAlreadyExists = New("USER_ALREADY_EXISTS", "a user with this email already exists")

	// Wishlist
	ErrWishlistNotFound = New("WISHLIST_NOT_FOUND", "wishlist not found")

	// Wallet / loyalty / gift
	ErrInsufficientFunds  = New("INSUFFICIENT_FUNDS", "insufficient wallet balance")
	ErrInsufficientPoints = New("INSUFFICIENT_POINTS", "insufficient loyalty points")
	ErrLoyaltyDisabled    = New("LOYALTY_DISABLED", "loyalty programme is disabled")
	ErrWalletNotFound     = New("WALLET_NOT_FOUND", "wallet not found")
	ErrGiftCardInvalid    = New("GIFT_CARD_INVALID", "gift card code is invalid or already redeemed")

	// Order
	ErrOrderNotFound    = New("ORDER_NOT_FOUND", "order not found")
	ErrOrderCancelled   = New("ORDER_CANCELLED", "order has been cancelled")
	ErrOrderAlreadyPaid = New("ORDER_ALREADY_PAID", "order has already been paid")

	// Product
	ErrProductNotFound    = New("PRODUCT_NOT_FOUND", "product not found")
	ErrProductUnavailable = New("PRODUCT_UNAVAILABLE", "product is not available")
	ErrProductHasHistory  = New("PRODUCT_HAS_HISTORY", "product has inventory or order history and cannot be permanently deleted")
	ErrOutOfStock         = New("OUT_OF_STOCK", "not enough stock available for one or more items")

	// Cart
	ErrCartEmpty = New("CART_EMPTY", "cart is empty — add items before checkout")

	// Coupon
	ErrInvalidCoupon = New("INVALID_COUPON", "coupon code is invalid or does not exist")
	ErrCouponExpired = New("COUPON_EXPIRED", "this coupon has expired")

	// Auth account state
	ErrAccountDisabled = New("ACCOUNT_DISABLED", "this account is disabled")
)

// As unwraps any error chain to an *AppError.
func As(err error) (*AppError, bool) {
	var e *AppError
	ok := errors.As(err, &e)
	return e, ok
}

// Is allows errors.Is comparisons against AppError sentinels by code.
// This means errors.Is(err, apperr.ErrNotFound) works even through wrapping.
func (e *AppError) Is(target error) bool {
	t, ok := target.(*AppError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}
