package site_settings

import (
	"context"
	"errors"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// Service exposes the storefront's configuration document. Get
// returns the full document; Update merges the partial request onto the current
// document and persists it under an optimistic revision check.
type Service interface {
	Get(ctx context.Context) (*SiteSettings, error)
	Update(ctx context.Context, req UpdateSiteSettingsReq) (*SiteSettings, error)
	// GiftCheckout returns normalized modular gift checkout config for orders.
	GiftCheckout(ctx context.Context) (GiftCheckoutSettings, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) Get(ctx context.Context) (*SiteSettings, error) {
	settings, err := s.repo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Get: %w", err)
	}
	return settings, nil
}

// Update reads the current document, applies the non-nil groups from the request
// (a partial update — nil groups are preserved), and persists the result when
// expected_updated_at still matches the row. A stale revision is 409 so two
// admin saves cannot clobber gift prices. The seed migration guarantees the
// singleton row exists, so Get never falls through to ErrNotFound here in practice.
func (s *service) Update(ctx context.Context, req UpdateSiteSettingsReq) (*SiteSettings, error) {
	if req.ExpectedUpdatedAt == nil || req.ExpectedUpdatedAt.IsZero() {
		return nil, revisionRequired()
	}

	cur, err := s.repo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Update: load current: %w", err)
	}

	merged := req.Apply(*cur)

	updated, err := s.repo.Update(ctx, merged, *req.ExpectedUpdatedAt)
	if err != nil {
		if errors.Is(err, models.ErrConflict) {
			return nil, revisionConflict()
		}
		return nil, fmt.Errorf("service.Update: %w", err)
	}
	return updated, nil
}

func revisionRequired() error {
	return apperr.WithFields(apperr.ErrValidation, map[string][]string{
		"expected_updated_at": {"settings revision is required"},
	})
}

func revisionConflict() error {
	return apperr.WithFields(apperr.ErrConflict, map[string][]string{
		"expected_updated_at": {"settings changed after this editor was loaded"},
	})
}

func (s *service) GiftCheckout(ctx context.Context) (GiftCheckoutSettings, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return GiftCheckoutSettings{}, err
	}
	return NormalizeGiftCheckout(settings.Gift), nil
}
