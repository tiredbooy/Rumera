package response

import (
	"net/http"

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

	ErrOutOfStock       = AppCode{"OUT_OF_STOCK", http.StatusConflict, "item is out of stock"}
	ErrCartEmpty        = AppCode{"CART_EMPTY", http.StatusBadRequest, "cart is empty"}
	ErrInvalidCoupon    = AppCode{"INVALID_COUPON", http.StatusBadRequest, "coupon code is invalid"}
	ErrCouponExpired    = AppCode{"COUPON_EXPIRED", http.StatusBadRequest, "coupon has expired"}
	ErrPaymentFailed    = AppCode{"PAYMENT_FAILED", http.StatusPaymentRequired, "payment processing failed"}
	ErrOrderCancelled   = AppCode{"ORDER_CANCELLED", http.StatusConflict, "order has been cancelled"}
	ErrOrderAlreadyPaid = AppCode{"ORDER_ALREADY_PAID", http.StatusConflict, "order has already been paid"}

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
	"ACCESS_DENIED":    ErrForbidden,
	"UNAUTHORIZED":     ErrUnauthorized,
	"VALIDATION_ERROR": ErrValidationError,
	"INVALID_REQUEST":  ErrInvalidRequest,

	

	// User
	"USER_NOT_FOUND":      ErrUserNotFound,
	"USER_ALREADY_EXISTS": ErrUserAlreadyExists,

	// Wallet
	"INSUFFICIENT_FUNDS": ErrPaymentFailed,
	"WALLET_NOT_FOUND":   ErrNotFound,

	// Wishlist
	"WISHLIST_NOT_FOUND": AppCode{"WISHLIST_NOT_FOUND", http.StatusNotFound, "wishlist not found"},

	// Order
	"ORDER_NOT_FOUND":    ErrOrderNotFound,
	"ORDER_CANCELLED":    ErrOrderCancelled,
	"ORDER_ALREADY_PAID": ErrOrderAlreadyPaid,

	// Product
	"PRODUCT_NOT_FOUND":   ErrProductNotFound,
	"PRODUCT_UNAVAILABLE": ErrProductUnavailable,
	"OUT_OF_STOCK":        ErrOutOfStock,

	// Cart
	"CART_EMPTY": ErrCartEmpty,

	// Coupon
	"INVALID_COUPON": ErrInvalidCoupon,
	"COUPON_EXPIRED": ErrCouponExpired,
}

func FromAppError(e *apperr.AppError) AppCode {
	if ac, ok := registry[e.Code]; ok {
		return ac
	}
	return ErrInternalError
}
