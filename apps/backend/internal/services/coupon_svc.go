package services

import (
	"context"
	"errors"
	"strings"

	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// CouponService manages discount coupons (admin CRUD) and exposes a validate
// operation used at checkout to preview the discount for a given basket.
type CouponService struct {
	couponRepo repositories.CouponRepository
}

func NewCouponService(couponRepo repositories.CouponRepository) *CouponService {
	return &CouponService{couponRepo: couponRepo}
}

func (s *CouponService) Create(ctx context.Context, req models.CreateCouponReq) (*models.Coupon, error) {
	req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
	if req.Code == "" {
		return nil, apperr.ErrInvalidRequest
	}

	exists, err := s.couponRepo.ExistsByCode(ctx, req.Code)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if exists {
		return nil, apperr.ErrConflict
	}

	coupon, err := s.couponRepo.Create(ctx, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return coupon, nil
}

func (s *CouponService) GetByID(ctx context.Context, id int64) (*models.Coupon, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	coupon, err := s.couponRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	return coupon, nil
}

func (s *CouponService) GetAll(ctx context.Context, filter models.CouponFilter) ([]*models.Coupon, int64, error) {
	coupons, total, err := s.couponRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}
	return coupons, total, nil
}

func (s *CouponService) Update(ctx context.Context, id int64, req models.UpdateCouponReq) (*models.Coupon, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	coupon, err := s.couponRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	return coupon, nil
}

func (s *CouponService) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}
	if err := s.couponRepo.Delete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}
	return nil
}

// TotalUses returns how many times a coupon has been redeemed — used to enrich
// the admin response.
func (s *CouponService) TotalUses(ctx context.Context, couponID int64) (int, error) {
	n, err := s.couponRepo.CountUsages(ctx, couponID)
	if err != nil {
		return 0, apperr.ErrInternal
	}
	return n, nil
}

// Validate previews whether a coupon applies to the given basket and what the
// discount would be. It never mutates usage — that happens atomically at order
// creation. An unknown code yields an "invalid" result, not an error, so the
// checkout UI can render a friendly message.
func (s *CouponService) Validate(ctx context.Context, req models.ValidateCouponReq) (*models.CouponValidationResult, error) {
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return nil, apperr.ErrInvalidRequest
	}

	coupon, err := s.couponRepo.GetByCode(ctx, code)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			res := models.CouponValidationResult{IsValid: false, InvalidReason: "coupon code is invalid"}
			return &res, nil
		}
		return nil, apperr.ErrInternal
	}

	totalUses, err := s.couponRepo.CountUsages(ctx, coupon.ID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	userUses, err := s.couponRepo.CountUsagesByUser(ctx, coupon.ID, req.UserID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	result := mappers.ValidateCoupon(coupon, req, totalUses, userUses)
	return &result, nil
}
