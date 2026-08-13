package tag

import (
	"context"
	"errors"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type Service struct {
	tagRepo Repository
}

func NewService(tagRepo Repository) *Service {
	return &Service{tagRepo: tagRepo}
}

func (s *Service) Create(ctx context.Context, req CreateTagReq) (*Tag, error) {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Slug == "" {
		req.Slug = normalizePublicSlug(req.Title)
	} else {
		req.Slug = normalizePublicSlug(req.Slug)
	}
	if req.Slug == "" {
		return nil, apperr.ErrInvalidRequest
	}

	if conflict, err := s.hasConflict(ctx, req.Title, req.Slug, 0); err != nil {
		return nil, err
	} else if conflict {
		return nil, apperr.ErrConflict
	}

	tag, err := s.tagRepo.Create(ctx, req)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}

	return tag, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*Tag, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	tag, err := s.tagRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return tag, nil
}

func (s *Service) GetAll(ctx context.Context, filter TagFilter) ([]*Tag, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	tags, total, err := s.tagRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return tags, total, nil
}

func (s *Service) Update(ctx context.Context, id int64, req UpdateTagReq) (*Tag, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	current, err := s.tagRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Title = &title
		if title != current.Title {
			exists, err := s.tagRepo.ExistsByTitle(ctx, title, id)
			if err != nil {
				return nil, apperr.ErrInternal
			}
			if exists {
				return nil, apperr.ErrConflict
			}
		}
	}
	if req.Slug != nil {
		slug := normalizePublicSlug(*req.Slug)
		if slug == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Slug = &slug
		if slug != current.Slug {
			exists, err := s.tagRepo.ExistsBySlug(ctx, slug, id)
			if err != nil {
				return nil, apperr.ErrInternal
			}
			if exists {
				return nil, apperr.ErrConflict
			}
		}
	}
	if req.Title == nil && req.Slug == nil && !req.Description.Set {
		return current, nil
	}

	tag, err := s.tagRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		if errors.Is(err, models.ErrConflict) {
			return nil, apperr.ErrConflict
		}
		return nil, apperr.ErrInternal
	}

	return tag, nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.tagRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

func (s *Service) hasConflict(ctx context.Context, title, slug string, excludeID int64) (bool, error) {
	titleExists, err := s.tagRepo.ExistsByTitle(ctx, title, excludeID)
	if err != nil {
		return false, apperr.ErrInternal
	}
	if titleExists {
		return true, nil
	}

	slugExists, err := s.tagRepo.ExistsBySlug(ctx, slug, excludeID)
	if err != nil {
		return false, apperr.ErrInternal
	}
	return slugExists, nil
}
