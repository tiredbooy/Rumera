package models

import "errors"

var (
	// Generic
	ErrNotFound          = errors.New("record not found")
	ErrAlreadyExists     = errors.New("record already exists")
	ErrInvalidState      = errors.New("record is in an invalid state")
	ErrConflict          = errors.New("conflict")
	ErrAccessDenied      = errors.New("access denied")
	ErrProductHasHistory = errors.New("product has inventory or order history")

	// Hero slides
	ErrHeroSchedule     = errors.New("hero slide schedule is invalid")
	ErrHeroPrimaryCTA   = errors.New("hero slide primary CTA is invalid")
	ErrHeroSecondaryCTA = errors.New("hero slide secondary CTA is invalid")

	// Stock / funds
	ErrInsufficientStock          = errors.New("insufficient stock")
	ErrInsufficientFunds          = errors.New("insufficient funds")
	ErrInvalidInventoryAdjustment = errors.New("invalid inventory adjustment")

	// Cart
	ErrCartEmpty = errors.New("cart is empty")

	// Shipping
	ErrInvalidShippingMethod = errors.New("invalid or unavailable shipping method")

	// Coupon
	ErrInvalidCoupon           = errors.New("coupon not found")
	ErrCouponNotActive         = errors.New("coupon is not active yet")
	ErrCouponExpired           = errors.New("coupon has expired")
	ErrOrderBelowMinimum       = errors.New("order subtotal does not meet the coupon minimum")
	ErrCouponUsageLimitReached = errors.New("coupon has reached its global usage limit")
	ErrCouponUserLimitReached  = errors.New("coupon has reached its per-user usage limit")

	// Category
	ErrHasChildren    = errors.New("category has children and cannot be deleted")
	ErrHierarchyCycle = errors.New("category hierarchy would contain a cycle")
)

// TaxRate is applied to the post-discount subtotal.
const TaxRate = 0.08
