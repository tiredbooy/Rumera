package option

import (
	"context"
	"errors"
	"strings"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateType(ctx context.Context, req CreateOptionTypeReq) (*OptionType, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.Title == "" || req.DisplayName == "" {
		return nil, apperr.ErrInvalidRequest
	}
	value, err := s.repo.CreateType(ctx, req)
	if err != nil {
		return nil, mapOptionError(err)
	}
	return value, nil
}

func (s *Service) GetType(ctx context.Context, id int64) (*OptionType, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	value, err := s.repo.GetType(ctx, id)
	if err != nil {
		return nil, mapOptionError(err)
	}
	return value, nil
}

func (s *Service) ListTypes(ctx context.Context) ([]*OptionType, error) {
	values, err := s.repo.ListTypes(ctx)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return values, nil
}

func (s *Service) UpdateType(ctx context.Context, id int64, req UpdateOptionTypeReq) (*OptionType, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Title != nil {
		value := strings.TrimSpace(*req.Title)
		if value == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Title = &value
	}
	if req.DisplayName != nil {
		value := strings.TrimSpace(*req.DisplayName)
		if value == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.DisplayName = &value
	}
	value, err := s.repo.UpdateType(ctx, id, req)
	if err != nil {
		return nil, mapOptionError(err)
	}
	return value, nil
}

func (s *Service) DeleteType(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}
	return mapOptionError(s.repo.DeleteType(ctx, id))
}

func (s *Service) CreateValue(
	ctx context.Context,
	optionTypeID int64,
	req CreateOptionValueReq,
) (*OptionValue, error) {
	if optionTypeID <= 0 || req.SortOrder < 0 {
		return nil, apperr.ErrInvalidRequest
	}
	req.Value = strings.TrimSpace(req.Value)
	if req.Value == "" {
		return nil, apperr.ErrInvalidRequest
	}
	if _, err := s.repo.GetType(ctx, optionTypeID); err != nil {
		return nil, mapOptionError(err)
	}
	value, err := s.repo.CreateValue(ctx, optionTypeID, req)
	if err != nil {
		return nil, mapOptionError(err)
	}
	return value, nil
}

func (s *Service) GetValue(ctx context.Context, id int64) (*OptionValue, error) {
	if id <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	value, err := s.repo.GetValue(ctx, id)
	if err != nil {
		return nil, mapOptionError(err)
	}
	return value, nil
}

func (s *Service) ListValues(ctx context.Context, optionTypeID int64) ([]*OptionValue, error) {
	if optionTypeID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if _, err := s.repo.GetType(ctx, optionTypeID); err != nil {
		return nil, mapOptionError(err)
	}
	values, err := s.repo.ListValues(ctx, optionTypeID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return values, nil
}

func (s *Service) UpdateValue(ctx context.Context, id int64, req UpdateOptionValueReq) (*OptionValue, error) {
	if id <= 0 || (req.SortOrder != nil && *req.SortOrder < 0) {
		return nil, apperr.ErrInvalidRequest
	}
	if req.Value != nil {
		value := strings.TrimSpace(*req.Value)
		if value == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Value = &value
	}
	value, err := s.repo.UpdateValue(ctx, id, req)
	if err != nil {
		return nil, mapOptionError(err)
	}
	return value, nil
}

func (s *Service) DeleteValue(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.ErrInvalidRequest
	}
	return mapOptionError(s.repo.DeleteValue(ctx, id))
}

func mapOptionError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, models.ErrNotFound):
		return apperr.ErrNotFound
	case errors.Is(err, models.ErrConflict):
		return apperr.ErrConflict
	default:
		return apperr.ErrInternal
	}
}
