package alerts

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// variantFinder is the catalogue surface Create needs to snapshot price.
type variantFinder interface {
	GetByID(ctx context.Context, id int64) (*variant.ProductVariant, error)
}

// inventoryFinder is the stock surface restock create uses to confirm OOS.
type inventoryFinder interface {
	GetByVariantID(ctx context.Context, variantID int64) (*inventory.Inventory, error)
}

// Service manages a customer's back-in-stock / price-drop subscriptions.
type Service struct {
	alertRepo     Repository
	variantRepo   variantFinder
	inventoryRepo inventoryFinder
}

func NewService(
	alertRepo Repository,
	variantRepo variantFinder,
	inventoryRepo inventoryFinder,
) *Service {
	return &Service{alertRepo: alertRepo, variantRepo: variantRepo, inventoryRepo: inventoryRepo}
}

func (s *Service) Create(ctx context.Context, userID int64, req CreateProductAlertReq) (*ProductAlertResponse, error) {
	if req.ProductVariantID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if req.AlertType != AlertRestock && req.AlertType != AlertPriceDrop {
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
	// checker would fire it immediately. Missing inventory is not treated as OOS
	// (PR-053c): fail closed with conflict rather than creating a live alert.
	if req.AlertType == AlertRestock {
		inv, err := s.inventoryRepo.GetByVariantID(ctx, req.ProductVariantID)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				return nil, apperr.ErrConflict
			}
			return nil, apperr.ErrInternal
		}
		if inv.StockOnHand-inv.CommittedStock > 0 {
			return nil, apperr.ErrConflict
		}
	}

	alert, err := s.alertRepo.Create(ctx, ProductAlert{
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

func (s *Service) List(ctx context.Context, userID int64) ([]ProductAlertResponse, error) {
	alerts, err := s.alertRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]ProductAlertResponse, len(alerts))
	for i := range alerts {
		out[i] = *toProductAlertResponse(&alerts[i])
	}
	return out, nil
}

func (s *Service) Delete(ctx context.Context, userID, id int64) error {
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

func toProductAlertResponse(a *ProductAlert) *ProductAlertResponse {
	return &ProductAlertResponse{
		ID:               a.ID,
		ProductVariantID: a.ProductVariantID,
		AlertType:        a.AlertType,
		TargetPrice:      a.TargetPrice,
		NotifiedAt:       a.NotifiedAt,
		CreatedAt:        a.CreatedAt,
		ProductTitle:     a.ProductTitle,
		ProductSlug:      a.ProductSlug,
		CurrentPrice:     a.CurrentPrice,
	}
}
