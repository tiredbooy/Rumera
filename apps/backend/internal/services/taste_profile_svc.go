package services

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// TasteProfileService stores and retrieves a customer's taste preferences.
type TasteProfileService struct {
	repo repositories.TasteProfileRepository
}

func NewTasteProfileService(repo repositories.TasteProfileRepository) *TasteProfileService {
	return &TasteProfileService{repo: repo}
}

// Get returns the saved preferences, or an empty (non-nil) set when the customer
// hasn't taken the quiz yet — callers can treat "empty" as "not configured".
func (s *TasteProfileService) Get(ctx context.Context, userID int64) (*models.TastePrefs, error) {
	prefs, err := s.repo.Get(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return &models.TastePrefs{}, nil
		}
		return nil, apperr.ErrInternal
	}
	return prefs, nil
}

func (s *TasteProfileService) Save(ctx context.Context, userID int64, prefs models.TastePrefs) (*models.TastePrefs, error) {
	if err := s.repo.Upsert(ctx, userID, prefs); err != nil {
		return nil, apperr.ErrInternal
	}
	return &prefs, nil
}
