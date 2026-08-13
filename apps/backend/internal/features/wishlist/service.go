package wishlist

import (
	"context"
	"errors"
	"fmt"

	"github.com/tiredbooy/internal/models"
		"github.com/tiredbooy/pkg/apperr"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetOrCreate(ctx context.Context, userID int64) (*Wishlist, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}

	wishlist, err := s.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("Get or Create: %w", err)
	}
	return wishlist, nil
}

func (s *Service) AddItem(ctx context.Context, wishlistID int64, req AddItemReq) error {
	if wishlistID <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.repo.AddItem(ctx, wishlistID, req)
	if err != nil {
		return apperr.ErrInternal
	}

	return nil
}

func (s *Service) RemoveItem(ctx context.Context, wishlistID int64, itemID int64) error {
	if wishlistID <= 0 || itemID <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.repo.RemoveItem(ctx, wishlistID, itemID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

func (s *Service) GetItems(ctx context.Context, wishlistID int64) ([]ItemResponse, error) {
	if wishlistID <= 0 {
		return []ItemResponse{}, apperr.ErrInvalidRequest
	}

	wishlistItems, err := s.repo.GetItems(ctx, wishlistID)
	if err != nil {
		return []ItemResponse{}, apperr.ErrInternal
	}

	if len(wishlistItems) <= 0 {
		return []ItemResponse{}, nil
	}

	return wishlistItems, nil
}

func (s *Service) HasItem(ctx context.Context, wishlistID int64, variantID int64) (bool, error) {
	if wishlistID <= 0 {
		return false, apperr.ErrInvalidRequest
	}

	hasItem, err := s.repo.HasItem(ctx, wishlistID, variantID)
	if err != nil {
		return false, apperr.ErrInternal
	}

	if !hasItem {
		return false, nil
	}

	return true, nil
}

func (s *Service) Clear(ctx context.Context, wishlistID int64) error {
	if wishlistID <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.repo.Clear(ctx, wishlistID)
	if err != nil {
		return apperr.ErrInternal
	}

	return nil
}
