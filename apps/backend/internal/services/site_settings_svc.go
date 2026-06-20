package services

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

// SiteSettingsService exposes the storefront's configuration document. Get
// returns the full document; Update merges the partial request onto the current
// document and persists it.
type SiteSettingsService interface {
	Get(ctx context.Context) (*models.SiteSettings, error)
	Update(ctx context.Context, req models.UpdateSiteSettingsReq) (*models.SiteSettings, error)
}

type siteSettingsService struct {
	repo repositories.SiteSettingsRepository
}

func NewSiteSettingsService(repo repositories.SiteSettingsRepository) SiteSettingsService {
	return &siteSettingsService{repo: repo}
}

func (s *siteSettingsService) Get(ctx context.Context) (*models.SiteSettings, error) {
	settings, err := s.repo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("siteSettingsService.Get: %w", err)
	}
	return settings, nil
}

// Update reads the current document, applies the non-nil groups from the request
// (a partial update — nil groups are preserved), and persists the result. The
// seed migration guarantees the singleton row exists, so Get never falls through
// to ErrNotFound here in practice.
func (s *siteSettingsService) Update(ctx context.Context, req models.UpdateSiteSettingsReq) (*models.SiteSettings, error) {
	cur, err := s.repo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("siteSettingsService.Update: load current: %w", err)
	}

	merged := req.Apply(*cur)

	updated, err := s.repo.Update(ctx, merged)
	if err != nil {
		return nil, fmt.Errorf("siteSettingsService.Update: %w", err)
	}
	return updated, nil
}
