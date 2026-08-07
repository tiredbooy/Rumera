package services

import (
	"context"
	"errors"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type ProductService struct {
	productRepo repositories.ProductRepository
	lifecycle   *MediaLifecycleService
	media       *MediaService
}

func NewProductService(
	productRepo repositories.ProductRepository,
	lifecycle *MediaLifecycleService,
	media *MediaService,
) *ProductService {
	return &ProductService{productRepo: productRepo, lifecycle: lifecycle, media: media}
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

func (s *ProductService) Create(ctx context.Context, req models.CreateProductReq) (*models.Product, error) {
	for i := range req.Variants {
		req.Variants[i].SKU = normalizeCreateVariantSKU(req.Variants[i].SKU)
		if err := validateCreateVariantReq(req.Variants[i]); err != nil {
			return nil, err
		}
	}
	if err := validateCreateProductReq(req); err != nil {
		return nil, err
	}

	// Slug and code are optional (nullable in DB, omitempty in DTO). Only check
	// uniqueness for whichever is actually provided — dereferencing them
	// unconditionally panicked when the frontend sent a title-only product.
	if err := s.assertSlugAndCodeUnique(ctx, derefOr(req.Slug, ""), derefOr(req.Code, ""), 0); err != nil {
		return nil, err
	}

	product, err := s.productRepo.Create(ctx, req)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		if errors.Is(err, models.ErrNotFound) || errors.Is(err, models.ErrInvalidState) {
			return nil, apperr.ErrInvalidRequest
		}
		return nil, apperr.ErrInternal
	}

	return product, nil
}

func (s *ProductService) GetByID(ctx context.Context, id int64) (*models.Product, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	product, err := s.productRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	return product, nil
}

func (s *ProductService) GetByIDForAdmin(ctx context.Context, id int64) (*models.Product, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	product, err := s.productRepo.GetByIDForAdmin(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	return product, nil
}

func (s *ProductService) GetBySlug(ctx context.Context, slug string) (*models.Product, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}

	product, err := s.productRepo.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}

	return product, nil
}

func (s *ProductService) GetAll(ctx context.Context, filter models.ProductFilter) ([]*models.ProductListItem, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}
	if filter.IncludeDescendants && filter.CategoryID == nil {
		return nil, 0, apperr.ErrInvalidRequest
	}

	items, total, err := s.productRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return items, total, nil
}

func (s *ProductService) Update(ctx context.Context, id int64, req models.UpdateProductReq) (*models.Product, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	// Guard unique fields only when they're actually being changed
	if req.Slug != nil {
		if *req.Slug == "" {
			return nil, apperr.ErrInvalidRequest
		}
		exists, err := s.productRepo.ExistsBySlug(ctx, *req.Slug, id)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		if exists {
			return nil, apperr.ErrConflict
		}
	}
	if req.Code != nil {
		if *req.Code == "" {
			return nil, apperr.ErrInvalidRequest
		}
		exists, err := s.productRepo.ExistsByCode(ctx, *req.Code, id)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		if exists {
			return nil, apperr.ErrConflict
		}
	}

	product, err := s.productRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	if req.TagIDs != nil {
		if err := s.productRepo.SyncTags(ctx, id, req.TagIDs); err != nil {
			return nil, apperr.ErrInternal
		}
	}

	return product, nil
}

func (s *ProductService) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	keys, err := s.lifecycle.ProductKeys(ctx, id)
	if err != nil {
		return apperr.ErrInternal
	}
	if err := s.productRepo.Delete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrProductNotFound
		}
		if errors.Is(err, models.ErrProductHasHistory) {
			return apperr.ErrProductHasHistory
		}
		return apperr.ErrInternal
	}
	s.lifecycle.CleanupKeys(ctx, keys...)

	return nil
}

// ── Tags ──────────────────────────────────────────────────────────────────────

func (s *ProductService) AttachTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if productID <= 0 || len(tagIDs) == 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.assertProductExists(ctx, productID); err != nil {
		return err
	}

	if err := s.productRepo.AttachTags(ctx, productID, tagIDs); err != nil {
		return apperr.ErrInternal
	}

	return nil
}

