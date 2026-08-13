package site_settings

// ToPublic maps the full document to the storefront-safe projection.
func ToPublic(s *SiteSettings) PublicSiteSettings {
	gift := NormalizeGiftCheckout(s.Gift)
	return PublicSiteSettings{
		Store:       s.Store,
		Contact:     s.Contact,
		Social:      s.Social,
		Shipping:    s.Shipping,
		SEO:         s.SEO,
		Maintenance: s.Maintenance,
		Gift:        gift,
	}
}

// ToResponse maps the full document for the admin API (includes UpdatedAt).
func ToResponse(s *SiteSettings) SiteSettingsResponse {
	gift := NormalizeGiftCheckout(s.Gift)
	return SiteSettingsResponse{
		Store:       s.Store,
		Contact:     s.Contact,
		Social:      s.Social,
		Shipping:    s.Shipping,
		SEO:         s.SEO,
		Maintenance: s.Maintenance,
		Gift:        gift,
		UpdatedAt:   s.UpdatedAt,
	}
}
