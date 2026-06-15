package services

import (
	"context"
	"errors"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// SubscriptionService manages recurring "cellar box" subscriptions.
type SubscriptionService struct {
	repo repositories.SubscriptionRepository
}

func NewSubscriptionService(repo repositories.SubscriptionRepository) *SubscriptionService {
	return &SubscriptionService{repo: repo}
}

func (s *SubscriptionService) Create(ctx context.Context, userID int64, req models.CreateSubscriptionReq) (*models.SubscriptionResponse, error) {
	sub, err := s.repo.Create(ctx, models.Subscription{
		UserID:        userID,
		Plan:          "cellar-box",
		Cadence:       req.Cadence,
		AddressID:     req.AddressID,
		NextRenewalAt: models.NextRenewal(time.Now(), req.Cadence),
	})
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return toSubscriptionResponse(sub), nil
}

func (s *SubscriptionService) List(ctx context.Context, userID int64) ([]models.SubscriptionResponse, error) {
	subs, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]models.SubscriptionResponse, len(subs))
	for i := range subs {
		out[i] = *toSubscriptionResponse(&subs[i])
	}
	return out, nil
}

// Update applies a lifecycle action: pause | resume | cancel | skip.
func (s *SubscriptionService) Update(ctx context.Context, userID, id int64, action string) (*models.SubscriptionResponse, error) {
	sub, err := s.repo.Get(ctx, id, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	switch action {
	case "pause":
		err = s.repo.UpdateStatus(ctx, id, userID, "paused")
	case "resume":
		err = s.repo.UpdateStatus(ctx, id, userID, "active")
	case "cancel":
		err = s.repo.UpdateStatus(ctx, id, userID, "cancelled")
	case "skip":
		// Push the next box out by one cadence.
		err = s.repo.SetNextRenewal(ctx, id, userID, models.NextRenewal(sub.NextRenewalAt, sub.Cadence))
	default:
		return nil, apperr.ErrInvalidRequest
	}
	if err != nil {
		return nil, apperr.ErrInternal
	}

	updated, err := s.repo.Get(ctx, id, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return toSubscriptionResponse(updated), nil
}

func toSubscriptionResponse(s *models.Subscription) *models.SubscriptionResponse {
	return &models.SubscriptionResponse{
		ID:            s.ID,
		Plan:          s.Plan,
		Cadence:       s.Cadence,
		Status:        s.Status,
		AddressID:     s.AddressID,
		NextRenewalAt: s.NextRenewalAt,
		CreatedAt:     s.CreatedAt,
	}
}
