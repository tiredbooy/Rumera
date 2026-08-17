package shipping

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Service manages shipping zones/methods and checkout quotes.
type Service struct {
	zoneRepo   ZoneRepository
	methodRepo MethodRepository
}

const (
	shippingDetailPerPage = 100
)

// NewService constructs the shipping service.
func NewService(
	zoneRepo ZoneRepository,
	methodRepo MethodRepository,
) *Service {
	return &Service{
		zoneRepo:   zoneRepo,
		methodRepo: methodRepo,
	}
}

// ── Zone ─────────────────────────────────────────────────────────────────────

func (s *Service) CreateZone(ctx context.Context, req CreateShippingZoneReq) (*ShippingZone, error) {
	if err := normalizeCreateShippingZone(&req); err != nil {
		return nil, apperr.ErrInvalidRequest
	}

	zone, err := s.zoneRepo.Create(ctx, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return zone, nil
}

func (s *Service) GetZoneByID(ctx context.Context, id int64) (*ShippingZone, error) {
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

func (s *Service) GetZoneDetail(ctx context.Context, id int64) (*ShippingZoneDetail, error) {
	zone, err := s.GetZoneByID(ctx, id)
	if err != nil {
		return nil, err
	}

	methods := make([]*ShippingMethod, 0)
	filter := ShippingMethodFilter{BaseFilter: models.BaseFilter{
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

	return &ShippingZoneDetail{Zone: zone, Methods: methods}, nil
}

func (s *Service) GetAllZones(ctx context.Context, filter ShippingZoneFilter) ([]*ShippingZone, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	zones, total, err := s.zoneRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return zones, total, nil
}

func (s *Service) UpdateZone(ctx context.Context, id int64, req UpdateShippingZoneReq) (*ShippingZone, error) {
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

func (s *Service) DeleteZone(ctx context.Context, id int64) error {
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

func (s *Service) CreateMethod(ctx context.Context, zoneID int64, req CreateShippingMethodReq) (*ShippingMethod, error) {
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

func (s *Service) GetMethodByID(ctx context.Context, id int64) (*ShippingMethod, error) {
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

func (s *Service) GetMethodsByZoneID(ctx context.Context, zoneID int64, filter ShippingMethodFilter) ([]*ShippingMethod, int64, error) {
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

func (s *Service) UpdateMethod(ctx context.Context, id int64, req UpdateShippingMethodReq) (*ShippingMethod, error) {
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

func (s *Service) DeleteMethod(ctx context.Context, id int64) error {
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
func (s *Service) GetAvailableForCheckout(ctx context.Context, regionCode string, weightKg, subtotal float64) ([]*ShippingMethodQuote, error) {
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

	quotes := make([]*ShippingMethodQuote, 0)
	seenZones := make(map[int64]struct{})
	for _, zone := range zones {
		if zone == nil || !zoneCoversRegion(zone, regionCode) {
			continue
		}
		if _, dup := seenZones[zone.ID]; dup {
			continue
		}
		seenZones[zone.ID] = struct{}{}
		methods, err := s.methodRepo.GetAvailable(ctx, zone.ID, weightKg)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		for _, method := range methods {
			quotes = append(quotes, &ShippingMethodQuote{
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
func CalculateShippingCost(method *ShippingMethod, weightKg, subtotal float64) float64 {
	if method.FreeAboveAmount != nil && subtotal >= *method.FreeAboveAmount {
		return 0
	}

	base := decimal.NewFromFloat(method.BaseRate)
	var cost decimal.Decimal
	switch method.RateType {
	case ShippingRateFlat:
		cost = base
	case ShippingRatePerKg:
		cost = base.Mul(decimal.NewFromFloat(weightKg))
	case ShippingRatePercentage:
		cost = decimal.NewFromFloat(subtotal).Mul(base).Div(decimal.NewFromInt(100))
	case ShippingRateFree:
		return 0
	default:
		return 0
	}
	return cost.Round(2).InexactFloat64()
}

// AuthorizeCheckoutMethod validates that the selected method is active, covers
// the delivery region, accepts the package weight, and returns the authoritative
// calculated cost. Callers must not re-price with BaseRate alone.
func (s *Service) AuthorizeCheckoutMethod(
	ctx context.Context,
	methodID int64,
	regionCode string,
	weightKg, subtotal float64,
) (*ShippingMethod, float64, error) {
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

// zoneCoversRegion reports whether a zone delivers to regionCode. Exact codes
// match only themselves (IR-TEH). A country code (IR) also matches any IR-*
// subdivision stored on the zone, so CreateOrder's address.Country fallback
// authorizes methods that operators configured as IR-TEH.
func zoneCoversRegion(zone *ShippingZone, regionCode string) bool {
	if zone == nil {
		return false
	}
	for _, code := range zone.RegionCodes {
		if regionCodeMatches(code, regionCode) {
			return true
		}
	}
	return false
}

func regionCodeMatches(stored, requested string) bool {
	stored = strings.ToUpper(strings.TrimSpace(stored))
	if stored == "" || requested == "" {
		return false
	}
	if stored == requested {
		return true
	}
	// Country fallback: IR matches IR-TEH. Subdivision requests stay exact.
	if !strings.Contains(requested, "-") && strings.HasPrefix(stored, requested+"-") {
		return true
	}
	return false
}
