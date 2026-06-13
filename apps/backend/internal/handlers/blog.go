package handlers

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ── Blogs ──────────────────────────────────────────────────────────────────

// ListBlogs — GET /blogs
func (h *Handler) ListBlogs(c *gin.Context) {
	blogs, err := h.Blog.GetAll(c.Request.Context())
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToBlogResponses(blogs))
}

// GetBlogBySlug — GET /blogs/:slug. Records a read asynchronously.
func (h *Handler) GetBlogBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	blog, err := h.Blog.GetBySlug(c.Request.Context(), slug)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	// Count the read without blocking the response or tying it to the request
	// lifetime.
	go func(id int64) { _ = h.Blog.RecordRead(context.Background(), id) }(blog.ID)

	response.OK(c, blog)
}

// GetBlog — GET /admin/blogs/:id
func (h *Handler) GetBlog(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	blog, err := h.Blog.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, blog)
}

// CreateBlog — POST /admin/blogs
func (h *Handler) CreateBlog(c *gin.Context) {
	authorID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.BlogReq
	if !h.bindJSON(c, &req) {
		return
	}
	req.AuthorID = authorID

	blog, err := h.Blog.Create(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, blog)
}

// UpdateBlog — PATCH /admin/blogs/:id
func (h *Handler) UpdateBlog(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.BlogUpdateReq
	if !h.bindJSON(c, &req) {
		return
	}
	blog, err := h.Blog.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, blog)
}

// DeleteBlog — DELETE /admin/blogs/:id
func (h *Handler) DeleteBlog(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Blog.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Blog categories ────────────────────────────────────────────────────────

// ListBlogCategories — GET /blog-categories
func (h *Handler) ListBlogCategories(c *gin.Context) {
	cats, err := h.BlogCategory.GetAll(c.Request.Context())
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToBlogCategoryResponses(cats))
}

// GetBlogCategory — GET /blog-categories/:id
func (h *Handler) GetBlogCategory(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	cat, err := h.BlogCategory.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToBlogCategoryResponse(cat))
}

// CreateBlogCategory — POST /admin/blog-categories
func (h *Handler) CreateBlogCategory(c *gin.Context) {
	var req models.BlogCategoryReq
	if !h.bindJSON(c, &req) {
		return
	}
	cat, err := h.BlogCategory.Create(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, mappers.ToBlogCategoryResponse(cat))
}

// UpdateBlogCategory — PATCH /admin/blog-categories/:id
func (h *Handler) UpdateBlogCategory(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.BlogCategoryReq
	if !h.bindJSON(c, &req) {
		return
	}
	cat, err := h.BlogCategory.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToBlogCategoryResponse(cat))
}

// DeleteBlogCategory — DELETE /admin/blog-categories/:id
func (h *Handler) DeleteBlogCategory(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.BlogCategory.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
