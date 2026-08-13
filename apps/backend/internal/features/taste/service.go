package taste

import (
	"context"
	"errors"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Service stores and retrieves a customer's taste preferences.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get returns the saved preferences, or an empty (non-nil) set when the customer
// hasn't taken the quiz yet — callers can treat "empty" as "not configured".
func (s *Service) Get(ctx context.Context, userID int64) (*TasteProfile, error) {
	profile, err := s.repo.Get(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return &TasteProfile{}, nil
		}
		return nil, apperr.ErrInternal
	}
	return profile, nil
}

func (s *Service) Save(ctx context.Context, userID int64, input UpdateTasteProfileInput) (*TasteProfile, error) {
	profile := input.TasteProfile()
	if err := s.repo.Upsert(ctx, userID, profile); err != nil {
		return nil, apperr.ErrInternal
	}
	return &profile, nil
}
