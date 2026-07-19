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
