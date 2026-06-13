package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type VariantService struct {
	variantRepo repositories.VariantRepository
}

func NewVariantService(variantRepo repositories.VariantRepository) *VariantService {
	return &VariantService{variantRepo: variantRepo}
}

func (s *VariantService) Create(ctx context.Context, productID int64, req models.CreateVariantReq) (*models.ProductVariant, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if err := validateCreateVariantReq(req); err != nil {
		return nil, err
	}

	variant, err := s.variantRepo.Create(ctx, productID, req)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}

	return variant, nil
}

func (s *VariantService) GetByID(ctx context.Context, id int64) (*models.ProductVariant, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	variant, err := s.variantRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	return variant, nil
}

func (s *VariantService) Update(ctx context.Context, id int64, req models.UpdateVariantReq) (*models.ProductVariant, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	variant, err := s.variantRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	return variant, nil
}

func (s *VariantService) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.variantRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrProductNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

func (s *VariantService) AttachOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error {
	if variantID <= 0 {
		return apperr.ErrInvalidRequest
	}
	if len(optionValueIDs) == 0 {
		return apperr.ErrInvalidRequest
	}

	// Guard: variant must exist before attaching options
	if _, err := s.variantRepo.GetByID(ctx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrProductNotFound
		}
		return apperr.ErrInternal
	}

	if err := s.variantRepo.AttachOptions(ctx, variantID, optionValueIDs); err != nil {
		return apperr.ErrInternal
	}

	return nil
}

func (s *VariantService) GetOptions(ctx context.Context, variantID int64) ([]models.OptionValueResponse, error) {
	if variantID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	if _, err := s.variantRepo.GetByID(ctx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	options, err := s.variantRepo.GetOptions(ctx, variantID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return options, nil
}

func (s *VariantService) GetImages(ctx context.Context, variantID int64) ([]*models.ProductImage, error) {
	if variantID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	if _, err := s.variantRepo.GetByID(ctx, variantID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	images, err := s.variantRepo.GetImages(ctx, variantID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return images, nil
}

// validateCreateVariantReq checks business rules that don't belong in the handler.
func validateCreateVariantReq(req models.CreateVariantReq) error {
	if req.Price <= 0 {
		return apperr.ErrInvalidRequest
	}
	if req.CompareAtPrice != nil && *req.CompareAtPrice <= req.Price {
		return apperr.ErrInvalidRequest
	}
	return nil
}
