package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"go.uber.org/zap"
)

// seeder owns the wired services + the raw pool used for the small idempotency
// look-ups and the few direct inserts (inventory, product images) that have no
// dedicated write service exposed here.
type seeder struct {
	pool *pgxpool.Pool
	log  *zap.Logger
	c    *counts

	brand    services.BrandService
	category services.CategoryService
	tag      *services.TagService
	product  *services.ProductService
	variant  *services.VariantService
	image    repositories.ProductImageRepository
	recipe   services.RecipeService
	blog     services.BlogService
	hero     services.HeroSlideService
}

func newSeeder(pool *pgxpool.Pool, zlog *zap.Logger) *seeder {
	return &seeder{
		pool:     pool,
		log:      zlog,
		c:        newCounts(),
		brand:    services.NewBrandService(repositories.NewBrandRepository(pool)),
		category: services.NewCategoryService(repositories.NewCategoryRepository(pool), nil),
		tag:      services.NewTagService(repositories.NewTagRepository(pool)),
		product:  services.NewProductService(repositories.NewProductRepository(pool), nil, nil),
		variant:  services.NewVariantService(repositories.NewVariantRepository(pool), repositories.NewInventoryRepository(pool), nil),
		image:    repositories.NewProductImageRepository(pool),
		recipe:   services.NewRecipeService(repositories.NewRecipeRepository(pool), pool, nil),
		blog:     services.NewBlogService(repositories.NewBlogRepository(pool), pool, nil),
		hero:     services.NewHeroSlideService(repositories.NewHeroSlideRepository(pool), nil),
	}
}

func (s *seeder) run(ctx context.Context) error {
	// FK order: brands + categories + tags + option catalog → products →
	// variants → images → inventory → recipes → blogs → hero slides.
	brandIDs, err := s.seedBrands(ctx)
	if err != nil {
		return fmt.Errorf("brands: %w", err)
	}
	catIDs, err := s.seedCategories(ctx)
	if err != nil {
		return fmt.Errorf("categories: %w", err)
	}
	tagIDs, err := s.seedTags(ctx)
	if err != nil {
		return fmt.Errorf("tags: %w", err)
	}
	optionIDs, err := s.seedOptionCatalog(ctx)
	if err != nil {
		return fmt.Errorf("option catalog: %w", err)
	}
	variants, err := s.seedProducts(ctx, brandIDs, catIDs, tagIDs, optionIDs)
	if err != nil {
		return fmt.Errorf("products: %w", err)
	}
	if err := s.seedRecipes(ctx, variants, tagIDs); err != nil {
		return fmt.Errorf("recipes: %w", err)
	}
	if err := s.seedBlogs(ctx); err != nil {
		return fmt.Errorf("blogs: %w", err)
	}
	if err := s.seedHeroSlides(ctx); err != nil {
		return fmt.Errorf("hero slides: %w", err)
	}
	return nil
}
