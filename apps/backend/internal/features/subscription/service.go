package subscription

import (
	"context"
	"errors"
	"time"

	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// addressLookup loads a customer address scoped to the caller (same as checkout).
type addressLookup interface {
	GetByID(ctx context.Context, id, userID int64) (*addresses.Address, error)
}

// Service manages recurring physical "cellar box" subscriptions (e-com box model).
// It does not grant unlimited catalogue access, streaming entitlements, or seats.
type Service struct {
	repo      Repository
	addresses addressLookup
}

func NewService(repo Repository, addresses addressLookup) *Service {
	return &Service{repo: repo, addresses: addresses}
}

func (s *Service) Create(ctx context.Context, userID int64, req CreateSubscriptionReq) (*SubscriptionResponse, error) {
	if req.AddressID != nil {
		if err := s.requireOwnedAddress(ctx, *req.AddressID, userID); err != nil {
			return nil, err
		}
	}
	if err := s.rejectIfActiveBox(ctx, userID); err != nil {
		return nil, err
	}
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

// Update applies an optional lifecycle action (pause|resume|cancel|skip) and/or
// a ship-to address_id. Address-only skips the status machine. No payment
// side-effect. address_id must belong to the caller (addresses.GetByID).
func (s *Service) Update(ctx context.Context, userID, id int64, req UpdateSubscriptionReq) (*SubscriptionResponse, error) {
	if !req.HasPatch() {
		return nil, apperr.ErrInvalidRequest
	}

	sub, err := s.repo.Get(ctx, id, userID)
	if err != nil {
		return nil, mapRepoErr(err)
	}

	if req.Action != "" {
		if !AllowedAction(sub.Status, req.Action) {
			return nil, apperr.ErrInvalidRequest
		}
		switch req.Action {
		case SubscriptionActionPause:
			err = s.repo.UpdateStatus(ctx, id, userID, SubscriptionStatusPaused)
		case SubscriptionActionResume:
			if err := s.rejectIfActiveBox(ctx, userID); err != nil {
				return nil, err
			}
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
			return nil, mapRepoErr(err)
		}
	}

	if req.AddressID != nil {
		if err := s.requireOwnedAddress(ctx, *req.AddressID, userID); err != nil {
			return nil, err
		}
		if err := s.repo.UpdateAddress(ctx, id, userID, *req.AddressID); err != nil {
			return nil, mapRepoErr(err)
		}
	}

	updated, err := s.repo.Get(ctx, id, userID)
	if err != nil {
		return nil, mapRepoErr(err)
	}
	return toSubscriptionResponse(updated), nil
}

// rejectIfActiveBox returns 409 when the customer already has a status=active
// cellar-box (PR-057b). Paused / cancelled rows do not occupy the slot.
func (s *Service) rejectIfActiveBox(ctx context.Context, userID int64) error {
	existing, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return apperr.ErrInternal
	}
	for i := range existing {
		if existing[i].Plan == PlanCellarBox && existing[i].Status == SubscriptionStatusActive {
			return apperr.ErrConflict
		}
	}
	return nil
}

// requireOwnedAddress rejects address_id < 1 and ids that are missing or
// belong to another user (GetByID is user-scoped — same as checkout).
func (s *Service) requireOwnedAddress(ctx context.Context, addressID, userID int64) error {
	if addressID < 1 {
		return apperr.ErrInvalidRequest
	}
	if s.addresses == nil {
		return apperr.ErrInternal
	}
	if _, err := s.addresses.GetByID(ctx, addressID, userID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return apperr.ErrInternal
	}
	return nil
}

func mapRepoErr(err error) error {
	switch {
	case errors.Is(err, models.ErrNotFound):
		return apperr.ErrNotFound
	case errors.Is(err, errInvalidAddressID):
		return apperr.ErrInvalidRequest
	default:
		return apperr.ErrInternal
	}
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
