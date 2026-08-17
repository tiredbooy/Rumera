package coupons

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// CouponService manages discount coupons (admin CRUD) and exposes a validate
// operation used at checkout to preview the discount for a given basket.
type Service struct {
	couponRepo Repository
	cart       CartBasketLookup
}

const (
	maxCouponMoney          = 99_999_999.99
	maxCouponUpdateAttempts = 3
)

func NewService(couponRepo Repository) *Service {
	return &Service{couponRepo: couponRepo}
}

// CartBasketItem is one cart line used to fill omitted Validate fields.
type CartBasketItem struct {
	ProductID  int64
	CategoryID *int64
	LineTotal  float64
}

// CartBasketLookup loads the caller's cart lines for Validate when the
// client omitted product_ids / category_ids and/or sent a zero subtotal.
type CartBasketLookup interface {
	BasketForUser(ctx context.Context, userID int64) ([]CartBasketItem, error)
}

// WithCart attaches an optional cart lookup. Nil is safe (client IDs only).
// Production New() wires cart.Repository; tests use a stub.
func (s *Service) WithCart(lookup CartBasketLookup) *Service {
	s.cart = lookup
	return s
}

func (s *Service) Create(ctx context.Context, req CreateCouponReq) (*Coupon, error) {
	req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
	if req.Code == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if req.StartsAt == nil {
		startsAt := time.Now()
		req.StartsAt = &startsAt
	}
	if err := normalizeAndValidateCoupon(
		req.DiscountType,
		req.DiscountValue,
		req.MaxDiscountAmount,
		req.MinOrderAmount,
		req.MaxUses,
		req.MaxUsesPerUser,
		req.ApplicableTo,
		*req.StartsAt,
		req.ExpiresAt,
	); err != nil {
		return nil, err
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
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}
	return coupon, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*Coupon, error) {
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

func (s *Service) GetAll(ctx context.Context, filter CouponFilter) ([]*Coupon, int64, error) {
	if filter.DiscountType != nil && !validDiscountType(*filter.DiscountType) {
		return nil, 0, apperr.ErrInvalidRequest
	}
	coupons, total, err := s.couponRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}
	return coupons, total, nil
}

func (s *Service) Update(ctx context.Context, id int64, req UpdateCouponReq) (*Coupon, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	return s.update(ctx, id, req, 0)
}

func (s *Service) update(ctx context.Context, id int64, req UpdateCouponReq, attempt int) (*Coupon, error) {
	current, err := s.couponRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	if (req.DiscountValue.Set && req.DiscountValue.Value == nil) ||
		(req.MinOrderAmount.Set && req.MinOrderAmount.Value == nil) ||
		(req.MaxUsesPerUser.Set && req.MaxUsesPerUser.Value == nil) ||
		(req.IsActive.Set && req.IsActive.Value == nil) ||
		(req.StartsAt.Set && req.StartsAt.Value == nil) {
		return nil, apperr.ErrInvalidRequest
	}

	discountValue := current.DiscountValue
	if req.DiscountValue.Set {
		discountValue = *req.DiscountValue.Value
	}
	maxDiscount := current.MaxDiscountAmount
	if req.MaxDiscountAmount.Set {
		maxDiscount = req.MaxDiscountAmount.Value
	}
	minOrder := current.MinOrderAmount
	if req.MinOrderAmount.Set {
		minOrder = *req.MinOrderAmount.Value
	}
	maxUses := current.MaxUses
	if req.MaxUses.Set {
		maxUses = req.MaxUses.Value
	}
	maxUsesPerUser := current.MaxUsesPerUser
	if req.MaxUsesPerUser.Set {
		maxUsesPerUser = *req.MaxUsesPerUser.Value
	}
	applicableTo := current.ApplicableTo
	if req.ApplicableTo.Set {
		applicableTo = req.ApplicableTo.Value
	}
	startsAt := current.StartsAt
	if req.StartsAt.Set {
		startsAt = *req.StartsAt.Value
	}
	expiresAt := current.ExpiresAt
	if req.ExpiresAt.Set {
		expiresAt = req.ExpiresAt.Value
	}

	definitionChanged :=
		req.DiscountValue.Set ||
			req.MaxDiscountAmount.Set ||
			req.MinOrderAmount.Set ||
			req.MaxUses.Set ||
			req.MaxUsesPerUser.Set ||
			req.ApplicableTo.Set ||
			req.StartsAt.Set ||
			req.ExpiresAt.Set
	activating := req.IsActive.Set && *req.IsActive.Value && !current.IsActive
	if definitionChanged || activating {
		if err := normalizeAndValidateCoupon(
			current.DiscountType,
			discountValue,
			maxDiscount,
			minOrder,
			maxUses,
			maxUsesPerUser,
			applicableTo,
			startsAt,
			expiresAt,
		); err != nil {
			return nil, err
		}
	}

	req.ExpectedUpdatedAt = current.UpdatedAt
	coupon, err := s.couponRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		if errors.Is(err, models.ErrConflict) {
			if attempt+1 < maxCouponUpdateAttempts {
				return s.update(ctx, id, req, attempt+1)
			}
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}
	return coupon, nil
}

