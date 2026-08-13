package hero

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// MediaCleaner is the subset of media lifecycle used when hero images change.
// Implemented by media.LifecycleService.
type MediaCleaner interface {
	CleanupURLs(ctx context.Context, values ...*string)
}

func mediaExpectation(current *string) models.NullablePatch[string] {
	if current == nil {
		return models.NullablePatch[string]{Set: true}
	}
	value := *current
	return models.NullablePatch[string]{Set: true, Value: &value}
}

// Service owns the home-carousel slides. Reads are split into a public
// "active only" path and an admin "all" path; writes are admin-only.
type Service interface {
	GetActive(ctx context.Context) ([]*HeroSlide, error)
	GetAll(ctx context.Context) ([]*HeroSlide, error)
	GetByID(ctx context.Context, id int64) (*HeroSlide, error)
	Create(ctx context.Context, req *HeroSlideReq) (*HeroSlide, error)
	Update(ctx context.Context, id int64, req *HeroSlideUpdateReq) (*HeroSlide, error)
	Reorder(ctx context.Context, ids []int64) error
	Delete(ctx context.Context, id int64) error
}

type service struct {
	repo  Repository
	media MediaCleaner
}

func NewService(repo Repository, media MediaCleaner) Service {
	return &service{repo: repo, media: media}
}

func (s *service) GetActive(ctx context.Context) ([]*HeroSlide, error) {
	slides, err := s.repo.GetActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.GetActive: %w", err)
	}
	return slides, nil
}

func (s *service) GetAll(ctx context.Context) ([]*HeroSlide, error) {
	slides, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.GetAll: %w", err)
	}
	return slides, nil
}

func (s *service) GetByID(ctx context.Context, id int64) (*HeroSlide, error) {
	slide, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("service.GetByID: %w", err)
	}
	return slide, nil
}

func (s *service) Create(ctx context.Context, req *HeroSlideReq) (*HeroSlide, error) {
	if err := normalizeAndValidateHeroSlideCreate(req); err != nil {
		return nil, err
	}
	slide, err := s.repo.Create(ctx, req)
	if err != nil {
		if validationErr := heroSlidePersistenceValidationError(err); validationErr != nil {
			return nil, validationErr
		}
		return nil, fmt.Errorf("service.Create: %w", err)
	}
	return slide, nil
}

func (s *service) Update(ctx context.Context, id int64, req *HeroSlideUpdateReq) (*HeroSlide, error) {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("service.Update preflight: %w", err)
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
		return nil, fmt.Errorf("service.Update: %w", err)
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

func (s *service) Reorder(ctx context.Context, ids []int64) error {
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
		return fmt.Errorf("service.Reorder: %w", err)
	}
	return nil
}

func (s *service) Delete(ctx context.Context, id int64) error {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("service.Delete media: %w", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("service.Delete: %w", err)
	}
	if s.media != nil {
		s.media.CleanupURLs(ctx, current.ImageURL, current.MobileImageURL)
	}
	return nil
}
