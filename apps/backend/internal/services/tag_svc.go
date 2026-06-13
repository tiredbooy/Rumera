package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type TagService struct {
	tagRepo repositories.TagRepository
}

func NewTagService(tagRepo repositories.TagRepository) *TagService {
	return &TagService{tagRepo: tagRepo}
}

func (s *TagService) Create(ctx context.Context, req models.CreateTagReq) (*models.Tag, error) {
	if req.Title == "" {
		return nil, apperr.ErrInvalidRequest
	}

	exists, err := s.tagRepo.ExistsByTitle(ctx, req.Title)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if exists {
		return nil, apperr.ErrConflict
	}

	tag, err := s.tagRepo.Create(ctx, req)
	if err != nil {
		return nil, apperr.ErrInternal
	}

	return tag, nil
}

func (s *TagService) GetByID(ctx context.Context, id int64) (*models.Tag, error) {
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

func (s *TagService) GetAll(ctx context.Context, filter models.TagFilter) ([]*models.Tag, int64, error) {
	if filter.Limit <= 0 {
		return nil, 0, apperr.ErrInvalidRequest
	}

	tags, total, err := s.tagRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, apperr.ErrInternal
	}

	return tags, total, nil
}

func (s *TagService) Update(ctx context.Context, id int64, req models.UpdateTagReq) (*models.Tag, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}

	// If title is being changed, guard against duplicates
	if req.Title != nil {
		if *req.Title == "" {
			return nil, apperr.ErrInvalidRequest
		}
		exists, err := s.tagRepo.ExistsByTitle(ctx, *req.Title)
		if err != nil {
			return nil, apperr.ErrInternal
		}
		if exists {
			return nil, apperr.ErrConflict
		}
	}

	tag, err := s.tagRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	return tag, nil
}

func (s *TagService) Delete(ctx context.Context, id int64) error {
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
