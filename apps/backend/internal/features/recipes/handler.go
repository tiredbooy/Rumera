package recipes

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/async"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// recipeCacheTTL bounds staleness of the cached public recipe detail. Writes
// invalidate eagerly; price/stock shifts on shoppable products surface within
// this window.
const recipeCacheTTL = 120 * time.Second

// Handler is the HTTP surface for recipes.
type Handler struct {
	Recipes   Service
	Validator *validator.Validator
	Cache     cache.Store
	Log       *zap.Logger

	cacheGroup singleflight.Group
}

// NewHandler constructs the recipes HTTP handler.
func NewHandler(svc Service, v *validator.Validator, store cache.Store, log *zap.Logger) *Handler {
	return &Handler{Recipes: svc, Validator: v, Cache: store, Log: log}
}

// ── Public ──────────────────────────────────────────────────────────────────

// List — GET /recipes. Public listing is always published-only.
func (h *Handler) List(c *gin.Context) {
	var filter RecipeFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	applyPublicListFilter(&filter) // published + live published_at only

	recipes, total, err := h.Recipes.List(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, ToRecipeListItems(recipes), httpx.Paginate(filter.Page, filter.Limit, total))
}

// Featured — GET /recipes/featured
func (h *Handler) Featured(c *gin.Context) {
	var filter RecipeFilter
	filter.Defaults()
	filter.Limit = 12
	applyPublicListFilter(&filter)
	featured := true
	filter.IsFeatured = &featured
	filter.SortBy = "published_at"

	recipes, _, err := h.Recipes.List(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToRecipeListItems(recipes))
}

// GetBySlug — GET /recipes/:slug. Hydrated, cached, view counted.
func (h *Handler) GetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	ctx := c.Request.Context()

	data, err := h.cachedJSON(ctx, cache.KeyRecipe(slug), recipeCacheTTL, func() (any, error) {
		return h.Recipes.GetPublishedBySlug(ctx, slug)
	})
	if err != nil {
		httpx.HandleError(c, err)
		return
	}

	// Count the view without blocking the response or tying it to the request.
	async.GoCtx("recipes.record_view", 5*time.Second, func(bg context.Context) {
		if rec, e := h.Recipes.GetPublishedBySlug(bg, slug); e == nil {
			_ = h.Recipes.RecordView(bg, rec.ID)
		}
	})

	// no-cache (revalidate) rather than max-age: the view counter above must run
	// on every request, so clients are forced to hit the server — but a matching
	// ETag still short-circuits to a bodyless 304.
	response.RevalidateJSON(c, data)
}

// SlugRedirect — GET /recipes/:slug/redirect. The storefront calls this only
// after the live lookup 404s, so a live slug always wins over a record.
func (h *Handler) SlugRedirect(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	target, err := h.Recipes.ResolveSlugRedirect(c.Request.Context(), slug)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, SlugRedirectResponse{Slug: target})
}

// Related — GET /recipes/:slug/related
func (h *Handler) Related(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	ctx := c.Request.Context()

	recipe, err := h.Recipes.GetPublishedBySlug(ctx, slug)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	related, err := h.Recipes.Related(ctx, recipe.ID, 8)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToRecipeListItems(related))
}

// Sitemap — GET /recipes/sitemap. Feeds sitemap.xml generation.
func (h *Handler) Sitemap(c *gin.Context) {
	items, err := h.Recipes.Sitemap(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if items == nil {
		items = []*RecipeSitemapItem{}
	}
	response.OK(c, items)
}

// ProductRecipes — GET /products/:id/recipes. Cross-sell: recipes that use a
// product, so a product page can surface "make a cocktail with this".
func (h *Handler) ProductRecipes(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	recipes, err := h.Recipes.RecipesForProduct(c.Request.Context(), id, 8)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToRecipeListItems(recipes))
}

// ── Admin ───────────────────────────────────────────────────────────────────

// ListAdmin — GET /admin/recipes. All statuses.
func (h *Handler) ListAdmin(c *gin.Context) {
	var filter RecipeFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	recipes, total, err := h.Recipes.List(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, ToRecipeAdminListItems(recipes), httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetAdmin — GET /admin/recipes/:id
func (h *Handler) GetAdmin(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	recipe, err := h.Recipes.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, recipe)
}

// Create — POST /admin/recipes
func (h *Handler) Create(c *gin.Context) {
	var req RecipeReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if req.UserID == nil {
		if uid, ok := httpx.UID(c); ok {
			req.UserID = &uid
		}
	}

	recipe, err := h.Recipes.Create(c.Request.Context(), &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, recipe)
}

// Update — PATCH /admin/recipes/:id
func (h *Handler) Update(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req RecipeUpdateReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()

	// A rename retires the old slug. Its cached detail has to go too, or the old
	// URL keeps answering 200 from cache and never reaches its redirect record.
	var previousSlug string
	if before, err := h.Recipes.GetByID(ctx, id); err == nil {
		previousSlug = before.Slug
	}

	recipe, err := h.Recipes.Update(ctx, id, &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	// Invalidate the cached public view for this recipe's slug.
	h.invalidate(ctx, cache.KeyRecipe(recipe.Slug))
	if previousSlug != "" && previousSlug != recipe.Slug {
		h.invalidate(ctx, cache.KeyRecipe(previousSlug))
	}
	response.OK(c, recipe)
}

// Delete — DELETE /admin/recipes/:id
func (h *Handler) Delete(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	// Best-effort cache bust by slug before deletion.
	if rec, err := h.Recipes.GetByID(ctx, id); err == nil {
		h.invalidate(ctx, cache.KeyRecipe(rec.Slug))
	}
	if err := h.Recipes.Delete(ctx, id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Cache helpers (local to feature so routes no longer need handlers.Handler) ─

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
