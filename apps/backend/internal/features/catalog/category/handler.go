package category

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// categoryTreeCacheTTL bounds staleness of the cached category tree; every
// category write invalidates it eagerly.
const categoryTreeCacheTTL = 5 * time.Minute

// Handler is the HTTP surface for shop categories.
type Handler struct {
	Category  Service
	Validator *validator.Validator
	Cache     cache.Store
	Log       *zap.Logger

	cacheGroup singleflight.Group
}

// NewHandler constructs the category HTTP handler.
func NewHandler(svc Service, v *validator.Validator, store cache.Store, log *zap.Logger) *Handler {
	return &Handler{Category: svc, Validator: v, Cache: store, Log: log}
}

// CreateCategory — POST /admin/categories
func (h *Handler) CreateCategory(c *gin.Context) {
	var req CreateCategoryReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cat, err := h.Category.Create(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyCategoryTree())
	response.Created(c, toCategoryResponse(cat))
}

// ListCategories — GET /categories
func (h *Handler) ListCategories(c *gin.Context) {
	var filter CategoryFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	cats, total, err := h.Category.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, toCategoryResponses(cats), httpx.Paginate(filter.Page, filter.Limit, total))
}

// CategoryTree — GET /categories/tree (read-through cached)
func (h *Handler) CategoryTree(c *gin.Context) {
	ctx := c.Request.Context()
	data, err := h.cachedJSON(ctx, cache.KeyCategoryTree(), categoryTreeCacheTTL, func() (any, error) {
		return h.Category.GetTree(ctx)
	})
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.CachedJSON(c, data, categoryTreeCacheTTL)
}

// FeaturedCategories — GET /categories/featured
func (h *Handler) FeaturedCategories(c *gin.Context) {
	cats, err := h.Category.GetFeatured(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toCategoryResponses(cats))
}

// GetCategory — GET /categories/:id
func (h *Handler) GetCategory(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	cat, err := h.Category.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toCategoryResponse(cat))
}

// GetCategoryBySlug — GET /categories/slug/:slug
func (h *Handler) GetCategoryBySlug(c *gin.Context) {
	cat, err := h.Category.GetBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toCategoryResponse(cat))
}

// CategoryChildren — GET /categories/:id/children
func (h *Handler) CategoryChildren(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	children, err := h.Category.GetChildren(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, toCategoryResponses(children))
}

// UpdateCategory — PATCH /admin/categories/:id
func (h *Handler) UpdateCategory(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateCategoryReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cat, err := h.Category.Update(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyCategoryTree())
	response.OK(c, toCategoryResponse(cat))
}

// DeleteCategory — DELETE /admin/categories/:id
func (h *Handler) DeleteCategory(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Category.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyCategoryTree())
	response.NoContent(c)
}

func toCategoryResponse(c *Category) CategoryResponse {
	return CategoryResponse{
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

func toCategoryResponses(cs []*Category) []CategoryResponse {
	out := make([]CategoryResponse, len(cs))
	for i, c := range cs {
		out[i] = toCategoryResponse(c)
	}
	return out
}

func (h *Handler) cachedJSON(ctx context.Context, key string, ttl time.Duration, build func() (any, error)) (json.RawMessage, error) {
	if h.Cache != nil {
		cached, err := h.Cache.Get(ctx, key)
		switch {
		case err == nil:
			metrics.IncCache(metrics.CacheHit)
			return json.RawMessage(cached), nil
		case errors.Is(err, cache.ErrNotFound):
			metrics.IncCache(metrics.CacheMiss)
		default:
			metrics.IncCache(metrics.CacheError)
			h.logCacheWarn("get", key, err)
		}
	}

	raw, err, _ := h.cacheGroup.Do(key, func() (any, error) {
		if h.Cache != nil {
			if cached, err := h.Cache.Get(ctx, key); err == nil {
				return json.RawMessage(cached), nil
			}
		}

		value, err := build()
		if err != nil {
			return nil, err
		}

		marshalled, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}

		if h.Cache != nil {
			if err := h.Cache.Set(ctx, key, string(marshalled), ttl); err != nil {
				h.logCacheWarn("set", key, err)
			}
		}
		return json.RawMessage(marshalled), nil
	})
	if err != nil {
		return nil, err
	}
	return raw.(json.RawMessage), nil
}

func (h *Handler) invalidate(ctx context.Context, keys ...string) {
	if h.Cache == nil || len(keys) == 0 {
		return
	}
	if err := h.Cache.Delete(ctx, keys...); err != nil {
		h.logCacheWarn("delete", keys[0], err)
	}
}

func (h *Handler) logCacheWarn(op, key string, err error) {
	if h.Log != nil {
		h.Log.Warn("cache " + op + " failed: " + key + ": " + err.Error())
	}
}
