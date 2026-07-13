package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// AlertService manages a customer's back-in-stock / price-drop subscriptions.
type AlertService struct {
	alertRepo     repositories.AlertRepository
	variantRepo   repositories.VariantRepository
	inventoryRepo repositories.InventoryRepository
}

func NewAlertService(
	alertRepo repositories.AlertRepository,
	variantRepo repositories.VariantRepository,
	inventoryRepo repositories.InventoryRepository,
) *AlertService {
	return &AlertService{alertRepo: alertRepo, variantRepo: variantRepo, inventoryRepo: inventoryRepo}
}

func (s *AlertService) Create(ctx context.Context, userID int64, req models.CreateProductAlertReq) (*models.ProductAlertResponse, error) {
	if req.ProductVariantID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if req.AlertType != models.AlertRestock && req.AlertType != models.AlertPriceDrop {
		return nil, apperr.ErrInvalidRequest
	}

	// Snapshot the current price as the reference for price-drop comparisons and
	// to confirm the variant exists.
	variant, err := s.variantRepo.GetByID(ctx, req.ProductVariantID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	// A restock alert only makes sense for an out-of-stock variant; otherwise the
	// checker would fire it immediately. Reject when stock is currently available.
	if req.AlertType == models.AlertRestock {
		if inv, err := s.inventoryRepo.GetByVariantID(ctx, req.ProductVariantID); err == nil {
			if inv.StockOnHand-inv.CommittedStock > 0 {
				return nil, apperr.ErrConflict
			}
		}
	}

	alert, err := s.alertRepo.Create(ctx, models.ProductAlert{
		UserID:           userID,
		ProductVariantID: req.ProductVariantID,
		AlertType:        req.AlertType,
		TargetPrice:      req.TargetPrice,
		ReferencePrice:   variant.Price,
	})
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return toProductAlertResponse(alert), nil
}

func (s *AlertService) List(ctx context.Context, userID int64) ([]models.ProductAlertResponse, error) {
	alerts, err := s.alertRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]models.ProductAlertResponse, len(alerts))
	for i := range alerts {
		out[i] = *toProductAlertResponse(&alerts[i])
	}
	return out, nil
}

func (s *AlertService) Delete(ctx context.Context, userID, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}
	if err := s.alertRepo.Delete(ctx, userID, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}
	return nil
}

func toProductAlertResponse(a *models.ProductAlert) *models.ProductAlertResponse {
	return &models.ProductAlertResponse{
		ID:               a.ID,
		ProductVariantID: a.ProductVariantID,
		AlertType:        a.AlertType,
		TargetPrice:      a.TargetPrice,
		NotifiedAt:       a.NotifiedAt,
		CreatedAt:        a.CreatedAt,
	}
}
