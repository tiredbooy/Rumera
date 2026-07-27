package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// HeroSlideService owns the home-carousel slides. Reads are split into a public
// "active only" path and an admin "all" path; writes are admin-only.
type HeroSlideService interface {
	GetActive(ctx context.Context) ([]*models.HeroSlide, error)
	GetAll(ctx context.Context) ([]*models.HeroSlide, error)
	GetByID(ctx context.Context, id int64) (*models.HeroSlide, error)
	Create(ctx context.Context, req *models.HeroSlideReq) (*models.HeroSlide, error)
	Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error)
	Reorder(ctx context.Context, ids []int64) error
	Delete(ctx context.Context, id int64) error
}

type heroSlideService struct {
	repo  repositories.HeroSlideRepository
	media *MediaLifecycleService
}

func NewHeroSlideService(repo repositories.HeroSlideRepository, media *MediaLifecycleService) HeroSlideService {
	return &heroSlideService{repo: repo, media: media}
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
	if err := normalizeAndValidateHeroSlideCreate(req); err != nil {
		return nil, err
	}
	slide, err := s.repo.Create(ctx, req)
	if err != nil {
		if validationErr := heroSlidePersistenceValidationError(err); validationErr != nil {
			return nil, validationErr
		}
		return nil, fmt.Errorf("heroSlideService.Create: %w", err)
	}
	return slide, nil
}

func (s *heroSlideService) Update(ctx context.Context, id int64, req *models.HeroSlideUpdateReq) (*models.HeroSlide, error) {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("heroSlideService.Update preflight: %w", err)
	}
	if req.ImageURL.Set || req.ImageAlt.Set {
		req.ExpectedImageURL = mediaExpectation(current.ImageURL)
	}
	if req.MobileImageURL.Set {
		req.ExpectedMobileImageURL = mediaExpectation(current.MobileImageURL)
	}
	if err := normalizeAndValidateHeroSlideUpdate(req, current); err != nil {
		return nil, err
	}
	slide, err := s.repo.Update(ctx, id, req)
	if err != nil {
		if validationErr := heroSlidePersistenceValidationError(err); validationErr != nil {
			return nil, validationErr
		}
		return nil, fmt.Errorf("heroSlideService.Update: %w", err)
	}
	if s.media != nil {
		if !sameMediaURL(current.ImageURL, slide.ImageURL) {
			s.media.CleanupURLs(ctx, current.ImageURL)
		}
		if !sameMediaURL(current.MobileImageURL, slide.MobileImageURL) {
			s.media.CleanupURLs(ctx, current.MobileImageURL)
		}
	}
	return slide, nil
}

func heroSlidePersistenceValidationError(err error) error {
	switch {
	case errors.Is(err, models.ErrHeroSchedule):
		return apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"ends_at": {"must be after starts_at"},
		})
	case errors.Is(err, models.ErrHeroPrimaryCTA):
		return apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"cta_href": {"must complete a safe primary CTA pair"},
		})
	case errors.Is(err, models.ErrHeroSecondaryCTA):
		return apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"secondary_cta_href": {"must complete a safe secondary CTA pair"},
		})
	default:
		return nil
	}
}

func hasHeroImage(value *string) bool {
	return value != nil && strings.TrimSpace(*value) != ""
}

func (s *heroSlideService) Reorder(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return apperr.WithFields(apperr.ErrValidation, map[string][]string{
			"ids": {"must contain every hero slide ID"},
		})
	}
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return apperr.WithFields(apperr.ErrValidation, map[string][]string{
				"ids": {"must contain only positive IDs"},
			})
		}
		if _, duplicate := seen[id]; duplicate {
			return apperr.WithFields(apperr.ErrValidation, map[string][]string{
				"ids": {"must not contain duplicate IDs"},
			})
		}
		seen[id] = struct{}{}
	}
	if err := s.repo.Reorder(ctx, ids); err != nil {
		if errors.Is(err, models.ErrInvalidState) {
			return apperr.WithFields(apperr.ErrValidation, map[string][]string{
				"ids": {"must contain every hero slide ID exactly once"},
			})
		}
		return fmt.Errorf("heroSlideService.Reorder: %w", err)
	}
	return nil
}

func (s *heroSlideService) Delete(ctx context.Context, id int64) error {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("heroSlideService.Delete media: %w", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("heroSlideService.Delete: %w", err)
	}
	if s.media != nil {
		s.media.CleanupURLs(ctx, current.ImageURL, current.MobileImageURL)
	}
	return nil
}
