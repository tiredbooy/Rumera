package mappers

import "github.com/tiredbooy/internal/models"

func ToProductDetail(
	p *models.Product,
	tags []models.TagResponse,
	images []models.ImageResponse,
	variants []models.VariantResponse,
) *models.ProductDetail {
	return &models.ProductDetail{
		ID:              p.ID,
		Title:           p.Title,
		Code:            p.Code,
		Slug:            p.Slug,
		CategoryID:      p.CategoryID,
		Description:     p.Description,
		BrandID:         p.BrandID,
		CountryOfOrigin: p.CountryOfOrigin,
		ABV:             p.ABV,
		Weight:          p.Weight,
		IsActive:        p.IsActive,
		MetaTitle:       p.MetaTitle,
		MetaDescription: p.MetaDescription,
		MetaTags:        p.MetaTags,
		Tags:            tags,
		Images:          images,
		Variants:        variants,
	}
}

func ToVariantResponse(
	v *models.ProductVariant,
	options []models.OptionValueResponse,
	images []models.ImageResponse,
) models.VariantResponse {
	return models.VariantResponse{
		ID:             v.ID,
		SKU:            v.SKU,
		Price:          v.Price,
		CompareAtPrice: v.CompareAtPrice,
		IsActive:       v.IsActive,
		Options:        options,
		Images:         images,
	}
}

func ToImageResponse(i *models.ProductImage) models.ImageResponse {
	return models.ImageResponse{
		ID:         i.ID,
		ImageURL:   i.ImageURL,
		StorageKey: i.StorageKey,
		AltText:    i.AltText,
		SortOrder:  i.SortOrder,
		IsPrimary:  i.IsPrimary,
		Width:      i.Width,
		Height:     i.Height,
	}
}

func ToTagResponse(t *models.Tag) models.TagResponse {
	return models.TagResponse{
		ID:    t.ID,
		Title: t.Title,
	}
}

func ToMeiliProduct(p *models.Product, tags []string, minPrice, maxPrice float64) models.MeiliProduct {
	return models.MeiliProduct{
		ID:              p.ID,
		Title:           p.Title,
		Code:            p.Code,
		Slug:            p.Slug,
		Description:     p.Description,
		BrandID:         p.BrandID,
		CategoryID:      p.CategoryID,
		Tags:            tags,
		MetaTags:        p.MetaTags,
		MinPrice:        minPrice,
		MaxPrice:        maxPrice,
		IsActive:        p.IsActive,
		CountryOfOrigin: p.CountryOfOrigin,
	}
}
