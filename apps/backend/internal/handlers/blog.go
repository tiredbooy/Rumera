package handlers

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

const blogReadTimeout = 2 * time.Second

var blogReadSlots = make(chan struct{}, 64)

// ── Blogs ──────────────────────────────────────────────────────────────────

// ListBlogs — GET /blogs. Public listing is always published-only + paginated.
func (h *Handler) ListBlogs(c *gin.Context) {
	var filter models.BlogFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	published := models.BlogStatusPublished
	filter.Status = &published // never expose drafts on the storefront

	blogs, total, err := h.Blog.List(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, mappers.ToBlogListItems(blogs), paginate(filter.Page, filter.Limit, total))
}

// ListBlogsAdmin — GET /admin/blogs. Includes every publication status.
func (h *Handler) ListBlogsAdmin(c *gin.Context) {
	var filter models.BlogFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	blogs, total, err := h.Blog.List(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, mappers.ToBlogListItems(blogs), paginate(filter.Page, filter.Limit, total))
}

// GetBlogBySlug — GET /blogs/:slug. Public read: drafts 404. Records a read async.
func (h *Handler) GetBlogBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	blog, err := h.Blog.GetPublishedBySlug(c.Request.Context(), slug)
	if err != nil {
		h.handleError(c, err)
		return
	}
	// Count the read without blocking the response or tying it to the request
	// lifetime.
	select {
	case blogReadSlots <- struct{}{}:
		go func(id int64) {
			defer func() { <-blogReadSlots }()
			ctx, cancel := context.WithTimeout(context.Background(), blogReadTimeout)
			defer cancel()
			_ = h.Blog.RecordRead(ctx, id)
		}(blog.ID)
	default:
		// Read accounting is best-effort and must not create unbounded work.
	}

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
		h.handleError(c, err)
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
		h.handleError(c, err)
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
		h.handleError(c, err)
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
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Blog categories ────────────────────────────────────────────────────────

// ListBlogCategories — GET /blog-categories
func (h *Handler) ListBlogCategories(c *gin.Context) {
	cats, err := h.BlogCategory.GetAll(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
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
		h.handleError(c, err)
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
		h.handleError(c, err)
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
	var req models.BlogCategoryUpdateReq
	if !h.bindJSON(c, &req) {
		return
	}
	cat, err := h.BlogCategory.Update(c.Request.Context(), id, &req)
	if err != nil {
		h.handleError(c, err)
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
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}
