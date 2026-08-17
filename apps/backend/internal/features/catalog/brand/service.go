package brand

import (
	"context"
	"fmt"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type Service interface {
	Create(ctx context.Context, req CreateBrandReq) (*Brand, error)
	GetByID(ctx context.Context, id int64) (*Brand, error)
	GetBySlug(ctx context.Context, slug string) (*Brand, error)
	GetAll(ctx context.Context, filter BrandFilter) ([]*Brand, int64, error)
	Update(ctx context.Context, id int64, req UpdateBrandReq) (*Brand, error)
	Delete(ctx context.Context, id int64) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) Create(ctx context.Context, req CreateBrandReq) (*Brand, error) {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, apperr.ErrInvalidRequest
	}
	exists, err := s.repo.ExistsByTitle(ctx, req.Title, 0)
	if err != nil {
		return nil, fmt.Errorf("service.Create: check title: %w", err)
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
		return nil, fmt.Errorf("service.Create: check slug: %w", err)
	}
	if slugExists {
		return nil, models.ErrAlreadyExists
	}
	req.Slug = &slug

	brand, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("service.Create: %w", err)
	}
	return brand, nil
}

func (s *service) GetByID(ctx context.Context, id int64) (*Brand, error) {
	brand, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("service.GetByID: %w", err)
	}
	return brand, nil
}

func (s *service) GetBySlug(ctx context.Context, slug string) (*Brand, error) {
	slug = normalizePublicSlug(slug)
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	brand, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("service.GetBySlug: %w", err)
	}
	return brand, nil
}

func (s *service) GetAll(ctx context.Context, filter BrandFilter) ([]*Brand, int64, error) {
	brands, total, err := s.repo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("service.GetAll: %w", err)
	}
	return brands, total, nil
}

func (s *service) Update(ctx context.Context, id int64, req UpdateBrandReq) (*Brand, error) {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return nil, fmt.Errorf("service.Update: %w", err)
	}

	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Title = &title
		exists, err := s.repo.ExistsByTitle(ctx, title, id)
		if err != nil {
			return nil, fmt.Errorf("service.Update: check title: %w", err)
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
			return nil, fmt.Errorf("service.Update: check slug: %w", err)
		}
		if exists {
			return nil, models.ErrAlreadyExists
		}
		req.Slug = &slug
	}

	brand, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("service.Update: %w", err)
	}
	return brand, nil
}

func (s *service) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("service.Delete: %w", err)
	}
	return nil
}
