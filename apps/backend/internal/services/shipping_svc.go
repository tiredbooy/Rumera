package services

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type ShippingService struct {
	zoneRepo   repositories.ShippingZoneRepository
	methodRepo repositories.ShippingMethodRepository
}

const (
	shippingDetailPerPage = 100
)

func NewShippingService(
	zoneRepo repositories.ShippingZoneRepository,
	methodRepo repositories.ShippingMethodRepository,
) *ShippingService {
	return &ShippingService{
		zoneRepo:   zoneRepo,
		methodRepo: methodRepo,
	}
}

// ── Zone ─────────────────────────────────────────────────────────────────────

func (s *ShippingService) CreateZone(ctx context.Context, req models.CreateShippingZoneReq) (*models.ShippingZone, error) {
	if err := normalizeCreateShippingZone(&req); err != nil {
		return nil, apperr.ErrInvalidRequest
	}

	zone, err := s.zoneRepo.Create(ctx, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return zone, nil
}

func (s *ShippingService) GetZoneByID(ctx context.Context, id int64) (*models.ShippingZone, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	zone, err := s.zoneRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return zone, nil
}

func (s *ShippingService) GetZoneDetail(ctx context.Context, id int64) (*models.ShippingZoneDetail, error) {
	zone, err := s.GetZoneByID(ctx, id)
	if err != nil {
		return nil, err
	}

	methods := make([]*models.ShippingMethod, 0)
	filter := models.ShippingMethodFilter{BaseFilter: models.BaseFilter{
		PaginationParams: models.PaginationParams{Page: 1, Limit: shippingDetailPerPage},
		SortBy:           "name",
		OrderBy:          "asc",
	}}
	for {
		page, total, err := s.methodRepo.GetByZoneID(ctx, id, filter)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		methods = append(methods, page...)
		if int64(len(methods)) >= total {
			break
		}
		if len(page) == 0 {
			return nil, apperr.ErrInternal
		}
		filter.Page++
	}

	return &models.ShippingZoneDetail{Zone: zone, Methods: methods}, nil
}

func (s *ShippingService) GetAllZones(ctx context.Context, filter models.ShippingZoneFilter) ([]*models.ShippingZone, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	zones, total, err := s.zoneRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return zones, total, nil
}

func (s *ShippingService) UpdateZone(ctx context.Context, id int64, req models.UpdateShippingZoneReq) (*models.ShippingZone, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if err := normalizeUpdateShippingZone(&req); err != nil {
		return nil, apperr.ErrInvalidRequest
	}

	zone, err := s.zoneRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return zone, nil
}

func (s *ShippingService) DeleteZone(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.zoneRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

// ── Method ────────────────────────────────────────────────────────────────────

func (s *ShippingService) CreateMethod(ctx context.Context, zoneID int64, req models.CreateShippingMethodReq) (*models.ShippingMethod, error) {
	if zoneID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if err := normalizeCreateShippingMethod(&req); err != nil {
		return nil, apperr.ErrInvalidRequest
	}

	// Zone must exist before attaching a method to it
	if _, err := s.zoneRepo.GetByID(ctx, zoneID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	method, err := s.methodRepo.Create(ctx, zoneID, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return method, nil
}

func (s *ShippingService) GetMethodByID(ctx context.Context, id int64) (*models.ShippingMethod, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	method, err := s.methodRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return method, nil
}

func (s *ShippingService) GetMethodsByZoneID(ctx context.Context, zoneID int64, filter models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error) {
	if zoneID <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}
	if filter.RateType != nil && !validShippingRateType(*filter.RateType) {
		return nil, 0, apperr.ErrInvalidRequest
	}

	if _, err := s.zoneRepo.GetByID(ctx, zoneID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, 0, apperr.ErrNotFound
		}
		return nil, 0, apperr.ErrInternal
	}

	methods, total, err := s.methodRepo.GetByZoneID(ctx, zoneID, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return methods, total, nil
}

func (s *ShippingService) UpdateMethod(ctx context.Context, id int64, req models.UpdateShippingMethodReq) (*models.ShippingMethod, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	current, err := s.methodRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	if err := normalizeUpdateShippingMethod(&req, current); err != nil {
		return nil, apperr.ErrInvalidRequest
	}

	method, err := s.methodRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return method, nil
}

func (s *ShippingService) DeleteMethod(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.methodRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

// ── Checkout ──────────────────────────────────────────────────────────────────

// GetAvailableForCheckout resolves active zones and returns a deterministic,
// calculated quote for each method that accepts the submitted order weight.
func (s *ShippingService) GetAvailableForCheckout(ctx context.Context, regionCode string, weightKg, subtotal float64) ([]*models.ShippingMethodQuote, error) {
	regionCode = strings.ToUpper(strings.TrimSpace(regionCode))
	if regionCode == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if !finiteNonNegative(weightKg) || !finiteNonNegative(subtotal) {
		return nil, apperr.ErrInvalidRequest
	}

	zones, err := s.zoneRepo.GetByRegionCode(ctx, regionCode)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if len(zones) == 0 {
		return []*models.ShippingMethodQuote{}, nil
	}

	quotes := make([]*models.ShippingMethodQuote, 0)
	for _, zone := range zones {
		methods, err := s.methodRepo.GetAvailable(ctx, zone.ID, weightKg)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		for _, method := range methods {
			quotes = append(quotes, &models.ShippingMethodQuote{
				Method:        method,
				EstimatedCost: CalculateShippingCost(method, weightKg, subtotal),
			})
		}
	}

	sort.SliceStable(quotes, func(i, j int) bool {
		if quotes[i].EstimatedCost != quotes[j].EstimatedCost {
			return quotes[i].EstimatedCost < quotes[j].EstimatedCost
		}
		if quotes[i].Method.Name != quotes[j].Method.Name {
			return quotes[i].Method.Name < quotes[j].Method.Name
		}
		return quotes[i].Method.ID < quotes[j].Method.ID
	})
	return quotes, nil
}

// CalculateShippingCost is the single rate policy used by checkout quotes and
// order creation so preview and persisted shipping amounts cannot drift.
func CalculateShippingCost(method *models.ShippingMethod, weightKg, subtotal float64) float64 {
	if method.FreeAboveAmount != nil && subtotal >= *method.FreeAboveAmount {
		return 0
	}

	base := decimal.NewFromFloat(method.BaseRate)
	var cost decimal.Decimal
	switch method.RateType {
	case models.ShippingRateFlat:
		cost = base
	case models.ShippingRatePerKg:
		cost = base.Mul(decimal.NewFromFloat(weightKg))
	case models.ShippingRatePercentage:
		cost = decimal.NewFromFloat(subtotal).Mul(base).Div(decimal.NewFromInt(100))
	case models.ShippingRateFree:
		return 0
	default:
		return 0
	}
	return cost.Round(2).InexactFloat64()
}

// AuthorizeCheckoutMethod validates that the selected method is active, covers
// the delivery region, accepts the package weight, and returns the authoritative
// calculated cost. Callers must not re-price with BaseRate alone.
func (s *ShippingService) AuthorizeCheckoutMethod(
	ctx context.Context,
	methodID int64,
	regionCode string,
	weightKg, subtotal float64,
) (*models.ShippingMethod, float64, error) {
	regionCode = strings.ToUpper(strings.TrimSpace(regionCode))
	if methodID <= 0 || regionCode == "" || !finiteNonNegative(weightKg) || !finiteNonNegative(subtotal) {
		return nil, 0, apperr.ErrInvalidRequest
	}

	method, err := s.methodRepo.GetByID(ctx, methodID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, 0, models.ErrInvalidShippingMethod
		}
		return nil, 0, apperr.ErrInternal
	}
	if !method.IsActive {
		return nil, 0, models.ErrInvalidShippingMethod
	}
	if method.MaxWeightKg != nil && weightKg > *method.MaxWeightKg {
		return nil, 0, models.ErrInvalidShippingMethod
	}
	if method.ShippingZoneID <= 0 {
		return nil, 0, models.ErrInvalidShippingMethod
	}

	zone, err := s.zoneRepo.GetByID(ctx, method.ShippingZoneID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, 0, models.ErrInvalidShippingMethod
		}
		return nil, 0, apperr.ErrInternal
	}
	if !zone.IsActive || !zoneCoversRegion(zone, regionCode) {
		return nil, 0, models.ErrInvalidShippingMethod
	}

	return method, CalculateShippingCost(method, weightKg, subtotal), nil
}

func zoneCoversRegion(zone *models.ShippingZone, regionCode string) bool {
	for _, code := range zone.RegionCodes {
		if strings.EqualFold(strings.TrimSpace(code), regionCode) {
			return true
		}
	}
	return false
}
