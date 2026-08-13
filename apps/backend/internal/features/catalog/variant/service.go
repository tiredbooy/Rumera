package variant

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type Service struct {
	variantRepo   Repository
	inventoryRepo inventory.Repository
	media         *media.LifecycleService
}

func NewService(
	variantRepo Repository,
	inventoryRepo inventory.Repository,
	media *media.LifecycleService,
) *Service {
	return &Service{
		variantRepo:   variantRepo,
		inventoryRepo: inventoryRepo,
		media:         media,
	}
}

func (s *Service) Create(ctx context.Context, productID int64, req CreateVariantReq) (*ProductVariant, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	req.SKU = NormalizeCreateSKU(req.SKU)
	if err := ValidateCreateReq(req); err != nil {
		return nil, err
	}

	variant, err := s.variantRepo.Create(ctx, productID, req)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		if errors.Is(err, models.ErrNotFound) || errors.Is(err, models.ErrInvalidState) {
			return nil, apperr.ErrInvalidRequest
		}
		return nil, apperr.ErrInternal
	}

	// Every variant must have an inventory row for admin stock tools + checkout.
	if s.inventoryRepo != nil {
		if err := s.inventoryRepo.EnsureForVariant(ctx, variant.ID); err != nil {
			return nil, apperr.ErrInternal
		}
	}

	return variant, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*ProductVariant, error) {
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

func (s *Service) Update(ctx context.Context, id int64, req UpdateVariantReq) (*ProductVariant, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if req.SKU.Set && req.SKU.Value != nil {
		normalized := strings.TrimSpace(*req.SKU.Value)
		if normalized == "" {
			return nil, apperr.ErrInvalidRequest
		}
		if utf8.RuneCountInString(normalized) > 250 {
			return nil, apperr.ErrInvalidRequest
		}
		req.SKU.Value = &normalized
	}
	if req.CompareAtPrice.Set && req.CompareAtPrice.Value != nil && *req.CompareAtPrice.Value < 0 {
		return nil, apperr.ErrInvalidRequest
	}

	variant, err := s.variantRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	return variant, nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	keys, err := s.media.VariantKeys(ctx, id)
	if err != nil {
		return apperr.ErrInternal
	}
	err = s.variantRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return apperr.ErrConflict
		}
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrProductNotFound
		}
		return apperr.ErrInternal
	}
	s.media.CleanupKeys(ctx, keys...)

	return nil
}

func (s *Service) AttachOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error {
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
		if errors.Is(err, models.ErrConflict) {
			return apperr.ErrConflict
		}
		if errors.Is(err, models.ErrNotFound) || errors.Is(err, models.ErrInvalidState) {
			return apperr.ErrInvalidRequest
		}
		return apperr.ErrInternal
	}

	return nil
}

// ReplaceOptions atomically replaces the complete option combination. An empty
// list intentionally clears it; the database enforces one value per option type.
func (s *Service) ReplaceOptions(ctx context.Context, variantID int64, optionValueIDs []int64) error {
	if variantID <= 0 {
		return apperr.ErrInvalidRequest
	}
	for _, id := range optionValueIDs {
		if id <= 0 {
			return apperr.ErrInvalidRequest
		}
	}
	if err := s.variantRepo.ReplaceOptions(ctx, variantID, optionValueIDs); err != nil {
		switch {
		case errors.Is(err, models.ErrNotFound):
			return apperr.ErrNotFound
		case errors.Is(err, models.ErrConflict):
			return apperr.ErrConflict
		case errors.Is(err, models.ErrInvalidState):
			return apperr.ErrInvalidRequest
		default:
			return apperr.ErrInternal
		}
	}
	return nil
}

func (s *Service) GetOptions(ctx context.Context, variantID int64) ([]models.OptionValueResponse, error) {
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

func (s *Service) GetImages(ctx context.Context, variantID int64) ([]*models.ProductImage, error) {
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
func ValidateCreateReq(req CreateVariantReq) error {
	if req.SKU != nil && utf8.RuneCountInString(*req.SKU) > 250 {
		return apperr.ErrInvalidRequest
	}
	if req.Price <= 0 {
		return apperr.ErrInvalidRequest
	}
	if req.CompareAtPrice != nil && *req.CompareAtPrice <= req.Price {
		return apperr.ErrInvalidRequest
	}
	return nil
}

func NormalizeCreateSKU(sku *string) *string {
	if sku == nil {
		return nil
	}
	normalized := strings.TrimSpace(*sku)
	if normalized == "" {
		return nil
	}
	return &normalized
}
