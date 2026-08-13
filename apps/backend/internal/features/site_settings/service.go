package site_settings

import (
	"context"
	"fmt"
)

// Service exposes the storefront's configuration document. Get
// returns the full document; Update merges the partial request onto the current
// document and persists it.
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
// (a partial update — nil groups are preserved), and persists the result. The
// seed migration guarantees the singleton row exists, so Get never falls through
// to ErrNotFound here in practice.
func (s *service) Update(ctx context.Context, req UpdateSiteSettingsReq) (*SiteSettings, error) {
	cur, err := s.repo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Update: load current: %w", err)
	}

	merged := req.Apply(*cur)

	updated, err := s.repo.Update(ctx, merged)
	if err != nil {
		return nil, fmt.Errorf("service.Update: %w", err)
	}
	return updated, nil
}

func (s *service) GiftCheckout(ctx context.Context) (GiftCheckoutSettings, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return GiftCheckoutSettings{}, err
	}
	return NormalizeGiftCheckout(settings.Gift), nil
}
