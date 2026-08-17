package blog

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/async"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

const blogReadTimeout = 2 * time.Second

var blogReadSlots = make(chan struct{}, 64)

// Handler is the HTTP surface for journal posts and categories.
type Handler struct {
	Posts      Service
	Categories CategoryService
	Validator  *validator.Validator
}

// NewHandler constructs the blog HTTP handler.
func NewHandler(posts Service, categories CategoryService, v *validator.Validator) *Handler {
	return &Handler{Posts: posts, Categories: categories, Validator: v}
}

// ListPublic — GET /blogs
func (h *Handler) ListPublic(c *gin.Context) {
	var filter BlogFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	applyPublicListFilter(&filter)

	blogs, total, err := h.Posts.List(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, ToBlogListItems(blogs), httpx.Paginate(filter.Page, filter.Limit, total))
}

// ListAdmin — GET /admin/blogs
func (h *Handler) ListAdmin(c *gin.Context) {
	var filter BlogFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	blogs, total, err := h.Posts.List(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, ToBlogListItems(blogs), httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetBySlug — GET /blogs/:slug
func (h *Handler) GetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	post, err := h.Posts.GetPublishedBySlug(c.Request.Context(), slug)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	select {
	case blogReadSlots <- struct{}{}:
		id := post.ID
		async.GoCtx("blog.record_read", blogReadTimeout, func(ctx context.Context) {
			defer func() { <-blogReadSlots }()
			_ = h.Posts.RecordRead(ctx, id)
		})
	default:
	}
	response.OK(c, post)
}

// GetAdmin — GET /admin/blogs/:id
func (h *Handler) GetAdmin(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	post, err := h.Posts.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, post)
}

// Create — POST /admin/blogs
func (h *Handler) Create(c *gin.Context) {
	authorID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req BlogReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	req.AuthorID = authorID
	post, err := h.Posts.Create(c.Request.Context(), &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, post)
}

// Update — PATCH /admin/blogs/:id
func (h *Handler) Update(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req BlogUpdateReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	post, err := h.Posts.Update(c.Request.Context(), id, &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, post)
}

// Delete — DELETE /admin/blogs/:id
func (h *Handler) Delete(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Posts.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ListCategories — GET /blog-categories (public + admin share)
func (h *Handler) ListCategories(c *gin.Context) {
	cats, err := h.Categories.GetAll(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToBlogCategoryResponses(cats))
}

// GetCategory — GET /blog-categories/:id
func (h *Handler) GetCategory(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	cat, err := h.Categories.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToBlogCategoryResponse(cat))
}

// CreateCategory — POST /admin/blog-categories
func (h *Handler) CreateCategory(c *gin.Context) {
	var req BlogCategoryReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cat, err := h.Categories.Create(c.Request.Context(), &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, ToBlogCategoryResponse(cat))
}

// UpdateCategory — PATCH /admin/blog-categories/:id
func (h *Handler) UpdateCategory(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req BlogCategoryUpdateReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cat, err := h.Categories.Update(c.Request.Context(), id, &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToBlogCategoryResponse(cat))
}

// DeleteCategory — DELETE /admin/blog-categories/:id
func (h *Handler) DeleteCategory(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Categories.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
