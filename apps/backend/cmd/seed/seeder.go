package main

import (
	"context"
	"fmt"
	"github.com/tiredbooy/internal/features/blog"
	"github.com/tiredbooy/internal/features/recipes"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/features/catalog/brand"
	"github.com/tiredbooy/internal/features/catalog/category"
	"github.com/tiredbooy/internal/features/catalog/product"
	"github.com/tiredbooy/internal/features/catalog/tag"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/hero"
	"github.com/tiredbooy/internal/features/inventory"
	"go.uber.org/zap"
)

// seeder owns the wired services + the raw pool used for the small idempotency
// look-ups and the few direct inserts (inventory, product images) that have no
// dedicated write service exposed here.
type seeder struct {
	pool *pgxpool.Pool
	log  *zap.Logger
	c    *counts

	brand    brand.Service
	category category.Service
	tag      *tag.Service
	product  *product.Service
	variant  *variant.Service
	image    product.ImageRepository
	recipe   recipes.Service
	blog     blog.Service
	hero     hero.Service
}

func newSeeder(pool *pgxpool.Pool, zlog *zap.Logger) *seeder {
	return &seeder{
		pool:     pool,
		log:      zlog,
		c:        newCounts(),
		brand:    brand.NewService(brand.NewRepository(pool)),
		category: category.NewService(category.NewRepository(pool), nil),
		tag:      tag.NewService(tag.NewRepository(pool)),
		product:  product.NewService(product.NewRepository(pool), nil, nil),
		variant:  variant.NewService(variant.NewRepository(pool), inventory.NewRepository(pool), nil),
		image:    product.NewImageRepository(pool),
		recipe:   recipes.NewService(recipes.NewRepository(pool), pool, nil),
		blog:     blog.NewService(blog.NewRepository(pool), pool, nil),
		hero:     hero.NewService(hero.NewRepository(pool), nil),
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
