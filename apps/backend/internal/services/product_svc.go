package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type ProductService struct {
	productRepo repositories.ProductRepository
}

func NewProductService(productRepo repositories.ProductRepository) *ProductService {
	return &ProductService{productRepo: productRepo}
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

func (s *ProductService) Create(ctx context.Context, req models.CreateProductReq) (*models.Product, error) {
	if err := validateCreateProductReq(req); err != nil {
		return nil, err
	}

	if err := s.assertSlugAndCodeUnique(ctx, *req.Slug, *req.Code); err != nil {
		return nil, err
	}

	product, err := s.productRepo.Create(ctx, req)
	if err != nil {
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

func (s *ProductService) GetAll(ctx context.Context, filter models.ProductFilter) ([]*models.Product, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	products, total, err := s.productRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return products, total, nil
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
		exists, err := s.productRepo.ExistsBySlug(ctx, *req.Slug)
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
		exists, err := s.productRepo.ExistsByCode(ctx, *req.Code)
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

	return product, nil
}

func (s *ProductService) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	if err := s.productRepo.Delete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrProductNotFound
		}
		return apperr.ErrInternal
	}

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

// assertSlugAndCodeUnique is used on Create to check both unique fields
// before hitting the DB insert, giving clean conflict errors.
func (s *ProductService) assertSlugAndCodeUnique(ctx context.Context, slug, code string) error {
	slugExists, err := s.productRepo.ExistsBySlug(ctx, slug)
	if err != nil {
		return apperr.ErrInternal
	}
	if slugExists {
		return apperr.ErrConflict
	}

	codeExists, err := s.productRepo.ExistsByCode(ctx, code)
	if err != nil {
		return apperr.ErrInternal
	}
	if codeExists {
		return apperr.ErrConflict
	}

	return nil
}

func validateCreateProductReq(req models.CreateProductReq) error {
	if req.Title == "" || (req.Slug == nil || *req.Slug == "") || (req.Code == nil || *req.Code == "") {
		return apperr.ErrInvalidRequest
	}
	if req.CategoryID == nil || *req.CategoryID <= 0 {
		return apperr.ErrInvalidRequest
	}
	return nil
}
