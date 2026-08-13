//go:build integration

package integration

import (
	"context"
	"fmt"
	"testing"

	"github.com/tiredbooy/internal/features/blog"
	"github.com/tiredbooy/internal/features/recipes"
	"github.com/tiredbooy/internal/models"
)

func TestContentListsPreserveTotalsBeyondTheFinalPage(t *testing.T) {
	requireDB(t)
	ctx := context.Background()

	t.Run("recipes", func(t *testing.T) {
		resetTables(t, "recipes")
		for index := 1; index <= 3; index++ {
			if _, err := testPool.Exec(ctx,
				`INSERT INTO recipes (title, slug, content, difficulty, status, published_at)
				 VALUES ($1, $2, 'Steps', 'easy', 'published', NOW())`,
				fmt.Sprintf("Recipe %d", index), fmt.Sprintf("recipe-%d", index),
			); err != nil {
				t.Fatalf("insert recipe %d: %v", index, err)
			}
		}

		published := recipes.RecipeStatusPublished
		filter := recipes.RecipeFilter{
			BaseFilter: models.BaseFilter{
				PaginationParams: models.PaginationParams{Page: 9, Limit: 2},
			},
			Status: &published,
		}
		filter.Defaults()
		rows, total, err := recipes.NewRepository(testPool).List(ctx, filter)
		if err != nil {
			t.Fatalf("list beyond final recipe page: %v", err)
		}
		if len(rows) != 0 || total != 3 {
			t.Fatalf("recipes/total = %d/%d; want 0/3", len(rows), total)
		}
	})

	t.Run("journal", func(t *testing.T) {
		resetTables(t, "blogs", "users")
		authorID := seedUser(t)
		for index := 1; index <= 3; index++ {
			if _, err := testPool.Exec(ctx,
				`INSERT INTO blogs (author_id, title, slug, content, status, published_at)
				 VALUES ($1, $2, $3, 'Body', 'published', NOW())`,
				authorID, fmt.Sprintf("Post %d", index), fmt.Sprintf("post-%d", index),
			); err != nil {
				t.Fatalf("insert journal post %d: %v", index, err)
			}
		}

		published := blog.BlogStatusPublished
		filter := blog.BlogFilter{
			BaseFilter: models.BaseFilter{
				PaginationParams: models.PaginationParams{Page: 9, Limit: 2},
			},
			Status: &published,
		}
		filter.Defaults()
		rows, total, err := blog.NewRepository(testPool).List(ctx, filter)
		if err != nil {
			t.Fatalf("list beyond final journal page: %v", err)
		}
		if len(rows) != 0 || total != 3 {
			t.Fatalf("journal/total = %d/%d; want 0/3", len(rows), total)
		}
	})
}

func TestRecipeListExcludesFeaturedLeadFromPagination(t *testing.T) {
	requireDB(t)
	resetTables(t, "recipes")
	ctx := context.Background()

	var featuredID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO recipes (title, slug, content, difficulty, status, is_featured, published_at)
		 VALUES ('Featured', 'featured', 'Steps', 'easy', 'published', TRUE, NOW()) RETURNING id`,
	).Scan(&featuredID); err != nil {
		t.Fatalf("insert featured recipe: %v", err)
	}
	for index := 1; index <= 2; index++ {
		if _, err := testPool.Exec(ctx,
			`INSERT INTO recipes (title, slug, content, difficulty, status, published_at)
			 VALUES ($1, $2, 'Steps', 'easy', 'published', NOW())`,
			fmt.Sprintf("Recipe %d", index), fmt.Sprintf("regular-%d", index),
		); err != nil {
			t.Fatalf("insert regular recipe %d: %v", index, err)
		}
	}

	published := recipes.RecipeStatusPublished
	filter := recipes.RecipeFilter{
		BaseFilter: models.BaseFilter{
			PaginationParams: models.PaginationParams{Page: 1, Limit: 1},
		},
		Status:    &published,
		ExcludeID: &featuredID,
	}
	filter.Defaults()
	rows, total, err := recipes.NewRepository(testPool).List(ctx, filter)
	if err != nil {
		t.Fatalf("list recipes without featured lead: %v", err)
	}
	if len(rows) != 1 || total != 2 || rows[0].ID == featuredID {
		t.Fatalf("recipes/total = %+v/%d; want one regular row and total 2", rows, total)
	}
}

func TestRecipeShoppableAvailabilityUsesUncommittedInventory(t *testing.T) {
	requireDB(t)
	resetTables(t, "recipes", "products")
	ctx := context.Background()

	var recipeID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO recipes (title, slug, content, difficulty, status)
		 VALUES ('Recipe', 'recipe', 'Steps', 'easy', 'published') RETURNING id`,
	).Scan(&recipeID); err != nil {
		t.Fatalf("insert recipe: %v", err)
	}
	productID := seedProduct(t)
	if _, err := testPool.Exec(ctx,
		`UPDATE products SET slug = 'bottle', is_active = TRUE WHERE id = $1`, productID,
	); err != nil {
		t.Fatalf("activate product: %v", err)
	}
	variantID := seedVariant(t, productID)
	if _, err := testPool.Exec(ctx,
		`UPDATE product_variants SET price = 100, is_active = TRUE WHERE id = $1`, variantID,
	); err != nil {
		t.Fatalf("activate variant: %v", err)
	}
	seedInventory(t, variantID, 5, 2)
	if _, err := testPool.Exec(ctx,
		`INSERT INTO recipe_products (recipe_id, product_variant_id) VALUES ($1, $2)`,
		recipeID, variantID,
	); err != nil {
		t.Fatalf("link recipe product: %v", err)
	}

	repo := recipes.NewRepository(testPool)
	products, err := repo.GetShoppableProducts(ctx, recipeID)
	if err != nil {
		t.Fatalf("get shoppable products: %v", err)
	}
	if len(products) != 1 || products[0].AvailableStock != 3 || !products[0].IsAvailable {
		t.Fatalf("shoppable product = %+v; want available stock 3", products)
	}

	if _, err := testPool.Exec(ctx,
		`UPDATE inventory SET committed_stock = stock_on_hand WHERE product_variant_id = $1`,
		variantID,
	); err != nil {
		t.Fatalf("commit remaining inventory: %v", err)
	}
	products, err = repo.GetShoppableProducts(ctx, recipeID)
	if err != nil {
		t.Fatalf("get sold-out shoppable products: %v", err)
	}
	if products[0].AvailableStock != 0 || products[0].IsAvailable {
		t.Fatalf("sold-out shoppable product = %+v; want unavailable stock 0", products[0])
	}
}
