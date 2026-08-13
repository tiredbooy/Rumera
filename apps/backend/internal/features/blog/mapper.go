package blog

func ToBlogCategoryResponse(c *BlogCategory) BlogCategoryResponse {
	return BlogCategoryResponse{
		ID:          c.ID,
		Name:        c.Name,
		Description: c.Description,
		Slug:        c.Slug,
		ParentID:    c.ParentID,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func ToBlogCategoryResponses(cs []*BlogCategory) []BlogCategoryResponse {
	out := make([]BlogCategoryResponse, len(cs))
	for i, c := range cs {
		out[i] = ToBlogCategoryResponse(c)
	}
	return out
}

func ToBlogResponse(b *Blog) BlogResponse {
	return BlogResponse{
		ID:              b.ID,
		AuthorID:        b.AuthorID,
		Title:           b.Title,
		Slug:            b.Slug,
		Content:         b.Content,
		Excerpt:         b.Excerpt,
		ImageURL:        b.ImageURL,
		ImageAlt:        b.ImageAlt,
		TimeToRead:      b.TimeToRead,
		TotalReads:      b.TotalReads,
		Status:          b.Status,
		IsFeatured:      b.IsFeatured,
		MetaTitle:       b.MetaTitle,
		MetaDescription: b.MetaDescription,
		PublishedAt:     b.PublishedAt,
		CreatedAt:       b.CreatedAt,
		UpdatedAt:       b.UpdatedAt,
	}
}

func ToBlogResponses(bs []*Blog) []BlogResponse {
	out := make([]BlogResponse, len(bs))
	for i, b := range bs {
		out[i] = ToBlogResponse(b)
	}
	return out
}

// ToBlogListItem builds a lightweight journal card (omits the full content body).
func ToBlogListItem(b *Blog) BlogListItem {
	return BlogListItem{
		ID:          b.ID,
		AuthorID:    b.AuthorID,
		Title:       b.Title,
		Slug:        b.Slug,
		Excerpt:     b.Excerpt,
		ImageURL:    b.ImageURL,
		ImageAlt:    b.ImageAlt,
		TimeToRead:  b.TimeToRead,
		TotalReads:  b.TotalReads,
		Status:      b.Status,
		IsFeatured:  b.IsFeatured,
		PublishedAt: b.PublishedAt,
		CreatedAt:   b.CreatedAt,
		UpdatedAt:   b.UpdatedAt,
	}
}

func ToBlogListItems(bs []*Blog) []BlogListItem {
	out := make([]BlogListItem, len(bs))
	for i, b := range bs {
		out[i] = ToBlogListItem(b)
	}
	return out
}

func ToBlogDetailResponse(
	b *Blog,
	categories []*BlogCategory,
	productIDs []int64,
	tagIDs []int64,
) BlogDetailResponse {
	if productIDs == nil {
		productIDs = []int64{}
	}
	if tagIDs == nil {
		tagIDs = []int64{}
	}

	return BlogDetailResponse{
		BlogResponse: ToBlogResponse(b),
		Categories:   ToBlogCategoryResponses(categories),
		ProductIDs:   productIDs,
		TagIDs:       tagIDs,
	}
}
