package handlers

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
)

// recipeCacheTTL bounds staleness of the cached public recipe detail. Writes
// invalidate eagerly; price/stock shifts on shoppable products surface within
// this window.
const recipeCacheTTL = 120 * time.Second

// ── Public ──────────────────────────────────────────────────────────────────

// ListRecipes — GET /recipes. Public listing is always published-only.
func (h *Handler) ListRecipes(c *gin.Context) {
	var filter models.RecipeFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	published := models.RecipeStatusPublished
	filter.Status = &published // never expose drafts on the storefront

	recipes, total, err := h.Recipe.List(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, mappers.ToRecipeListItems(recipes), paginate(filter.Page, filter.Limit, total))
}

// FeaturedRecipes — GET /recipes/featured
func (h *Handler) FeaturedRecipes(c *gin.Context) {
	var filter models.RecipeFilter
	filter.Defaults()
	filter.Limit = 12
	published := models.RecipeStatusPublished
	featured := true
	filter.Status = &published
	filter.IsFeatured = &featured
	filter.SortBy = "published_at"

	recipes, _, err := h.Recipe.List(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToRecipeListItems(recipes))
}

// GetRecipeBySlug — GET /recipes/:slug. Hydrated, cached, view counted.
func (h *Handler) GetRecipeBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	ctx := c.Request.Context()

	data, err := h.cachedJSON(ctx, cache.KeyRecipe(slug), recipeCacheTTL, func() (any, error) {
		return h.Recipe.GetPublishedBySlug(ctx, slug)
	})
	if err != nil {
		h.handleError(c, err)
		return
	}

	// Count the view without blocking the response or tying it to the request.
	go func(s string) {
		bg, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if rec, e := h.Recipe.GetPublishedBySlug(bg, s); e == nil {
			_ = h.Recipe.RecordView(bg, rec.ID)
		}
	}(slug)

	// no-cache (revalidate) rather than max-age: the view counter above must run
	// on every request, so clients are forced to hit the server — but a matching
	// ETag still short-circuits to a bodyless 304.
	response.RevalidateJSON(c, data)
}

// RelatedRecipes — GET /recipes/:slug/related
func (h *Handler) RelatedRecipes(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	ctx := c.Request.Context()

	recipe, err := h.Recipe.GetPublishedBySlug(ctx, slug)
	if err != nil {
		h.handleError(c, err)
		return
	}
	related, err := h.Recipe.Related(ctx, recipe.ID, 8)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToRecipeListItems(related))
}

// RecipeSitemap — GET /recipes/sitemap. Feeds sitemap.xml generation.
func (h *Handler) RecipeSitemap(c *gin.Context) {
	items, err := h.Recipe.Sitemap(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	if items == nil {
		items = []*models.RecipeSitemapItem{}
	}
	response.OK(c, items)
}

// ProductRecipes — GET /products/:id/recipes. Cross-sell: recipes that use a
// product, so a product page can surface "make a cocktail with this".
func (h *Handler) ProductRecipes(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	recipes, err := h.Recipe.RecipesForProduct(c.Request.Context(), id, 8)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToRecipeListItems(recipes))
}

// ── Admin ───────────────────────────────────────────────────────────────────

// ListRecipesAdmin — GET /admin/recipes. All statuses.
func (h *Handler) ListRecipesAdmin(c *gin.Context) {
	var filter models.RecipeFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	recipes, total, err := h.Recipe.List(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, mappers.ToRecipeListItems(recipes), paginate(filter.Page, filter.Limit, total))
}

// GetRecipeAdmin — GET /admin/recipes/:id
func (h *Handler) GetRecipeAdmin(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	recipe, err := h.Recipe.GetByID(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, recipe)
}

// CreateRecipe — POST /admin/recipes
func (h *Handler) CreateRecipe(c *gin.Context) {
	var req models.RecipeReq
	if !h.bindJSON(c, &req) {
		return
	}
	if req.UserID == nil {
		if uid, ok := h.uid(c); ok {
			req.UserID = &uid
		}
	}

	recipe, err := h.Recipe.Create(c.Request.Context(), &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Created(c, recipe)
}

// UpdateRecipe — PATCH /admin/recipes/:id
func (h *Handler) UpdateRecipe(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.RecipeUpdateReq
	if !h.bindJSON(c, &req) {
		return
	}
	recipe, err := h.Recipe.Update(c.Request.Context(), id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	// Invalidate the cached public view for this recipe's slug.
	h.invalidate(c.Request.Context(), cache.KeyRecipe(recipe.Slug))
	response.OK(c, recipe)
}

// DeleteRecipe — DELETE /admin/recipes/:id
func (h *Handler) DeleteRecipe(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	// Best-effort cache bust by slug before deletion.
	if rec, err := h.Recipe.GetByID(ctx, id); err == nil {
		h.invalidate(ctx, cache.KeyRecipe(rec.Slug))
	}
	if err := h.Recipe.Delete(ctx, id); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}
