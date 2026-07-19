package services

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

func f64(v float64) *float64 { return &v }

type couponUpdateRepo struct {
	repositories.CouponRepository
	current     *models.Coupon
	createErr   error
	createdReq  models.CreateCouponReq
	updateCalls int
}

func (r *couponUpdateRepo) ExistsByCode(context.Context, string) (bool, error) {
	return false, nil
}

func (r *couponUpdateRepo) Create(_ context.Context, req models.CreateCouponReq) (*models.Coupon, error) {
	r.createdReq = req
	if r.createErr != nil {
		return nil, r.createErr
	}
	return &models.Coupon{Code: req.Code, StartsAt: *req.StartsAt}, nil
}

func (r *couponUpdateRepo) GetByID(context.Context, int64) (*models.Coupon, error) {
	return r.current, nil
}

func (r *couponUpdateRepo) Update(_ context.Context, _ int64, req models.UpdateCouponReq) (*models.Coupon, error) {
	r.updateCalls++
	updated := *r.current
	if req.IsActive.Set {
		updated.IsActive = *req.IsActive.Value
	}
	return &updated, nil
}

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

func TestCouponDefinitionValidation(t *testing.T) {
	start := time.Now()
	end := start.Add(time.Hour)
	maxUses := 5

	cases := []struct {
		name          string
		discountType  models.DiscountType
		discountValue float64
		maxDiscount   *float64
		minOrder      float64
		maxUses       *int
		perUser       int
		applicable    *models.ApplicableTo
		expires       *time.Time
		wantError     bool
	}{
		{
			name:          "valid percentage",
			discountType:  models.DiscountTypePercentage,
			discountValue: 25,
			maxDiscount:   f64(100),
			maxUses:       &maxUses,
			perUser:       2,
			expires:       &end,
		},
		{
			name:          "percentage above one hundred",
			discountType:  models.DiscountTypePercentage,
			discountValue: 101,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "fixed amount with percentage cap",
			discountType:  models.DiscountTypeFixedAmount,
			discountValue: 10,
			maxDiscount:   f64(5),
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "fixed amount exceeds database precision",
			discountType:  models.DiscountTypeFixedAmount,
			discountValue: maxCouponMoney + 0.01,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "fixed amount exceeds decimal scale",
			discountType:  models.DiscountTypeFixedAmount,
			discountValue: 0.001,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "large fixed amount with two decimals",
			discountType:  models.DiscountTypeFixedAmount,
			discountValue: 74_685_263.71,
			perUser:       1,
		},
		{
			name:          "fixed amount with hidden extra precision",
			discountType:  models.DiscountTypeFixedAmount,
			discountValue: 1.000000000001,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "minimum order exceeds database precision",
			discountType:  models.DiscountTypePercentage,
			discountValue: 10,
			minOrder:      maxCouponMoney + 0.01,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "empty specific applicability",
			discountType:  models.DiscountTypeFreeShipping,
			discountValue: 0,
			perUser:       1,
			applicable:    &models.ApplicableTo{},
			wantError:     true,
		},
		{
			name:          "per user exceeds global limit",
			discountType:  models.DiscountTypePercentage,
			discountValue: 10,
			maxUses:       &maxUses,
			perUser:       6,
			wantError:     true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := normalizeAndValidateCoupon(
				tc.discountType,
				tc.discountValue,
				tc.maxDiscount,
				tc.minOrder,
				tc.maxUses,
				tc.perUser,
				tc.applicable,
				start,
				tc.expires,
			)
			if (err != nil) != tc.wantError {
				t.Fatalf("error = %v; wantError %v", err, tc.wantError)
			}
		})
	}
}

