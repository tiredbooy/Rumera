package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type WishlistService struct {
	wishlistRepo repositories.WishlistRepository
}

func NewWishlistService(wishlistRepo repositories.WishlistRepository) *WishlistService {
	return &WishlistService{wishlistRepo: wishlistRepo}
}

func (s *WishlistService) GetOrCreate(ctx context.Context, userID int64) (*models.Wishlist, error) {
	if userID <= 0 {
		return nil, apperr.ErrAccessDenied
	}

	wishlist, err := s.wishlistRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("Get or Create: %w", err)
	}
	return wishlist, nil
}

func (s *WishlistService) AddItem(ctx context.Context, wishlistID int64, req models.AddWishlistItemReq) error {
	if wishlistID <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.wishlistRepo.AddItem(ctx, wishlistID, req)
	if err != nil {
		return apperr.ErrInternal
	}

	return nil
}

func (s *WishlistService) RemoveItem(ctx context.Context, wishlistID int64, itemID int64) error {
	if wishlistID <= 0 || itemID <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.wishlistRepo.RemoveItem(ctx, wishlistID, itemID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}

	return nil
}

func (s *WishlistService) GetItems(ctx context.Context, wishlistID int64) ([]models.WishlistItemResponse, error) {
	if wishlistID <= 0 {
		return []models.WishlistItemResponse{}, apperr.ErrInvalidRequest
	}

	wishlistItems, err := s.wishlistRepo.GetItems(ctx, wishlistID)
	if err != nil {
		return []models.WishlistItemResponse{}, apperr.ErrInternal
	}

	if len(wishlistItems) <= 0 {
		return []models.WishlistItemResponse{}, nil
	}

	return wishlistItems, nil
}

func (s *WishlistService) HasItem(ctx context.Context, wishlistID int64, variantID int64) (bool, error) {
	if wishlistID <= 0 {
		return false, apperr.ErrInvalidRequest
	}

	hasItem, err := s.wishlistRepo.HasItem(ctx, wishlistID, variantID)
	if err != nil {
		return false, apperr.ErrInternal
	}

	if !hasItem {
		return false, nil
	}

	return true, nil
}

func (s *WishlistService) Clear(ctx context.Context, wishlistID int64) error {
	if wishlistID <= 0 {
		return apperr.ErrInvalidRequest
	}

	err := s.wishlistRepo.Clear(ctx, wishlistID)
	if err != nil {
		return apperr.ErrInternal
	}

	return nil
}
