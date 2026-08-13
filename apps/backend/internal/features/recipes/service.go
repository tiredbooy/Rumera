package recipes

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// MediaCleaner is the subset of media lifecycle used when recipe images change.
type MediaCleaner interface {
	CleanupURLs(ctx context.Context, values ...*string)
}

type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Service is the content-commerce surface for recipes: CRUD with
// transactional relations, public storefront reads (published-only, hydrated
// with shoppable products + SEO structured data), and cross-sell helpers that
// link recipes to the catalogue to drive sales.
type Service interface {
	Create(ctx context.Context, req *RecipeReq) (*RecipeDetailResponse, error)
	Update(ctx context.Context, id int64, req *RecipeUpdateReq) (*RecipeDetailResponse, error)
	Delete(ctx context.Context, id int64) error

	GetByID(ctx context.Context, id int64) (*RecipeDetailResponse, error)
	GetPublishedBySlug(ctx context.Context, slug string) (*RecipeDetailResponse, error)
	List(ctx context.Context, filter RecipeFilter) ([]*Recipe, int64, error)
	RecordView(ctx context.Context, id int64) error

	Related(ctx context.Context, recipeID int64, limit int) ([]*Recipe, error)
	RecipesForProduct(ctx context.Context, productID int64, limit int) ([]*Recipe, error)
	Sitemap(ctx context.Context) ([]*RecipeSitemapItem, error)
}

type service struct {
	repo  Repository
	db    pgxBeginner
	media MediaCleaner
}

func NewService(repo Repository, db pgxBeginner, media MediaCleaner) Service {
	return &service{repo: repo, db: db, media: media}
}

// ── Reads ─────────────────────────────────────────────────────────────────────

func (s *service) GetByID(ctx context.Context, id int64) (*RecipeDetailResponse, error) {
	return s.hydrate(ctx, func() (*Recipe, error) { return s.repo.GetByID(ctx, id) })
}

func (s *service) GetPublishedBySlug(ctx context.Context, slug string) (*RecipeDetailResponse, error) {
	if slug == "" {
		return nil, apperr.ErrInvalidRequest
	}
	return s.hydrate(ctx, func() (*Recipe, error) { return s.repo.GetPublishedBySlug(ctx, slug) })
}

func (s *service) List(ctx context.Context, filter RecipeFilter) ([]*Recipe, int64, error) {
	recipes, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("service.List: %w", err)
	}
	return recipes, total, nil
}

func (s *service) RecordView(ctx context.Context, id int64) error {
	if err := s.repo.IncrementViewCount(ctx, id); err != nil {
		return fmt.Errorf("service.RecordView: %w", err)
	}
	return nil
}

// Related finds other published recipes that share tags with the given recipe,
// falling back to recency — used for "you might also like" modules.
func (s *service) Related(ctx context.Context, recipeID int64, limit int) ([]*Recipe, error) {
	if limit <= 0 || limit > 50 {
		limit = 8
	}
	tagIDs, err := s.repo.GetTagIDsByRecipeID(ctx, recipeID)
	if err != nil {
		return nil, fmt.Errorf("service.Related: %w", err)
	}

	published := RecipeStatusPublished
	filter := RecipeFilter{Status: &published}
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
		return nil, fmt.Errorf("service.Related: %w", err)
	}

	out := make([]*Recipe, 0, limit)
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

func (s *service) RecipesForProduct(ctx context.Context, productID int64, limit int) ([]*Recipe, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	recipes, err := s.repo.GetRecipeCardsByProductID(ctx, productID, limit)
	if err != nil {
		return nil, fmt.Errorf("service.RecipesForProduct: %w", err)
	}
	return recipes, nil
}

func (s *service) Sitemap(ctx context.Context) ([]*RecipeSitemapItem, error) {
	items, err := s.repo.PublishedSitemap(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Sitemap: %w", err)
	}
	return items, nil
}

// ── Writes ────────────────────────────────────────────────────────────────────

func (s *service) Create(ctx context.Context, req *RecipeReq) (*RecipeDetailResponse, error) {
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
		return nil, fmt.Errorf("service.Create: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	txRepo := s.repo.WithTx(tx)

	recipe, err := txRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("service.Create: %w", err)
	}

	if _, err := txRepo.CreateIngredients(ctx, recipe.ID, req.Ingredients); err != nil {
		return nil, fmt.Errorf("service.Create: ingredients: %w", err)
	}
	if err := txRepo.AssignProducts(ctx, recipe.ID, req.Products); err != nil {
		return nil, fmt.Errorf("service.Create: products: %w", err)
	}
	if err := txRepo.AssignTags(ctx, recipe.ID, req.TagIDs); err != nil {
		return nil, fmt.Errorf("service.Create: tags: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.Create: commit: %w", err)
	}

	return s.hydrate(ctx, func() (*Recipe, error) { return recipe, nil })
}

