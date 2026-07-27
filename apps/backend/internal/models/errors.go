package models

import "errors"

var (
	// Generic
	ErrNotFound      = errors.New("record not found")
	ErrAlreadyExists = errors.New("record already exists")
	ErrInvalidState  = errors.New("record is in an invalid state")
	ErrConflict      = errors.New("conflict")

	// Hero slides
	ErrHeroSchedule     = errors.New("hero slide schedule is invalid")
	ErrHeroPrimaryCTA   = errors.New("hero slide primary CTA is invalid")
	ErrHeroSecondaryCTA = errors.New("hero slide secondary CTA is invalid")

	// Stock / funds
	ErrInsufficientStock = errors.New("insufficient stock")
	ErrInsufficientFunds = errors.New("insufficient funds")

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
	ErrHasChildren = errors.New("category has children and cannot be deleted")
)

// TaxRate is applied to the post-discount subtotal.
const TaxRate = 0.08
