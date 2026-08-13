package subscription

import (
	"context"
	"errors"
	"time"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Service manages recurring physical "cellar box" subscriptions (e-com box model).
// It does not grant unlimited catalogue access, streaming entitlements, or seats.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID int64, req CreateSubscriptionReq) (*SubscriptionResponse, error) {
	sub, err := s.repo.Create(ctx, Subscription{
		UserID:        userID,
		Plan:          PlanCellarBox,
		Cadence:       req.Cadence,
		AddressID:     req.AddressID,
		NextRenewalAt: NextRenewal(time.Now(), req.Cadence),
	})
	if err != nil {
		return nil, apperr.ErrInternal
	}
	return toSubscriptionResponse(sub), nil
}

func (s *Service) List(ctx context.Context, userID int64) ([]SubscriptionResponse, error) {
	subs, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	out := make([]SubscriptionResponse, len(subs))
	for i := range subs {
		out[i] = *toSubscriptionResponse(&subs[i])
	}
	return out, nil
}

// Update applies a lifecycle action: pause | resume | cancel | skip.
// Invalid transitions (e.g. skip while paused) return ErrInvalidRequest.
func (s *Service) Update(ctx context.Context, userID, id int64, action string) (*SubscriptionResponse, error) {
	sub, err := s.repo.Get(ctx, id, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	act := SubscriptionAction(action)
	if !AllowedAction(sub.Status, act) {
		return nil, apperr.ErrInvalidRequest
	}

	switch act {
	case SubscriptionActionPause:
		err = s.repo.UpdateStatus(ctx, id, userID, SubscriptionStatusPaused)
	case SubscriptionActionResume:
		err = s.repo.UpdateStatus(ctx, id, userID, SubscriptionStatusActive)
	case SubscriptionActionCancel:
		err = s.repo.UpdateStatus(ctx, id, userID, SubscriptionStatusCancelled)
	case SubscriptionActionSkip:
		// Push the next box out by one cadence — no payment side-effect.
		err = s.repo.SetNextRenewal(ctx, id, userID, NextRenewal(sub.NextRenewalAt, sub.Cadence))
	default:
		return nil, apperr.ErrInvalidRequest
	}
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}

	updated, err := s.repo.Get(ctx, id, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	return toSubscriptionResponse(updated), nil
}

func toSubscriptionResponse(s *Subscription) *SubscriptionResponse {
	return &SubscriptionResponse{
		ID:            s.ID,
		Plan:          s.Plan,
		Cadence:       s.Cadence,
		Status:        s.Status,
		AddressID:     s.AddressID,
		NextRenewalAt: s.NextRenewalAt,
		CreatedAt:     s.CreatedAt,
	}
}
