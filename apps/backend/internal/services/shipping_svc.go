package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type ShippingService struct {
	zoneRepo   repositories.ShippingZoneRepository
	methodRepo repositories.ShippingMethodRepository
}

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
	if req.Name == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if len(req.RegionCodes) == 0 {
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
	if req.Name != nil && *req.Name == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if req.RegionCodes != nil && len(req.RegionCodes) == 0 {
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
	if err := validateCreateShippingMethodReq(req); err != nil {
		return nil, err
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
	if req.Name != nil && *req.Name == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if req.BaseRate != nil && *req.BaseRate < 0 {
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

// GetAvailableForCheckout is the key cross-repo method that justifies
// combining both repos into one service. Given a buyer's region code
// and order weight, it resolves all valid zones then collects every
// available shipping method across them — ready to show the buyer.
func (s *ShippingService) GetAvailableForCheckout(ctx context.Context, regionCode string, weightKg float64) ([]*models.ShippingMethod, error) {
	if regionCode == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if weightKg < 0 {
		return nil, apperr.ErrInvalidRequest
	}

	zones, err := s.zoneRepo.GetByRegionCode(ctx, regionCode)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if len(zones) == 0 {
		return []*models.ShippingMethod{}, nil
	}

	var all []*models.ShippingMethod
	for _, zone := range zones {
		methods, err := s.methodRepo.GetAvailable(ctx, zone.ID, weightKg)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		all = append(all, methods...)
	}

	return all, nil
}

// ── private validators ────────────────────────────────────────────────────────

func validateCreateShippingMethodReq(req models.CreateShippingMethodReq) error {
	if req.Name == "" {
		return apperr.ErrInvalidRequest
	}
	if req.BaseRate < 0 {
		return apperr.ErrInvalidRequest
	}
	if req.MinDeliveryDays != nil && req.MaxDeliveryDays != nil {
		if *req.MinDeliveryDays > *req.MaxDeliveryDays {
			return apperr.ErrInvalidRequest
		}
	}
	return nil
}
