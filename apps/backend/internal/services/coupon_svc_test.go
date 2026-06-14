package services

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func f64(v float64) *float64 { return &v }

func TestComputeDiscount(t *testing.T) {
	cases := []struct {
		name   string
		coupon *models.Coupon
		sub    float64
		want   float64
	}{
		{
			name:   "fixed amount",
			coupon: &models.Coupon{DiscountType: models.DiscountTypeFixedAmount, DiscountValue: 10},
			sub:    100, want: 10,
		},
		{
			name:   "percentage",
			coupon: &models.Coupon{DiscountType: models.DiscountTypePercentage, DiscountValue: 20},
			sub:    100, want: 20,
		},
		{
			name:   "percentage capped by max discount",
			coupon: &models.Coupon{DiscountType: models.DiscountTypePercentage, DiscountValue: 50, MaxDiscountAmount: f64(30)},
			sub:    100, want: 30,
		},
		{
			name:   "fixed amount cannot exceed subtotal",
			coupon: &models.Coupon{DiscountType: models.DiscountTypeFixedAmount, DiscountValue: 200},
			sub:    100, want: 100,
		},
		{
			name:   "free shipping is a zero subtotal discount",
			coupon: &models.Coupon{DiscountType: models.DiscountTypeFreeShipping, DiscountValue: 999},
			sub:    100, want: 0,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := computeDiscount(tc.coupon, tc.sub); got != tc.want {
				t.Fatalf("computeDiscount = %v; want %v", got, tc.want)
			}
		})
	}
}

func TestCouponService_Validate_EmptyCode(t *testing.T) {
	svc := NewCouponService(&mocks.CouponRepo{})
	_, err := svc.Validate(context.Background(), models.ValidateCouponReq{Code: "   "})
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v; want ErrInvalidRequest", err)
	}
}

func TestCouponService_Validate_UnknownCode(t *testing.T) {
	repo := &mocks.CouponRepo{
		GetByCodeFn: func(context.Context, string) (*models.Coupon, error) {
			return nil, models.ErrNotFound
		},
	}
	svc := NewCouponService(repo)

	res, err := svc.Validate(context.Background(), models.ValidateCouponReq{Code: "NOPE"})
	if err != nil {
		t.Fatalf("unknown code should not error, got %v", err)
	}
	if res == nil || res.IsValid {
		t.Fatalf("unknown code should be invalid; got %+v", res)
	}
}
