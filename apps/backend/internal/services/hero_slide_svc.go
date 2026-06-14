package services

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

// HeroSlideService owns the home-carousel slides. Reads are split into a public
// "active only" path and an admin "all" path; writes are admin-only.
type HeroSlideService interface {
	GetActive(ctx context.Context) ([]*models.HeroSlide, error)
	GetAll(ctx context.Context) ([]*models.HeroSlide, error)
	GetByID(ctx context.Context, id int64) (*models.HeroSlide, error)
	Create(ctx context.Context, req *models.HeroSlideReq) (*models.HeroSlide, error)
	Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error)
	Delete(ctx context.Context, id int64) error
}

type heroSlideService struct {
	repo repositories.HeroSlideRepository
}

func NewHeroSlideService(repo repositories.HeroSlideRepository) HeroSlideService {
	return &heroSlideService{repo: repo}
}

func (s *heroSlideService) GetActive(ctx context.Context) ([]*models.HeroSlide, error) {
	slides, err := s.repo.GetActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("heroSlideService.GetActive: %w", err)
	}
	return slides, nil
}

func (s *heroSlideService) GetAll(ctx context.Context) ([]*models.HeroSlide, error) {
	slides, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("heroSlideService.GetAll: %w", err)
	}
	return slides, nil
}

func (s *heroSlideService) GetByID(ctx context.Context, id int64) (*models.HeroSlide, error) {
	slide, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("heroSlideService.GetByID: %w", err)
	}
	return slide, nil
}

func (s *heroSlideService) Create(ctx context.Context, req *models.HeroSlideReq) (*models.HeroSlide, error) {
	slide, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("heroSlideService.Create: %w", err)
	}
	return slide, nil
}

func (s *heroSlideService) Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error) {
	slide, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("heroSlideService.Update: %w", err)
	}
	return slide, nil
}

func (s *heroSlideService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("heroSlideService.Delete: %w", err)
	}
	return nil
}
