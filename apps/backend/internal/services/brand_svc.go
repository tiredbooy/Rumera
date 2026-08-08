package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type BrandService interface {
	Create(ctx context.Context, req models.CreateBrandReq) (*models.Brand, error)
	GetByID(ctx context.Context, id int64) (*models.Brand, error)
	GetBySlug(ctx context.Context, slug string) (*models.Brand, error)
	GetAll(ctx context.Context, filter models.BrandFilter) ([]*models.Brand, int64, error)
	Update(ctx context.Context, id int64, req models.UpdateBrandReq) (*models.Brand, error)
	Delete(ctx context.Context, id int64) error
}

type brandService struct {
	repo repositories.BrandRepository
}

func NewBrandService(repo repositories.BrandRepository) BrandService {
	return &brandService{repo: repo}
}

func (s *brandService) Create(ctx context.Context, req models.CreateBrandReq) (*models.Brand, error) {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, apperr.ErrInvalidRequest
	}
	exists, err := s.repo.ExistsByTitle(ctx, req.Title)
	if err != nil {
		return nil, fmt.Errorf("brandService.Create: check title: %w", err)
	}
	if exists {
		return nil, models.ErrAlreadyExists
	}
	slugSource := req.Title
	if req.Slug != nil && strings.TrimSpace(*req.Slug) != "" {
		slugSource = *req.Slug
	}
	slug := normalizePublicSlug(slugSource)
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	slugExists, err := s.repo.ExistsBySlug(ctx, slug, 0)
	if err != nil {
		return nil, fmt.Errorf("brandService.Create: check slug: %w", err)
	}
	if slugExists {
		return nil, models.ErrAlreadyExists
	}
	req.Slug = &slug

	brand, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("brandService.Create: %w", err)
	}
	return brand, nil
}

func (s *brandService) GetByID(ctx context.Context, id int64) (*models.Brand, error) {
	brand, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("brandService.GetByID: %w", err)
	}
	return brand, nil
}

func (s *brandService) GetBySlug(ctx context.Context, slug string) (*models.Brand, error) {
	slug = normalizePublicSlug(slug)
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	brand, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("brandService.GetBySlug: %w", err)
	}
	return brand, nil
}

func (s *brandService) GetAll(ctx context.Context, filter models.BrandFilter) ([]*models.Brand, int64, error) {
	brands, total, err := s.repo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("brandService.GetAll: %w", err)
	}
	return brands, total, nil
}

func (s *brandService) Update(ctx context.Context, id int64, req models.UpdateBrandReq) (*models.Brand, error) {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return nil, fmt.Errorf("brandService.Update: %w", err)
	}

	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Title = &title
		exists, err := s.repo.ExistsByTitle(ctx, title)
		if err != nil {
			return nil, fmt.Errorf("brandService.Update: check title: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
	}
	if req.Slug != nil {
		slug := normalizePublicSlug(*req.Slug)
		if slug == "" {
			return nil, apperr.ErrInvalidRequest
		}
		exists, err := s.repo.ExistsBySlug(ctx, slug, id)
		if err != nil {
			return nil, fmt.Errorf("brandService.Update: check slug: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
		req.Slug = &slug
	}

	brand, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("brandService.Update: %w", err)
	}
	return brand, nil
}

func (s *brandService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("brandService.Delete: %w", err)
	}
	return nil
}
