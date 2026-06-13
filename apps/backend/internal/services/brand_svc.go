package services

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

type BrandService interface {
	Create(ctx context.Context, req models.CreateBrandReq) (*models.Brand, error)
	GetByID(ctx context.Context, id int64) (*models.Brand, error)
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
	exists, err := s.repo.ExistsByTitle(ctx, req.Title)
	if err != nil {
		return nil, fmt.Errorf("brandService.Create: check title: %w", err)
	}
	if exists {
		return nil, models.ErrAlreadyExists
	}

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
		exists, err := s.repo.ExistsByTitle(ctx, *req.Title)
		if err != nil {
			return nil, fmt.Errorf("brandService.Update: check title: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
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