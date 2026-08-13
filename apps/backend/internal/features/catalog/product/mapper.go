package product

import (
	"github.com/tiredbooy/internal/features/catalog/tag"
	catvariant "github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/searchtext"
)

func ToProductDetail(
	p *Product,
	tags []models.TagResponse,
	images []models.ImageResponse,
	variants []models.VariantResponse,
) *models.ProductDetail {
	if images == nil {
		images = []models.ImageResponse{}
	}
	if variants == nil {
		variants = []models.VariantResponse{}
	}
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
		UpdatedAt:       p.UpdatedAt,
		Tags:            tags,
		Images:          images,
		Variants:        variants,
	}
}

func ToVariantResponse(
	v *catvariant.ProductVariant,
	options []models.OptionValueResponse,
	images []models.ImageResponse,
	availableStock *int,
) models.VariantResponse {
	if options == nil {
		options = []models.OptionValueResponse{}
	}
	if images == nil {
		images = []models.ImageResponse{}
	}
	return models.VariantResponse{
		ID:             v.ID,
		SKU:            v.SKU,
		Price:          v.Price,
		CompareAtPrice: v.CompareAtPrice,
		IsActive:       v.IsActive,
		AvailableStock: availableStock,
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

func ToTagResponse(t *tag.Tag) models.TagResponse {
	return models.TagResponse{
		ID:    t.ID,
		Title: t.Title,
	}
}

// ToMeiliProduct builds a Meilisearch document from a product row plus joined
// brand/category titles and price band. Search fields use searchtext.Normalize
// (lockstep with rumera_search_normalize / PH-030a).
func ToMeiliProduct(
	p *Product,
	brandTitle, categoryTitle *string,
	tags []string,
	minPrice, maxPrice float64,
) models.MeiliProduct {
	if tags == nil {
		tags = []string{}
	}
	doc := models.MeiliProduct{
		ID:              p.ID,
		Title:           p.Title,
		Code:            p.Code,
		Slug:            p.Slug,
		Description:     p.Description,
		BrandID:         p.BrandID,
		BrandTitle:      brandTitle,
		CategoryID:      p.CategoryID,
		CategoryTitle:   categoryTitle,
		Tags:            tags,
		MetaTags:        p.MetaTags,
		CountryOfOrigin: p.CountryOfOrigin,
		IsActive:        p.IsActive,
		MinPrice:        minPrice,
		MaxPrice:        maxPrice,
		TitleSearch:     searchtext.Normalize(p.Title),
	}
	if p.Description != nil {
		doc.DescriptionSearch = searchtext.Normalize(*p.Description)
	}
	if brandTitle != nil {
		doc.BrandSearch = searchtext.Normalize(*brandTitle)
	}
	if categoryTitle != nil {
		doc.CategorySearch = searchtext.Normalize(*categoryTitle)
	}
	return doc
}