func (s *ProductService) DetachTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if productID <= 0 || len(tagIDs) == 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.assertProductExists(ctx, productID); err != nil {
		return err
	}

	if err := s.productRepo.DetachTags(ctx, productID, tagIDs); err != nil {
		return apperr.ErrInternal
	}

	return nil
}

// SyncTags replaces the full tag set for a product. Passing an empty
// slice is valid — it clears all tags.
func (s *ProductService) SyncTags(ctx context.Context, productID int64, tagIDs []int64) error {
	if productID <= 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.assertProductExists(ctx, productID); err != nil {
		return err
	}

	if err := s.productRepo.SyncTags(ctx, productID, tagIDs); err != nil {
		return apperr.ErrInternal
	}

	return nil
}

func (s *ProductService) GetTags(ctx context.Context, productID int64) ([]*models.Tag, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	if err := s.assertProductExists(ctx, productID); err != nil {
		return nil, err
	}

	tags, err := s.productRepo.GetTags(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return tags, nil
}

// ── Images & Variants ─────────────────────────────────────────────────────────

func (s *ProductService) GetImages(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	if err := s.assertProductExists(ctx, productID); err != nil {
		return nil, err
	}

	images, err := s.productRepo.GetImages(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return images, nil
}

func (s *ProductService) GetVariants(ctx context.Context, productID int64) ([]*models.ProductVariant, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	if err := s.assertProductExists(ctx, productID); err != nil {
		return nil, err
	}

	variants, err := s.productRepo.GetVariants(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return variants, nil
}

func (s *ProductService) GetVariantOptions(
	ctx context.Context,
	productID int64,
) (map[int64][]models.OptionValueResponse, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	options, err := s.productRepo.GetVariantOptions(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return options, nil
}

func (s *ProductService) GetVariantImages(
	ctx context.Context,
	productID int64,
) (map[int64][]*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	images, err := s.productRepo.GetVariantImages(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return images, nil
}

func (s *ProductService) GetVariantAvailableStock(ctx context.Context, productID int64) (map[int64]int, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	stock, err := s.productRepo.GetVariantAvailableStock(ctx, productID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return stock, nil
}

// ── private helpers ───────────────────────────────────────────────────────────

// assertProductExists is used by every sub-resource method (tags, images,
// variants) to give a clean ErrProductNotFound instead of a silent empty result.
func (s *ProductService) assertProductExists(ctx context.Context, id int64) error {
	exists, err := s.productRepo.ExistsByID(ctx, id)
	if err != nil {
		return apperr.ErrInternal
	}
	if !exists {
		return apperr.ErrProductNotFound
	}
	return nil
}

// assertSlugAndCodeUnique is used on Create to check the unique fields before
// hitting the DB insert, giving clean conflict errors. Slug and code are
// optional, so an empty value is skipped — multiple products may legitimately
// have a NULL slug/code.
func (s *ProductService) assertSlugAndCodeUnique(ctx context.Context, slug, code string, excludeID int64) error {
	if slug != "" {
		slugExists, err := s.productRepo.ExistsBySlug(ctx, slug, excludeID)
		if err != nil {
			return apperr.ErrInternal
		}
		if slugExists {
			return apperr.ErrConflict
		}
	}

	if code != "" {
		codeExists, err := s.productRepo.ExistsByCode(ctx, code, excludeID)
		if err != nil {
			return apperr.ErrInternal
		}
		if codeExists {
			return apperr.ErrConflict
		}
	}

	return nil
}

// validateCreateProductReq enforces the only genuinely-required invariant:
// a non-empty title. Slug, code and category_id are nullable in the DB and
// omitempty in the DTO, so the frontend may legitimately send them as null for
// a title-only product; requiring them here produced an opaque 400.
func validateCreateProductReq(req models.CreateProductReq) error {
	if req.Title == "" {
		return apperr.ErrInvalidRequest
	}
	return nil
}

// derefOr returns *p when p is non-nil, otherwise the fallback. Used to safely
// read optional pointer request fields without a nil-deref panic.
func derefOr[T any](p *T, fallback T) T {
	if p == nil {
		return fallback
	}
	return *p
}
