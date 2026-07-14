package mappers

import "github.com/tiredbooy/internal/models"

func ToPublicHeroSlideResponse(s *models.HeroSlide) models.PublicHeroSlideResponse {
	return models.PublicHeroSlideResponse{
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
	}
}

func ToPublicHeroSlideResponses(slides []*models.HeroSlide) []models.PublicHeroSlideResponse {
	out := make([]models.PublicHeroSlideResponse, len(slides))
	for i, s := range slides {
		out[i] = ToPublicHeroSlideResponse(s)
	}
	return out
}

func ToAdminHeroSlideResponse(s *models.HeroSlide) models.AdminHeroSlideResponse {
	return models.AdminHeroSlideResponse{
		PublicHeroSlideResponse: ToPublicHeroSlideResponse(s),
		IsActive:                s.IsActive,
		StartsAt:                s.StartsAt,
		EndsAt:                  s.EndsAt,
		CreatedAt:               s.CreatedAt,
		UpdatedAt:               s.UpdatedAt,
	}
}

func ToAdminHeroSlideResponses(slides []*models.HeroSlide) []models.AdminHeroSlideResponse {
	out := make([]models.AdminHeroSlideResponse, len(slides))
	for i, s := range slides {
		out[i] = ToAdminHeroSlideResponse(s)
	}
	return out
}
