//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

func TestProductRepositoryTagPaginationIsTruthfulAndStable(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "tags")
	ctx := context.Background()
	productRepo := repositories.NewProductRepository(testPool)
	tagRepo := repositories.NewTagRepository(testPool)

	firstID := seedProduct(t)
	secondID := seedProduct(t)
	if _, err := testPool.Exec(ctx,
		`UPDATE products SET created_at = '2026-07-19T00:00:00Z' WHERE id = ANY($1)`,
		[]int64{firstID, secondID},
	); err != nil {
		t.Fatalf("align product timestamps: %v", err)
	}
	tag, err := tagRepo.Create(ctx, models.CreateTagReq{Title: "Gift", Slug: "gift"})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}
	for _, productID := range []int64{firstID, secondID} {
		if err := productRepo.AttachTags(ctx, productID, []int64{tag.ID}); err != nil {
			t.Fatalf("attach product %d tag: %v", productID, err)
		}
	}

	active := true
	filter := models.ProductFilter{
		BaseFilter: models.BaseFilter{
			PaginationParams: models.PaginationParams{Page: 1, Limit: 1},
			SortBy:           "created_at",
			OrderBy:          "desc",
		},
		TagID:    &tag.ID,
		IsActive: &active,
	}
	items, total, err := productRepo.GetAll(ctx, filter)
	if err != nil || total != 2 || len(items) != 1 || items[0].ID != secondID {
		t.Fatalf("first page = %+v, total %d, err %v", items, total, err)
	}

	filter.Page = 2
	items, total, err = productRepo.GetAll(ctx, filter)
	if err != nil || total != 2 || len(items) != 1 || items[0].ID != firstID {
		t.Fatalf("second page = %+v, total %d, err %v", items, total, err)
	}

	filter.Page = 99
	items, total, err = productRepo.GetAll(ctx, filter)
	if err != nil || total != 2 || len(items) != 0 {
		t.Fatalf("out-of-range page = %+v, total %d, err %v", items, total, err)
	}
}

func TestProductRepositoryCategoryDescendantsRetainFiltersAndPagination(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "categories")
	ctx := context.Background()
	repo := repositories.NewProductRepository(testPool)

	insertCategory := func(title string, parentID *int64) int64 {
		t.Helper()
		var id int64
		if err := testPool.QueryRow(ctx,
			`INSERT INTO categories (title, parent_id) VALUES ($1, $2) RETURNING id`,
			title, parentID,
		).Scan(&id); err != nil {
			t.Fatalf("insert category %q: %v", title, err)
		}
		return id
	}
	insertProduct := func(title string, categoryID int64, active bool) {
		t.Helper()
		if _, err := testPool.Exec(ctx,
			`INSERT INTO products (title, category_id, is_active) VALUES ($1, $2, $3)`,
			title, categoryID, active,
		); err != nil {
			t.Fatalf("insert product %q: %v", title, err)
		}
	}

	rootID := insertCategory("Root", nil)
	childID := insertCategory("Child", &rootID)
	grandchildID := insertCategory("Grandchild", &childID)
	siblingID := insertCategory("Sibling", nil)
	// A corrupt hierarchy must terminate rather than loop forever. UNION in the
	// recursive CTE deduplicates each visited ID.
	if _, err := testPool.Exec(ctx,
		`UPDATE categories SET parent_id = $1 WHERE id = $2`,
		grandchildID, rootID,
	); err != nil {
		t.Fatalf("create category cycle: %v", err)
	}

	insertProduct("Root Malt", rootID, true)
	insertProduct("Child Malt", childID, true)
	insertProduct("Grand Malt", grandchildID, true)
	insertProduct("Sibling Malt", siblingID, true)
	insertProduct("Inactive Malt", childID, false)

	active := true
	filter := models.ProductFilter{
		BaseFilter: models.BaseFilter{
			PaginationParams: models.PaginationParams{Page: 1, Limit: 2},
			SortBy:           "title",
			OrderBy:          "asc",
			Search:           "Malt",
		},
		CategoryID:         &rootID,
		IncludeDescendants: true,
		IsActive:           &active,
	}

	items, total, err := repo.GetAll(ctx, filter)
	if err != nil || total != 3 || len(items) != 2 {
		t.Fatalf("descendant first page = %+v, total %d, err %v", items, total, err)
	}
	if items[0].Title != "Child Malt" || items[1].Title != "Grand Malt" {
		t.Fatalf("descendant first-page order = %q, %q", items[0].Title, items[1].Title)
	}

	filter.Page = 2
	items, total, err = repo.GetAll(ctx, filter)
	if err != nil || total != 3 || len(items) != 1 || items[0].Title != "Root Malt" {
		t.Fatalf("descendant second page = %+v, total %d, err %v", items, total, err)
	}

	filter.Page = 1
	filter.IncludeDescendants = false
	items, total, err = repo.GetAll(ctx, filter)
	if err != nil || total != 1 || len(items) != 1 || items[0].Title != "Root Malt" {
		t.Fatalf("direct category page = %+v, total %d, err %v", items, total, err)
	}
}

