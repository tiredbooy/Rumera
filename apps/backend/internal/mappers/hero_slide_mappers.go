package mappers

import "github.com/tiredbooy/internal/models"

func ToHeroSlideResponse(s *models.HeroSlide) models.HeroSlideResponse {
	return models.HeroSlideResponse{
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

func ToHeroSlideResponses(slides []*models.HeroSlide) []models.HeroSlideResponse {
	out := make([]models.HeroSlideResponse, len(slides))
	for i, s := range slides {
		out[i] = ToHeroSlideResponse(s)
	}
	return out
}
