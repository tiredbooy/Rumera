package coupons

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

func f64(v float64) *float64 { return &v }

type couponUpdateRepo struct {
	current      *Coupon
	createErr    error
	getByCodeErr error
	createdReq   CreateCouponReq
	updateCalls  int
}

func (r *couponUpdateRepo) ExistsByCode(context.Context, string) (bool, error) {
	return false, nil
}

func (r *couponUpdateRepo) Create(_ context.Context, req CreateCouponReq) (*Coupon, error) {
	r.createdReq = req
	if r.createErr != nil {
		return nil, r.createErr
	}
	return &Coupon{Code: req.Code, StartsAt: *req.StartsAt}, nil
}

func (r *couponUpdateRepo) GetByID(context.Context, int64) (*Coupon, error) {
	return r.current, nil
}

func (r *couponUpdateRepo) GetByCode(context.Context, string) (*Coupon, error) {
	if r.getByCodeErr != nil {
		return nil, r.getByCodeErr
	}
	return r.current, nil
}

func (r *couponUpdateRepo) GetAll(context.Context, CouponFilter) ([]*Coupon, int64, error) {
	return nil, 0, nil
}
func (r *couponUpdateRepo) Delete(context.Context, int64) error { return nil }
func (r *couponUpdateRepo) CountUsages(context.Context, int64) (int, error) {
	return 0, nil
}
func (r *couponUpdateRepo) CountUsagesByUser(context.Context, int64, int64) (int, error) {
	return 0, nil
}
func (r *couponUpdateRepo) LockByID(context.Context, pgx.Tx, int64) error { return nil }
func (r *couponUpdateRepo) GetByIDForUpdate(context.Context, pgx.Tx, int64) (*Coupon, error) {
	return r.current, nil
}
func (r *couponUpdateRepo) CountUsagesTx(context.Context, pgx.Tx, int64) (int, error) {
	return 0, nil
}
func (r *couponUpdateRepo) CountUsagesByUserTx(context.Context, pgx.Tx, int64, int64) (int, error) {
	return 0, nil
}
func (r *couponUpdateRepo) CountUsagesByIDs(context.Context, []int64) (map[int64]int, error) {
	return map[int64]int{}, nil
}
func (r *couponUpdateRepo) Deactivate(context.Context, int64) (*Coupon, error) {
	return r.current, nil
}