func TestProductRepositoryListUsesSellableStockAndCompleteImageMetadata(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	repo := repositories.NewProductRepository(testPool)

	var productID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO products (title, slug, is_active)
		 VALUES ('Reserved Bottle', 'reserved-bottle', TRUE)
		 RETURNING id`,
	).Scan(&productID); err != nil {
		t.Fatalf("insert product: %v", err)
	}
	var variantID int64
	if err := testPool.QueryRow(ctx,
		`INSERT INTO product_variants (product_id, sku, price, is_active)
		 VALUES ($1, 'RESERVED-1', 125, TRUE)
		 RETURNING id`,
		productID,
	).Scan(&variantID); err != nil {
		t.Fatalf("insert variant: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO inventory (product_variant_id, stock_on_hand, committed_stock)
		 VALUES ($1, 3, 3)`,
		variantID,
	); err != nil {
		t.Fatalf("insert inventory: %v", err)
	}
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
		 VALUES ($1, '/media/reserved.webp', 4, TRUE)`,
		productID,
	); err != nil {
		t.Fatalf("insert image: %v", err)
	}

	active := true
	filter := models.ProductFilter{
		BaseFilter: models.BaseFilter{
			PaginationParams: models.PaginationParams{Page: 1, Limit: 12},
			SortBy:           "created_at",
			OrderBy:          "desc",
		},
		IsActive: &active,
	}
	items, total, err := repo.GetAll(ctx, filter)
	if err != nil || total != 1 || len(items) != 1 {
		t.Fatalf("reserved list = %+v, total %d, err %v", items, total, err)
	}
	item := items[0]
	if item.AvailableVariantCount != 0 || item.PurchasableVariantID != nil {
		t.Fatalf("fully committed item is purchasable: %+v", item)
	}
	if item.Image == nil || item.Image.SortOrder != 4 || !item.Image.IsPrimary {
		t.Fatalf("list image metadata = %+v", item.Image)
	}

	if _, err := testPool.Exec(ctx,
		`UPDATE inventory SET committed_stock = 2 WHERE product_variant_id = $1`,
		variantID,
	); err != nil {
		t.Fatalf("release inventory: %v", err)
	}
	items, total, err = repo.GetAll(ctx, filter)
	if err != nil || total != 1 || len(items) != 1 {
		t.Fatalf("available list = %+v, total %d, err %v", items, total, err)
	}
	item = items[0]
	if item.AvailableVariantCount != 1 || item.PurchasableVariantID == nil || *item.PurchasableVariantID != variantID {
		t.Fatalf("released item availability = %+v", item)
	}
}

func TestProductRepositorySearchTreatsSQLWildcardsLiterally(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	repo := repositories.NewProductRepository(testPool)

	for _, title := range []string{"Percent % Reserve", "Under _ Reserve", `Back\slash Reserve`, "Plain Reserve"} {
		if _, err := testPool.Exec(ctx,
			`INSERT INTO products (title, is_active) VALUES ($1, TRUE)`,
			title,
		); err != nil {
			t.Fatalf("insert product %q: %v", title, err)
		}
	}
	active := true
	for search, wantTitle := range map[string]string{
		"%": "Percent % Reserve",
		"_": "Under _ Reserve",
		`\`: `Back\slash Reserve`,
	} {
		items, total, err := repo.GetAll(ctx, models.ProductFilter{
			BaseFilter: models.BaseFilter{
				PaginationParams: models.PaginationParams{Page: 1, Limit: 12},
				SortBy:           "title",
				OrderBy:          "asc",
				Search:           search,
			},
			IsActive: &active,
		})
		if err != nil || total != 1 || len(items) != 1 || items[0].Title != wantTitle {
			t.Fatalf("literal search %q = %+v, total %d, err %v; want %q", search, items, total, err, wantTitle)
		}
	}
}
