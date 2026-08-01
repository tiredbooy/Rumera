package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

// RecipeService is the content-commerce surface for recipes: CRUD with
// transactional relations, public storefront reads (published-only, hydrated
// with shoppable products + SEO structured data), and cross-sell helpers that
// link recipes to the catalogue to drive sales.
type RecipeService interface {
	Create(ctx context.Context, req *models.RecipeReq) (*models.RecipeDetailResponse, error)
	Update(ctx context.Context, id int64, req *models.RecipeUpdateReq) (*models.RecipeDetailResponse, error)
	Delete(ctx context.Context, id int64) error

	GetByID(ctx context.Context, id int64) (*models.RecipeDetailResponse, error)
	GetPublishedBySlug(ctx context.Context, slug string) (*models.RecipeDetailResponse, error)
	List(ctx context.Context, filter models.RecipeFilter) ([]*models.Recipe, int64, error)
	RecordView(ctx context.Context, id int64) error

	Related(ctx context.Context, recipeID int64, limit int) ([]*models.Recipe, error)
	RecipesForProduct(ctx context.Context, productID int64, limit int) ([]*models.Recipe, error)
	Sitemap(ctx context.Context) ([]*models.RecipeSitemapItem, error)
}

type recipeService struct {
	repo  repositories.RecipeRepository
	db    pgxBeginner
	media *MediaLifecycleService
}

func NewRecipeService(repo repositories.RecipeRepository, db pgxBeginner, media *MediaLifecycleService) RecipeService {
	return &recipeService{repo: repo, db: db, media: media}
}

// ── Reads ─────────────────────────────────────────────────────────────────────

func (s *recipeService) GetByID(ctx context.Context, id int64) (*models.RecipeDetailResponse, error) {
	return s.hydrate(ctx, func() (*models.Recipe, error) { return s.repo.GetByID(ctx, id) })
}

func (s *recipeService) GetPublishedBySlug(ctx context.Context, slug string) (*models.RecipeDetailResponse, error) {
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	return s.hydrate(ctx, func() (*models.Recipe, error) { return s.repo.GetPublishedBySlug(ctx, slug) })
}

func (s *recipeService) List(ctx context.Context, filter models.RecipeFilter) ([]*models.Recipe, int64, error) {
	recipes, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("recipeService.List: %w", err)
	}
	return recipes, total, nil
}

func (s *recipeService) RecordView(ctx context.Context, id int64) error {
	if err := s.repo.IncrementViewCount(ctx, id); err != nil {
		return fmt.Errorf("recipeService.RecordView: %w", err)
	}
	return nil
}