func (s *service) Update(ctx context.Context, id int64, req *RecipeUpdateReq) (*RecipeDetailResponse, error) {
	var mediaBefore *Recipe
	if req.ImageURL.Set || req.ImageAlt.Set || req.OGImageURL.Set {
		current, err := s.repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, models.ErrNotFound) {
				return nil, apperr.ErrNotFound
			}
			return nil, fmt.Errorf("service.Update media preflight: %w", err)
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
			return nil, fmt.Errorf("service.Update: %w", err)
		}
		// Allow keeping the same slug on the same recipe.
		if exists {
			if current, gErr := s.repo.GetByID(ctx, id); gErr == nil && current.Slug != normalized {
				return nil, apperr.ErrConflict
			}
		}
	}

	// Auto-stamp published_at the first time a recipe goes live.
	if req.Status != nil && *req.Status == RecipeStatusPublished && req.PublishedAt == nil {
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
		return nil, fmt.Errorf("service.Update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	txRepo := s.repo.WithTx(tx)

	recipe, err := txRepo.Update(ctx, id, req)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("service.Update: %w", err)
	}

	// nil = relation untouched; non-nil (incl. empty) = full replace.
	if req.Ingredients != nil {
		if err := txRepo.DeleteIngredientsByRecipeID(ctx, id); err != nil {
			return nil, fmt.Errorf("service.Update: clear ingredients: %w", err)
		}
		if _, err := txRepo.CreateIngredients(ctx, id, req.Ingredients); err != nil {
			return nil, fmt.Errorf("service.Update: ingredients: %w", err)
		}
	}
	if req.Products != nil {
		if err := txRepo.RemoveProducts(ctx, id); err != nil {
			return nil, fmt.Errorf("service.Update: clear products: %w", err)
		}
		if err := txRepo.AssignProducts(ctx, id, req.Products); err != nil {
			return nil, fmt.Errorf("service.Update: products: %w", err)
		}
	}
	if req.TagIDs != nil {
		if err := txRepo.RemoveTags(ctx, id); err != nil {
			return nil, fmt.Errorf("service.Update: clear tags: %w", err)
		}
		if err := txRepo.AssignTags(ctx, id, req.TagIDs); err != nil {
			return nil, fmt.Errorf("service.Update: tags: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.Update: commit: %w", err)
	}
	if mediaBefore != nil {
		if !sameMediaURL(mediaBefore.ImageURL, recipe.ImageURL) {
			s.media.CleanupURLs(ctx, mediaBefore.ImageURL)
		}
		if !sameMediaURL(mediaBefore.OGImageURL, recipe.OGImageURL) {
			s.media.CleanupURLs(ctx, mediaBefore.OGImageURL)
		}
	}

	return s.hydrate(ctx, func() (*Recipe, error) { return recipe, nil })
}

func (s *service) Delete(ctx context.Context, id int64) error {
	current, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("service.Delete media: %w", err)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("service.Delete: %w", err)
	}
	s.media.CleanupURLs(ctx, current.ImageURL, current.OGImageURL)
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (s *service) hydrate(ctx context.Context, load func() (*Recipe, error)) (*RecipeDetailResponse, error) {
	recipe, err := load()
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("service.hydrate: %w", err)
	}

	ingredients, err := s.repo.GetIngredientsByRecipeID(ctx, recipe.ID)
	if err != nil {
		return nil, fmt.Errorf("service.hydrate: ingredients: %w", err)
	}
	products, err := s.repo.GetShoppableProducts(ctx, recipe.ID)
	if err != nil {
		return nil, fmt.Errorf("service.hydrate: products: %w", err)
	}
	tags, err := s.repo.GetTagsByRecipeID(ctx, recipe.ID)
	if err != nil {
		return nil, fmt.Errorf("service.hydrate: tags: %w", err)
	}

	detail := ToRecipeDetailResponse(recipe, ingredients, products, tags)
	return &detail, nil
}

func (s *service) applyCreateDefaults(ctx context.Context, req *RecipeReq) {
	if req.Difficulty == "" {
		req.Difficulty = RecipeDifficultyEasy
	}
	if req.Servings <= 0 {
		req.Servings = 1
	}
	if req.Status == "" {
		req.Status = RecipeStatusDraft
	}
	if req.Status == RecipeStatusPublished && req.PublishedAt == nil {
		now := time.Now().UTC()
		req.PublishedAt = &now
	}
	if strings.TrimSpace(req.Slug) == "" {
		req.Slug = s.uniqueSlug(ctx, req.Title)
	} else {
		req.Slug = slugify(req.Slug)
	}
}

func (s *service) assertSlugFree(ctx context.Context, slug string) error {
	exists, err := s.repo.SlugExists(ctx, slug)
	if err != nil {
		return fmt.Errorf("service.assertSlugFree: %w", err)
	}
	if exists {
		return apperr.ErrConflict
	}
	return nil
}

// uniqueSlug derives a URL-safe slug from the title and appends a numeric suffix
// until it is free, so creation never fails on a slug collision.
func (s *service) uniqueSlug(ctx context.Context, title string) string {
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

func validateShoppable(products []*RecipeProductReq) error {
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

// normalizePublicSlug keeps Unicode letters and digits while collapsing every
// separator into one hyphen, producing a stable single URL path segment.
func normalizePublicSlug(value string) string {
	var slug strings.Builder
	separator := false
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if separator && slug.Len() > 0 {
				slug.WriteByte('-')
			}
			slug.WriteRune(r)
			separator = false
			continue
		}
		if slug.Len() > 0 {
			separator = true
		}
	}
	return slug.String()
}
