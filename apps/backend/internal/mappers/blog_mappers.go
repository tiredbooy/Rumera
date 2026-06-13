package mappers

import "github.com/tiredbooy/internal/models"

func ToBlogCategoryResponse(c *models.BlogCategory) models.BlogCategoryResponse {
	return models.BlogCategoryResponse{
		ID:          c.ID,
		Name:        c.Name,
		Description: c.Description,
		Slug:        c.Slug,
		ParentID:    c.ParentID,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func ToBlogCategoryResponses(cs []*models.BlogCategory) []models.BlogCategoryResponse {
	out := make([]models.BlogCategoryResponse, len(cs))
	for i, c := range cs {
		out[i] = ToBlogCategoryResponse(c)
	}
	return out
}

func ToBlogResponse(b *models.Blog) models.BlogResponse {
	return models.BlogResponse{
		ID:              b.ID,
		AuthorID:        b.AuthorID,
		Title:           b.Title,
		Slug:            b.Slug,
		Content:         b.Content,
		Excerpt:         b.Excerpt,
		TimeToRead:      b.TimeToRead,
		TotalReads:      b.TotalReads,
		MetaTitle:       b.MetaTitle,
		MetaDescription: b.MetaDescription,
		PublishedAt:     b.PublishedAt,
		CreatedAt:       b.CreatedAt,
		UpdatedAt:       b.UpdatedAt,
	}
}

func ToBlogResponses(bs []*models.Blog) []models.BlogResponse {
	out := make([]models.BlogResponse, len(bs))
	for i, b := range bs {
		out[i] = ToBlogResponse(b)
	}
	return out
}

func ToBlogDetailResponse(
	b *models.Blog,
	categories []*models.BlogCategory,
	productIDs []int64,
	tagIDs []int64,
) models.BlogDetailResponse {
	return models.BlogDetailResponse{
		BlogResponse: ToBlogResponse(b),
		Categories:   ToBlogCategoryResponses(categories),
		ProductIDs:   productIDs,
		TagIDs:       tagIDs,
	}
}
