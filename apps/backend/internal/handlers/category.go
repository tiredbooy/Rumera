package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
)

// categoryTreeCacheTTL bounds staleness of the cached category tree; every
// category write invalidates it eagerly.
const categoryTreeCacheTTL = 5 * time.Minute

// CreateCategory — POST /admin/categories
func (h *Handler) CreateCategory(c *gin.Context) {
	var req models.CreateCategoryReq
	if !h.bindJSON(c, &req) {
		return
	}
	cat, err := h.Category.Create(c.Request.Context(), req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyCategoryTree())
	response.Created(c, toCategoryResponse(cat))
}

// ListCategories — GET /categories
func (h *Handler) ListCategories(c *gin.Context) {
	var filter models.CategoryFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	cats, total, err := h.Category.GetAll(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, toCategoryResponses(cats), paginate(filter.Page, filter.Limit, total))
}

// CategoryTree — GET /categories/tree (read-through cached)
func (h *Handler) CategoryTree(c *gin.Context) {
	ctx := c.Request.Context()
	data, err := h.cachedJSON(ctx, cache.KeyCategoryTree(), categoryTreeCacheTTL, func() (any, error) {
		return h.Category.GetTree(ctx)
	})
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.CachedJSON(c, data, categoryTreeCacheTTL)
}

// FeaturedCategories — GET /categories/featured
// Powers the homepage big-card/small-card layout. Not cached yet — add a
// cache.KeyFeaturedCategories() + h.cachedJSON wrapper later, same pattern
// as CategoryTree above, once that cache key exists.
func (h *Handler) FeaturedCategories(c *gin.Context) {
	cats, err := h.Category.GetFeatured(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, toCategoryResponses(cats))
}

// GetCategory — GET /categories/:id
func (h *Handler) GetCategory(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	cat, err := h.Category.GetByID(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, toCategoryResponse(cat))
}

// CategoryChildren — GET /categories/:id/children
func (h *Handler) CategoryChildren(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	children, err := h.Category.GetChildren(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, toCategoryResponses(children))
}

// UpdateCategory — PATCH /admin/categories/:id
func (h *Handler) UpdateCategory(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateCategoryReq
	if !h.bindJSON(c, &req) {
		return
	}
	cat, err := h.Category.Update(c.Request.Context(), id, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyCategoryTree())
	response.OK(c, toCategoryResponse(cat))
}

// DeleteCategory — DELETE /admin/categories/:id
func (h *Handler) DeleteCategory(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Category.Delete(c.Request.Context(), id); err != nil {
		h.handleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyCategoryTree())
	response.NoContent(c)
}

func toCategoryResponse(c *models.Category) models.CategoryResponse {
	return models.CategoryResponse{
		ID:           c.ID,
		Title:        c.Title,
		Description:  c.Description,
		ParentID:     c.ParentID,
		Slug:         c.Slug,
		ImageURL:     c.ImageURL,
		IsFeatured:   c.IsFeatured,
		CardSize:     c.CardSize,
		DisplayOrder: c.DisplayOrder,
	}
}

func toCategoryResponses(cs []*models.Category) []models.CategoryResponse {
	out := make([]models.CategoryResponse, len(cs))
	for i, c := range cs {
		out[i] = toCategoryResponse(c)
	}
	return out
}
