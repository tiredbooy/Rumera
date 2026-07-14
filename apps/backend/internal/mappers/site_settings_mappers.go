package mappers

import "github.com/tiredbooy/internal/models"

func ToPublicSiteSettings(s *models.SiteSettings) models.PublicSiteSettings {
	return models.PublicSiteSettings{
		Store:       s.Store,
		Contact:     s.Contact,
		Social:      s.Social,
		Shipping:    s.Shipping,
		SEO:         s.SEO,
		Maintenance: s.Maintenance,
	}
}

func ToSiteSettingsResponse(s *models.SiteSettings) models.SiteSettingsResponse {
	return models.SiteSettingsResponse{
		Store:       s.Store,
		Contact:     s.Contact,
		Social:      s.Social,
		Shipping:    s.Shipping,
		SEO:         s.SEO,
		Maintenance: s.Maintenance,
		UpdatedAt:   s.UpdatedAt,
	}
}