func normalizeAndValidateCoupon(
	discountType DiscountType,
	discountValue float64,
	maxDiscount *float64,
	minOrder float64,
	maxUses *int,
	maxUsesPerUser int,
	applicableTo *ApplicableTo,
	startsAt time.Time,
	expiresAt *time.Time,
) error {
	if !validCouponMoney(minOrder) || minOrder < 0 || minOrder > maxCouponMoney || maxUsesPerUser < 1 || maxUsesPerUser > math.MaxInt32 {
		return apperr.ErrInvalidRequest
	}
	if maxUses != nil && (*maxUses < 1 || *maxUses > math.MaxInt32 || maxUsesPerUser > *maxUses) {
		return apperr.ErrInvalidRequest
	}
	if expiresAt != nil && !expiresAt.After(startsAt) {
		return apperr.ErrInvalidRequest
	}

	switch discountType {
	case DiscountTypePercentage:
		if !validCouponMoney(discountValue) || discountValue < 0 || discountValue > 100 {
			return apperr.ErrInvalidRequest
		}
		if maxDiscount != nil && (!validCouponMoney(*maxDiscount) || *maxDiscount <= 0 || *maxDiscount > maxCouponMoney) {
			return apperr.ErrInvalidRequest
		}
	case DiscountTypeFixedAmount:
		if !validCouponMoney(discountValue) || discountValue <= 0 || discountValue > maxCouponMoney || maxDiscount != nil {
			return apperr.ErrInvalidRequest
		}
	case DiscountTypeFreeShipping:
		if discountValue != 0 || maxDiscount != nil {
			return apperr.ErrInvalidRequest
		}
	default:
		return apperr.ErrInvalidRequest
	}

	if applicableTo != nil {
		categories, ok := uniquePositiveIDs(applicableTo.CategoryIDs)
		if !ok {
			return apperr.ErrInvalidRequest
		}
		products, ok := uniquePositiveIDs(applicableTo.ProductIDs)
		if !ok || len(categories)+len(products) == 0 {
			return apperr.ErrInvalidRequest
		}
		applicableTo.CategoryIDs = categories
		applicableTo.ProductIDs = products
	}

	return nil
}

func validCouponMoney(value float64) bool {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return false
	}
	return decimal.NewFromFloat(value).Exponent() >= -2
}

func validDiscountType(discountType DiscountType) bool {
	switch discountType {
	case DiscountTypePercentage, DiscountTypeFixedAmount, DiscountTypeFreeShipping:
		return true
	default:
		return false
	}
}

func uniquePositiveIDs(ids []int64) ([]int64, bool) {
	if len(ids) == 0 {
		return nil, true
	}
	seen := make(map[int64]struct{}, len(ids))
	out := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, false
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out, true
}

// Delete soft-deactivates a coupon. Redemption history is preserved; hard
// deletion is intentionally not offered.
func (s *Service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}
	if _, err := s.couponRepo.Deactivate(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}
	return nil
}

// Deactivate is the explicit admin soft-delete path and returns the updated row.
func (s *Service) Deactivate(ctx context.Context, id int64) (*Coupon, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	coupon, err := s.couponRepo.Deactivate(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	return coupon, nil
}

// UsageCounts returns redemption totals for a set of coupon ids.
func (s *Service) UsageCounts(ctx context.Context, ids []int64) (map[int64]int, error) {
	counts, err := s.couponRepo.CountUsagesByIDs(ctx, ids)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return counts, nil
}

// TotalUses returns how many times a coupon has been redeemed — used to enrich
// the admin response.
func (s *Service) TotalUses(ctx context.Context, couponID int64) (int, error) {
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
//
// When product_ids and category_ids are both empty, and/or order_subtotal is
// 0, the caller's cart is loaded (if a CartBasketLookup is attached) so scoped
// coupons preview the same basket CreateOrder will redeem against. An empty
// cart is validated as an empty basket — not a 500.
func (s *Service) Validate(ctx context.Context, req ValidateCouponReq) (*CouponValidationResult, error) {
	code := NormalizeCouponCode(req.Code)
	if code == "" {
		return nil, apperr.ErrInvalidRequest
	}
	req.Code = code

	if err := s.fillBasketFromCart(ctx, &req); err != nil {
		return nil, err
	}

	coupon, err := s.couponRepo.GetByCode(ctx, code)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			res := CouponValidationResult{IsValid: false, InvalidReason: "coupon code is invalid"}
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

	result := ValidateCouponBusiness(coupon, req, totalUses, userUses)
	return &result, nil
}

func (s *Service) fillBasketFromCart(ctx context.Context, req *ValidateCouponReq) error {
	if s.cart == nil || req.UserID <= 0 {
		return nil
	}
	idsOmitted := len(req.ProductIDs) == 0 && len(req.CategoryIDs) == 0
	subtotalOmitted := req.OrderSubtotal == 0
	if !idsOmitted && !subtotalOmitted {
		return nil
	}

	items, err := s.cart.BasketForUser(ctx, req.UserID)
	if err != nil {
		return apperr.ErrInternal
	}
	if idsOmitted {
		req.ProductIDs, req.CategoryIDs = deriveBasketIDs(items)
	}
	if subtotalOmitted {
		req.OrderSubtotal = deriveBasketSubtotal(items)
	}
	return nil
}

func deriveBasketIDs(items []CartBasketItem) (productIDs, categoryIDs []int64) {
	seenP := make(map[int64]struct{}, len(items))
	seenC := make(map[int64]struct{}, len(items))
	for _, it := range items {
		if it.ProductID > 0 {
			if _, ok := seenP[it.ProductID]; !ok {
				seenP[it.ProductID] = struct{}{}
				productIDs = append(productIDs, it.ProductID)
			}
		}
		if it.CategoryID != nil && *it.CategoryID > 0 {
			cid := *it.CategoryID
			if _, ok := seenC[cid]; !ok {
				seenC[cid] = struct{}{}
				categoryIDs = append(categoryIDs, cid)
			}
		}
	}
	return productIDs, categoryIDs
}

func deriveBasketSubtotal(items []CartBasketItem) float64 {
	var sum float64
	for _, it := range items {
		sum += it.LineTotal
	}
	return sum
}