func TestCouponService_CreateMapsCodeConflict(t *testing.T) {
	repo := &couponUpdateRepo{createErr: models.ErrConflict}
	svc := NewCouponService(repo)

	_, err := svc.Create(context.Background(), models.CreateCouponReq{
		Code:           "SAVE",
		DiscountType:   models.DiscountTypePercentage,
		DiscountValue:  10,
		MaxUsesPerUser: 1,
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("err = %v; want ErrConflict", err)
	}
}

func TestCouponService_CreatePersistsValidatedDefaultStart(t *testing.T) {
	repo := &couponUpdateRepo{}
	svc := NewCouponService(repo)
	expiresAt := time.Now().Add(time.Hour)

	created, err := svc.Create(context.Background(), models.CreateCouponReq{
		Code:           "SAVE",
		DiscountType:   models.DiscountTypePercentage,
		DiscountValue:  10,
		MaxUsesPerUser: 1,
		ExpiresAt:      &expiresAt,
	})
	if err != nil {
		t.Fatalf("create coupon: %v", err)
	}
	if repo.createdReq.StartsAt == nil || !created.StartsAt.Equal(*repo.createdReq.StartsAt) {
		t.Fatalf("validated start = %v, created start = %v", repo.createdReq.StartsAt, created.StartsAt)
	}
}

type racingCouponRepo struct {
	repositories.CouponRepository
	current     *models.Coupon
	concurrent  *models.Coupon
	updateCalls int
}

func (r *racingCouponRepo) GetByID(context.Context, int64) (*models.Coupon, error) {
	return r.current, nil
}

func (r *racingCouponRepo) Update(context.Context, int64, models.UpdateCouponReq) (*models.Coupon, error) {
	r.updateCalls++
	if r.updateCalls == 1 {
		r.current = r.concurrent
		return nil, models.ErrConflict
	}
	return r.current, nil
}

func TestCouponService_UpdateRevalidatesAfterConcurrentChange(t *testing.T) {
	now := time.Now()
	maxUses := 10
	concurrentMaxUses := 4
	repo := &racingCouponRepo{
		current: &models.Coupon{
			ID:             10,
			DiscountType:   models.DiscountTypePercentage,
			DiscountValue:  10,
			MaxUses:        &maxUses,
			MaxUsesPerUser: 1,
			StartsAt:       now,
			UpdatedAt:      now,
		},
		concurrent: &models.Coupon{
			ID:             10,
			DiscountType:   models.DiscountTypePercentage,
			DiscountValue:  10,
			MaxUses:        &concurrentMaxUses,
			MaxUsesPerUser: 1,
			StartsAt:       now,
			UpdatedAt:      now.Add(time.Second),
		},
	}
	perUser := 5
	req := models.UpdateCouponReq{
		MaxUsesPerUser: models.NullablePatch[int]{Set: true, Value: &perUser},
	}

	_, err := NewCouponService(repo).Update(context.Background(), 10, req)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 1 {
		t.Fatalf("update calls = %d; want one rejected stale write", repo.updateCalls)
	}
}

func TestCouponService_UpdateAllowsLegacyCouponDeactivation(t *testing.T) {
	legacy := &models.Coupon{
		ID:             7,
		DiscountType:   models.DiscountTypeFixedAmount,
		DiscountValue:  0,
		MaxUsesPerUser: 1,
		IsActive:       true,
		StartsAt:       time.Now(),
	}
	repo := &couponUpdateRepo{current: legacy}
	svc := NewCouponService(repo)
	active := false
	req := models.UpdateCouponReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &active},
	}

	updated, err := svc.Update(context.Background(), legacy.ID, req)
	if err != nil {
		t.Fatalf("deactivate legacy coupon: %v", err)
	}
	if updated.IsActive || repo.updateCalls != 1 {
		t.Fatalf("updated = %+v, calls = %d; want one deactivation", updated, repo.updateCalls)
	}
}

func TestCouponService_UpdateRejectsNullForRequiredField(t *testing.T) {
	current := &models.Coupon{
		ID:             8,
		DiscountType:   models.DiscountTypePercentage,
		DiscountValue:  10,
		MaxUsesPerUser: 1,
		IsActive:       true,
		StartsAt:       time.Now(),
	}
	repo := &couponUpdateRepo{current: current}
	svc := NewCouponService(repo)
	var req models.UpdateCouponReq
	if err := json.Unmarshal([]byte(`{"is_active":null}`), &req); err != nil {
		t.Fatalf("decode update request: %v", err)
	}

	_, err := svc.Update(context.Background(), current.ID, req)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("update calls = %d; want 0", repo.updateCalls)
	}
}

func TestCouponService_UpdateValidatesReactivation(t *testing.T) {
	legacy := &models.Coupon{
		ID:             9,
		DiscountType:   models.DiscountTypeFixedAmount,
		DiscountValue:  0,
		MaxUsesPerUser: 1,
		IsActive:       false,
		StartsAt:       time.Now(),
	}
	repo := &couponUpdateRepo{current: legacy}
	svc := NewCouponService(repo)
	active := true
	req := models.UpdateCouponReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &active},
	}

	_, err := svc.Update(context.Background(), legacy.ID, req)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("update calls = %d; want 0", repo.updateCalls)
	}
}

func TestUpdateCouponReq_DistinguishesNullFromOmission(t *testing.T) {
	var req models.UpdateCouponReq
	if err := json.Unmarshal([]byte(`{"description":null,"max_uses":null,"expires_at":null}`), &req); err != nil {
		t.Fatalf("decode update request: %v", err)
	}

	if !req.Description.Set || req.Description.Value != nil {
		t.Fatalf("description patch = %+v; want explicit null", req.Description)
	}
	if !req.MaxUses.Set || req.MaxUses.Value != nil {
		t.Fatalf("max_uses patch = %+v; want explicit null", req.MaxUses)
	}
	if !req.ExpiresAt.Set || req.ExpiresAt.Value != nil {
		t.Fatalf("expires_at patch = %+v; want explicit null", req.ExpiresAt)
	}
	if req.MaxDiscountAmount.Set || req.ApplicableTo.Set {
		t.Fatal("omitted fields must remain unset")
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
