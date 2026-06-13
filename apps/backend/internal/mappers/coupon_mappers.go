// internal/mappers/coupon_mappers.go
package mappers

import (
	"fmt"
	"time"

	"github.com/tiredbooy/internal/models"
)

func ToCouponResponse(c *models.Coupon, totalUses int) models.CouponResponse {
	return models.CouponResponse{
		ID:                c.ID,
		Code:              c.Code,
		Description:       c.Description,
		DiscountType:      c.DiscountType,
		DiscountValue:     c.DiscountValue,
		MaxDiscountAmount: c.MaxDiscountAmount,
		MinOrderAmount:    c.MinOrderAmount,
		MaxUses:           c.MaxUses,
		MaxUsesPerUser:    c.MaxUsesPerUser,
		ApplicableTo:      c.ApplicableTo,
		IsActive:          c.IsActive,
		StartsAt:          c.StartsAt,
		ExpiresAt:         c.ExpiresAt,
		TotalUses:         totalUses,
	}
}

func CalculateDiscount(c *models.Coupon, orderSubtotal float64) (discountAmount float64, freeShipping bool) {
	switch c.DiscountType {
	case models.DiscountTypeFreeShipping:
		return 0, true

	case models.DiscountTypeFixedAmount:
		// Never discount more than the order value
		discount := c.DiscountValue
		if discount > orderSubtotal {
			discount = orderSubtotal
		}
		return discount, false

	case models.DiscountTypePercentage:
		discount := (c.DiscountValue / 100) * orderSubtotal
		// Apply cap if set
		if c.MaxDiscountAmount != nil && discount > *c.MaxDiscountAmount {
			discount = *c.MaxDiscountAmount
		}
		return discount, false
	}

	return 0, false
}

func ValidateCoupon(
	c *models.Coupon,
	req models.ValidateCouponReq,
	totalUses int,
	userUses int,
) models.CouponValidationResult {
	now := time.Now()

	if !c.IsActive {
		return invalid("coupon is not active")
	}
	if now.Before(c.StartsAt) {
		return invalid("coupon is not yet valid")
	}
	if c.ExpiresAt != nil && now.After(*c.ExpiresAt) {
		return invalid("coupon has expired")
	}
	if req.OrderSubtotal < c.MinOrderAmount {
		return invalid(fmt.Sprintf("minimum order amount of %.2f required", c.MinOrderAmount))
	}
	if c.MaxUses != nil && totalUses >= *c.MaxUses {
		return invalid("coupon has reached its usage limit")
	}
	if userUses >= c.MaxUsesPerUser {
		return invalid("you have already used this coupon the maximum number of times")
	}
	if !isApplicable(c, req) {
		return invalid("coupon does not apply to items in your cart")
	}

	discount, freeShipping := CalculateDiscount(c, req.OrderSubtotal)

	return models.CouponValidationResult{
		Coupon:         c,
		DiscountAmount: discount,
		FreeShipping:   freeShipping,
		IsValid:        true,
	}
}

func invalid(reason string) models.CouponValidationResult {
	return models.CouponValidationResult{IsValid: false, InvalidReason: reason}
}

func isApplicable(c *models.Coupon, req models.ValidateCouponReq) bool {
	if c.ApplicableTo == nil {
		return true
	}

	for _, pid := range c.ApplicableTo.ProductIDs {
		for _, cartPID := range req.ProductIDs {
			if pid == cartPID {
				return true
			}
		}
	}
	for _, cid := range c.ApplicableTo.CategoryIDs {
		for _, cartCID := range req.CategoryIDs {
			if cid == cartCID {
				return true
			}
		}
	}

	return false
}
