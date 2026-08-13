package hero

// ToPublic maps a slide for the storefront carousel.
func ToPublic(s *HeroSlide) PublicHeroSlideResponse {
	imageURL := ""
	if s.ImageURL != nil {
		imageURL = *s.ImageURL
	}
	return PublicHeroSlideResponse{
		ID:                s.ID,
		Eyebrow:           s.Eyebrow,
		Title:             s.Title,
		Subtitle:          s.Subtitle,
		Badge:             s.Badge,
		ImageURL:          imageURL,
		MobileImageURL:    s.MobileImageURL,
		ImageAlt:          s.ImageAlt,
		CTALabel:          s.CTALabel,
		CTAHref:           s.CTAHref,
		SecondaryCTALabel: s.SecondaryCTALabel,
		SecondaryCTAHref:  s.SecondaryCTAHref,
		Theme:             s.Theme,
		SortOrder:         s.SortOrder,
	}
}

// ToPublicList maps many slides for the public list endpoint.
func ToPublicList(slides []*HeroSlide) []PublicHeroSlideResponse {
	out := make([]PublicHeroSlideResponse, len(slides))
	for i, s := range slides {
		out[i] = ToPublic(s)
	}
	return out
}

// ToAdmin maps a slide for admin APIs.
func ToAdmin(s *HeroSlide) AdminHeroSlideResponse {
	return AdminHeroSlideResponse{
		ID:                s.ID,
		Eyebrow:           s.Eyebrow,
		Title:             s.Title,
		Subtitle:          s.Subtitle,
		Badge:             s.Badge,
		ImageURL:          s.ImageURL,
		MobileImageURL:    s.MobileImageURL,
		ImageAlt:          s.ImageAlt,
		CTALabel:          s.CTALabel,
		CTAHref:           s.CTAHref,
		SecondaryCTALabel: s.SecondaryCTALabel,
		SecondaryCTAHref:  s.SecondaryCTAHref,
		Theme:             s.Theme,
		SortOrder:         s.SortOrder,
		IsActive:          s.IsActive,
		StartsAt:          s.StartsAt,
		EndsAt:            s.EndsAt,
		CreatedAt:         s.CreatedAt,
		UpdatedAt:         s.UpdatedAt,
	}
}

// ToAdminList maps many slides for admin list.
func ToAdminList(slides []*HeroSlide) []AdminHeroSlideResponse {
	out := make([]AdminHeroSlideResponse, len(slides))
	for i, s := range slides {
		out[i] = ToAdmin(s)
	}
	return out
}