func (r *couponUpdateRepo) Update(_ context.Context, _ int64, req UpdateCouponReq) (*Coupon, error) {
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
		coupon *Coupon
		sub    float64
		want   float64
	}{
		{
			name:   "fixed amount",
			coupon: &Coupon{DiscountType: DiscountTypeFixedAmount, DiscountValue: 10},
			sub:    100, want: 10,
		},
		{
			name:   "percentage",
			coupon: &Coupon{DiscountType: DiscountTypePercentage, DiscountValue: 20},
			sub:    100, want: 20,
		},
		{
			name:   "percentage capped by max discount",
			coupon: &Coupon{DiscountType: DiscountTypePercentage, DiscountValue: 50, MaxDiscountAmount: f64(30)},
			sub:    100, want: 30,
		},
		{
			name:   "fixed amount cannot exceed subtotal",
			coupon: &Coupon{DiscountType: DiscountTypeFixedAmount, DiscountValue: 200},
			sub:    100, want: 100,
		},
		{
			name:   "free shipping is a zero subtotal discount",
			coupon: &Coupon{DiscountType: DiscountTypeFreeShipping, DiscountValue: 999},
			sub:    100, want: 0,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, _ := CalculateDiscount(tc.coupon, tc.sub)
			if got != tc.want {
				t.Fatalf("CalculateDiscount = %v; want %v", got, tc.want)
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
		discountType  DiscountType
		discountValue float64
		maxDiscount   *float64
		minOrder      float64
		maxUses       *int
		perUser       int
		applicable    *ApplicableTo
		expires       *time.Time
		wantError     bool
	}{
		{
			name:          "valid percentage",
			discountType:  DiscountTypePercentage,
			discountValue: 25,
			maxDiscount:   f64(100),
			maxUses:       &maxUses,
			perUser:       2,
			expires:       &end,
		},
		{
			name:          "percentage above one hundred",
			discountType:  DiscountTypePercentage,
			discountValue: 101,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "fixed amount with percentage cap",
			discountType:  DiscountTypeFixedAmount,
			discountValue: 10,
			maxDiscount:   f64(5),
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "fixed amount exceeds database precision",
			discountType:  DiscountTypeFixedAmount,
			discountValue: maxCouponMoney + 0.01,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "fixed amount exceeds decimal scale",
			discountType:  DiscountTypeFixedAmount,
			discountValue: 0.001,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "large fixed amount with two decimals",
			discountType:  DiscountTypeFixedAmount,
			discountValue: 74_685_263.71,
			perUser:       1,
		},
		{
			name:          "fixed amount with hidden extra precision",
			discountType:  DiscountTypeFixedAmount,
			discountValue: 1.000000000001,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "minimum order exceeds database precision",
			discountType:  DiscountTypePercentage,
			discountValue: 10,
			minOrder:      maxCouponMoney + 0.01,
			perUser:       1,
			wantError:     true,
		},
		{
			name:          "empty specific applicability",
			discountType:  DiscountTypeFreeShipping,
			discountValue: 0,
			perUser:       1,
			applicable:    &ApplicableTo{},
			wantError:     true,
		},
		{
			name:          "per user exceeds global limit",
			discountType:  DiscountTypePercentage,
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
	svc := NewService(repo)

	_, err := svc.Create(context.Background(), CreateCouponReq{
		Code:           "SAVE",
		DiscountType:   DiscountTypePercentage,
		DiscountValue:  10,
		MaxUsesPerUser: 1,
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("err = %v; want ErrConflict", err)
	}
}

func TestCouponService_CreatePersistsValidatedDefaultStart(t *testing.T) {
	repo := &couponUpdateRepo{}
	svc := NewService(repo)
	expiresAt := time.Now().Add(time.Hour)

	created, err := svc.Create(context.Background(), CreateCouponReq{
		Code:           "SAVE",
		DiscountType:   DiscountTypePercentage,
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
	Repository
	current     *Coupon
	concurrent  *Coupon
	updateCalls int
}

func (r *racingCouponRepo) GetByID(context.Context, int64) (*Coupon, error) {
	return r.current, nil
}

func (r *racingCouponRepo) Update(context.Context, int64, UpdateCouponReq) (*Coupon, error) {
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
		current: &Coupon{
			ID:             10,
			DiscountType:   DiscountTypePercentage,
			DiscountValue:  10,
			MaxUses:        &maxUses,
			MaxUsesPerUser: 1,
			StartsAt:       now,
			UpdatedAt:      now,
		},
		concurrent: &Coupon{
			ID:             10,
			DiscountType:   DiscountTypePercentage,
			DiscountValue:  10,
			MaxUses:        &concurrentMaxUses,
			MaxUsesPerUser: 1,
			StartsAt:       now,
			UpdatedAt:      now.Add(time.Second),
		},
	}
	perUser := 5
	req := UpdateCouponReq{
		MaxUsesPerUser: models.NullablePatch[int]{Set: true, Value: &perUser},
	}

	_, err := NewService(repo).Update(context.Background(), 10, req)
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v; want ErrInvalidRequest", err)
	}
	if repo.updateCalls != 1 {
		t.Fatalf("update calls = %d; want one rejected stale write", repo.updateCalls)
	}
}

func TestCouponService_UpdateAllowsLegacyCouponDeactivation(t *testing.T) {
	legacy := &Coupon{
		ID:             7,
		DiscountType:   DiscountTypeFixedAmount,
		DiscountValue:  0,
		MaxUsesPerUser: 1,
		IsActive:       true,
		StartsAt:       time.Now(),
	}
	repo := &couponUpdateRepo{current: legacy}
	svc := NewService(repo)
	active := false
	req := UpdateCouponReq{
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
	current := &Coupon{
		ID:             8,
		DiscountType:   DiscountTypePercentage,
		DiscountValue:  10,
		MaxUsesPerUser: 1,
		IsActive:       true,
		StartsAt:       time.Now(),
	}
	repo := &couponUpdateRepo{current: current}
	svc := NewService(repo)
	var req UpdateCouponReq
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
	legacy := &Coupon{
		ID:             9,
		DiscountType:   DiscountTypeFixedAmount,
		DiscountValue:  0,
		MaxUsesPerUser: 1,
		IsActive:       false,
		StartsAt:       time.Now(),
	}
	repo := &couponUpdateRepo{current: legacy}
	svc := NewService(repo)
	active := true
	req := UpdateCouponReq{
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
	var req UpdateCouponReq
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
	svc := NewService(&couponUpdateRepo{})
	_, err := svc.Validate(context.Background(), ValidateCouponReq{Code: "   "})
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v; want ErrInvalidRequest", err)
	}
}

func TestCouponService_Validate_UnknownCode(t *testing.T) {
	repo := &couponUpdateRepo{getByCodeErr: models.ErrNotFound}
	svc := NewService(repo)

	res, err := svc.Validate(context.Background(), ValidateCouponReq{Code: "NOPE"})
	if err != nil {
		t.Fatalf("unknown code should not error, got %v", err)
	}
	if res == nil || res.IsValid {
		t.Fatalf("unknown code should be invalid; got %+v", res)
	}
}