// Related finds other published recipes that share tags with the given recipe,
// falling back to recency — used for "you might also like" modules.
func (s *recipeService) Related(ctx context.Context, recipeID int64, limit int) ([]*models.Recipe, error) {
	if limit <= 0 || limit > 50 {
		limit = 8
	}
	tagIDs, err := s.repo.GetTagIDsByRecipeID(ctx, recipeID)
	if err != nil {
		return nil, fmt.Errorf("recipeService.Related: %w", err)
	}

	published := models.RecipeStatusPublished
	filter := models.RecipeFilter{Status: &published}
	filter.Limit = limit + 1 // fetch one extra so we can drop the source recipe
	filter.Page = 1
	if len(tagIDs) > 0 {
		filter.TagID = &tagIDs[0]
		filter.SortBy = "view_count"
	} else {
		filter.SortBy = "published_at"
	}
	filter.OrderBy = "desc"

	recipes, _, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("recipeService.Related: %w", err)
	}

	out := make([]*models.Recipe, 0, limit)
	for _, rec := range recipes {
		if rec.ID == recipeID {
			continue
		}
		out = append(out, rec)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (s *recipeService) RecipesForProduct(ctx context.Context, productID int64, limit int) ([]*models.Recipe, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	recipes, err := s.repo.GetRecipeCardsByProductID(ctx, productID, limit)
	if err != nil {
		return nil, fmt.Errorf("recipeService.RecipesForProduct: %w", err)
	}
	return recipes, nil
}

func (s *recipeService) Sitemap(ctx context.Context) ([]*models.RecipeSitemapItem, error) {
	items, err := s.repo.PublishedSitemap(ctx)
	if err != nil {
		return nil, fmt.Errorf("recipeService.Sitemap: %w", err)
	}
	return items, nil
}

// ── Writes ────────────────────────────────────────────────────────────────────

func (s *recipeService) Create(ctx context.Context, req *models.RecipeReq) (*models.RecipeDetailResponse, error) {
	if err := normalizeCreateMediaURL(&req.ImageURL); err != nil {
		return nil, err
	}
	if err := normalizeCreateImageAlt(&req.ImageAlt); err != nil {
		return nil, err
	}
	if err := normalizeCreateMediaURL(&req.OGImageURL); err != nil {
		return nil, err
	}
	s.applyCreateDefaults(ctx, req)

	if err := s.assertSlugFree(ctx, req.Slug); err != nil {
		return nil, err
	}
	if err := validateShoppable(req.Products); err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("recipeService.Create: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	recipe, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("recipeService.Create: %w", err)
	}

	if _, err := s.repo.CreateIngredients(ctx, recipe.ID, req.Ingredients); err != nil {
		return nil, fmt.Errorf("recipeService.Create: ingredients: %w", err)
	}
	if err := s.repo.AssignProducts(ctx, recipe.ID, req.Products); err != nil {
		return nil, fmt.Errorf("recipeService.Create: products: %w", err)
	}
	if err := s.repo.AssignTags(ctx, recipe.ID, req.TagIDs); err != nil {
		return nil, fmt.Errorf("recipeService.Create: tags: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("recipeService.Create: commit: %w", err)
	}

	return s.hydrate(ctx, func() (*models.Recipe, error) { return recipe, nil })
}

func (s *recipeService) Update(ctx context.Context, id int64, req *models.RecipeUpdateReq) (*models.RecipeDetailResponse, error) {
	var mediaBefore *models.Recipe
	if req.ImageURL.Set || req.ImageAlt.Set || req.OGImageURL.Set {
		current, err := s.repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				return nil, apperr.ErrNotFound
			}
			return nil, fmt.Errorf("recipeService.Update media preflight: %w", err)
		}
		mediaBefore = current
		if req.ImageURL.Set || req.ImageAlt.Set {
			req.ExpectedImageURL = mediaExpectation(current.ImageURL)
		}
		if req.OGImageURL.Set {
			req.ExpectedOGImageURL = mediaExpectation(current.OGImageURL)
		}
		if err := normalizeMediaURLPatch(&req.ImageURL, current.ImageURL); err != nil {
			return nil, err
		}
		if err := normalizeImageAltPatch(&req.ImageAlt); err != nil {
			return nil, err
		}
		if err := normalizeMediaURLPatch(&req.OGImageURL, current.OGImageURL); err != nil {
			return nil, err
		}
	}

	// Normalise / guard the slug if it is being changed.
	if req.Slug != nil {
		normalized := slugify(*req.Slug)
		if normalized == "" {
			return nil, apperr.ErrInvalidRequest
		}
		req.Slug = &normalized
		exists, err := s.repo.SlugExists(ctx, normalized)
		if err != nil {
			return nil, fmt.Errorf("recipeService.Update: %w", err)
		}
		// Allow keeping the same slug on the same recipe.
		if exists {
			if current, gErr := s.repo.GetByID(ctx, id); gErr == nil && current.Slug != normalized {
				return nil, apperr.ErrConflict
			}
		}
	}

	// Auto-stamp published_at the first time a recipe goes live.
	if req.Status != nil && *req.Status == models.RecipeStatusPublished && req.PublishedAt == nil {
		if current, err := s.repo.GetByID(ctx, id); err == nil && current.PublishedAt == nil {
			now := time.Now().UTC()
			req.PublishedAt = &now
		}
	}

	if err := validateShoppable(req.Products); err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("recipeService.Update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	recipe, err := s.repo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("recipeService.Update: %w", err)
	}

	// nil = relation untouched; non-nil (incl. empty) = full replace.
	if req.Ingredients != nil {
		if err := s.repo.DeleteIngredientsByRecipeID(ctx, id); err != nil {
			return nil, fmt.Errorf("recipeService.Update: clear ingredients: %w", err)
		}
		if _, err := s.repo.CreateIngredients(ctx, id, req.Ingredients); err != nil {
			return nil, fmt.Errorf("recipeService.Update: ingredients: %w", err)
		}
	}
	if req.Products != nil {
		if err := s.repo.RemoveProducts(ctx, id); err != nil {
			return nil, fmt.Errorf("recipeService.Update: clear products: %w", err)
		}
		if err := s.repo.AssignProducts(ctx, id, req.Products); err != nil {
			return nil, fmt.Errorf("recipeService.Update: products: %w", err)
		}
	}
	if req.TagIDs != nil {
		if err := s.repo.RemoveTags(ctx, id); err != nil {
			return nil, fmt.Errorf("recipeService.Update: clear tags: %w", err)
		}
		if err := s.repo.AssignTags(ctx, id, req.TagIDs); err != nil {
			return nil, fmt.Errorf("recipeService.Update: tags: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("recipeService.Update: commit: %w", err)
	}
	if mediaBefore != nil {
		if !sameMediaURL(mediaBefore.ImageURL, recipe.ImageURL) {
			s.media.CleanupURLs(ctx, mediaBefore.ImageURL)
		}
		if !sameMediaURL(mediaBefore.OGImageURL, recipe.OGImageURL) {
			s.media.CleanupURLs(ctx, mediaBefore.OGImageURL)
		}
	}

	return s.hydrate(ctx, func() (*models.Recipe, error) { return recipe, nil })
}

func (s *recipeService) Delete(ctx context.Context, id int64) error {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("recipeService.Delete media: %w", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("recipeService.Delete: %w", err)
	}
	s.media.CleanupURLs(ctx, current.ImageURL, current.OGImageURL)
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (s *recipeService) hydrate(ctx context.Context, load func() (*models.Recipe, error)) (*models.RecipeDetailResponse, error) {
	recipe, err := load()
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("recipeService.hydrate: %w", err)
	}

	ingredients, err := s.repo.GetIngredientsByRecipeID(ctx, recipe.ID)
	if err != nil {
		return nil, fmt.Errorf("recipeService.hydrate: ingredients: %w", err)
	}
	products, err := s.repo.GetShoppableProducts(ctx, recipe.ID)
	if err != nil {
		return nil, fmt.Errorf("recipeService.hydrate: products: %w", err)
	}
	tags, err := s.repo.GetTagsByRecipeID(ctx, recipe.ID)
	if err != nil {
		return nil, fmt.Errorf("recipeService.hydrate: tags: %w", err)
	}

	detail := mappers.ToRecipeDetailResponse(recipe, ingredients, products, tags)
	return &detail, nil
}

func (s *recipeService) applyCreateDefaults(ctx context.Context, req *models.RecipeReq) {
	if req.Difficulty == "" {
		req.Difficulty = models.RecipeDifficultyEasy
	}
	if req.Servings <= 0 {
		req.Servings = 1
	}
	if req.Status == "" {
		req.Status = models.RecipeStatusDraft
	}
	if req.Status == models.RecipeStatusPublished && req.PublishedAt == nil {
		now := time.Now().UTC()
		req.PublishedAt = &now
	}
	if strings.TrimSpace(req.Slug) == "" {
		req.Slug = s.uniqueSlug(ctx, req.Title)
	} else {
		req.Slug = slugify(req.Slug)
	}
}

func (s *recipeService) assertSlugFree(ctx context.Context, slug string) error {
	exists, err := s.repo.SlugExists(ctx, slug)
	if err != nil {
		return fmt.Errorf("recipeService.assertSlugFree: %w", err)
	}
	if exists {
		return apperr.ErrConflict
	}
	return nil
}

// uniqueSlug derives a URL-safe slug from the title and appends a numeric suffix
// until it is free, so creation never fails on a slug collision.
func (s *recipeService) uniqueSlug(ctx context.Context, title string) string {
	base := slugify(title)
	if base == "" {
		base = "recipe"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := s.repo.SlugExists(ctx, slug)
		if err != nil || !exists {
			return slug
		}
		slug = base + "-" + strconv.Itoa(i)
	}
}

func validateShoppable(products []*models.RecipeProductReq) error {
	for _, p := range products {
		if p.ProductVariantID <= 0 {
			return apperr.ErrInvalidRequest
		}
	}
	return nil
}

func slugify(s string) string {
	return normalizePublicSlug(s)
}
