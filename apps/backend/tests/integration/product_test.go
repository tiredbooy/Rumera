//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/handlers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/apperr"
	"go.uber.org/zap"
)

func TestProductAdminCreateEditAndReadDraftWithTags(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "tags")
	ctx := context.Background()
	productRepo := repositories.NewProductRepository(testPool)
	tagRepo := repositories.NewTagRepository(testPool)

	firstTag, err := tagRepo.Create(ctx, models.CreateTagReq{Title: "First", Slug: "first"})
	if err != nil {
		t.Fatalf("create first tag: %v", err)
	}
	secondTag, err := tagRepo.Create(ctx, models.CreateTagReq{Title: "Second", Slug: "second"})
	if err != nil {
		t.Fatalf("create second tag: %v", err)
	}
	slug, code := "admin-draft", "ADMIN-DRAFT"
	created, err := productRepo.Create(ctx, models.CreateProductReq{
		Title: "Admin Draft", Slug: &slug, Code: &code,
		TagIDs: []int64{firstTag.ID, firstTag.ID},
	})
	if err != nil {
		t.Fatalf("create product with tags: %v", err)
	}
	tags, err := productRepo.GetTags(ctx, created.ID)
	if err != nil || len(tags) != 1 || tags[0].ID != firstTag.ID {
		t.Fatalf("created tags = %+v, %v; want first tag once", tags, err)
	}

	service := services.NewProductService(productRepo, nil, nil)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := handlers.New(handlers.Deps{Product: service, Log: zap.NewNop()})
	router.PATCH("/admin/products/:id", handler.UpdateProduct)
	router.GET("/admin/products/:id", handler.GetAdminProduct)
	router.GET("/products/:id/tags", handler.ProductTags)

	updateBody := fmt.Sprintf(
		`{"slug":%q,"code":%q,"is_active":false,"tag_ids":[%d]}`,
		slug, code, secondTag.ID,
	)
	updateRequest := httptest.NewRequest(
		http.MethodPatch, fmt.Sprintf("/admin/products/%d", created.ID), strings.NewReader(updateBody),
	)
	updateRequest.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	router.ServeHTTP(updateRecorder, updateRequest)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("admin update status/body = %d/%s; want 200", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updateEnvelope struct {
		Data models.ProductDetail `json:"data"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updateEnvelope); err != nil {
		t.Fatalf("decode admin update: %v", err)
	}
	if updateEnvelope.Data.IsActive || len(updateEnvelope.Data.Tags) != 1 || updateEnvelope.Data.Tags[0].ID != secondTag.ID {
		t.Fatalf("admin update detail = %+v; want inactive product with second tag", updateEnvelope.Data)
	}
	tags, err = productRepo.GetTags(ctx, created.ID)
	if err != nil || len(tags) != 1 || tags[0].ID != secondTag.ID {
		t.Fatalf("updated tags = %+v, %v; want second tag", tags, err)
	}
	if _, err := service.GetByID(ctx, created.ID); !errors.Is(err, apperr.ErrProductNotFound) {
		t.Fatalf("public draft read error = %v; want ErrProductNotFound", err)
	}
	adminProduct, err := service.GetByIDForAdmin(ctx, created.ID)
	if err != nil || adminProduct.IsActive {
		t.Fatalf("admin draft read = %+v, %v", adminProduct, err)
	}
	publicRecorder := httptest.NewRecorder()
	router.ServeHTTP(publicRecorder, httptest.NewRequest(
		http.MethodGet, fmt.Sprintf("/products/%d/tags", created.ID), nil,
	))
	if publicRecorder.Code != http.StatusNotFound {
		t.Fatalf("public draft tags status/body = %d/%s; want 404", publicRecorder.Code, publicRecorder.Body.String())
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(
		http.MethodGet, fmt.Sprintf("/admin/products/%d", created.ID), nil,
	))
	if recorder.Code != http.StatusOK {
		t.Fatalf("admin detail status/body = %d/%s; want 200", recorder.Code, recorder.Body.String())
	}
	var envelope struct {
		Data models.ProductDetail `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode admin detail: %v", err)
	}
	if envelope.Data.ID != created.ID || envelope.Data.IsActive || len(envelope.Data.Tags) != 1 || envelope.Data.Tags[0].ID != secondTag.ID {
		t.Fatalf("admin detail = %+v; want inactive product with second tag", envelope.Data)
	}

	clearRequest := httptest.NewRequest(
		http.MethodPatch, fmt.Sprintf("/admin/products/%d", created.ID), strings.NewReader(`{"tag_ids":[]}`),
	)
	clearRequest.Header.Set("Content-Type", "application/json")
	clearRecorder := httptest.NewRecorder()
	router.ServeHTTP(clearRecorder, clearRequest)
	if clearRecorder.Code != http.StatusOK {
		t.Fatalf("clear draft tags status/body = %d/%s; want 200", clearRecorder.Code, clearRecorder.Body.String())
	}
	tags, err = productRepo.GetTags(ctx, created.ID)
	if err != nil || len(tags) != 0 {
		t.Fatalf("cleared tags = %+v, %v; want empty", tags, err)
	}
}

func TestProductDetailHydratesVariantOptionsAndImages(t *testing.T) {
	requireDB(t)
	resetTables(t, "products", "option_types")
	ctx := context.Background()
	optionService := services.NewOptionService(repositories.NewOptionRepository(testPool))

	volume, err := optionService.CreateType(ctx, models.CreateOptionTypeReq{
		Title: "volume", DisplayName: "حجم",
	})
	if err != nil {
		t.Fatalf("create volume type: %v", err)
	}
	volume750, err := optionService.CreateValue(ctx, volume.ID, models.CreateOptionValueReq{
		Value: "۷۵۰ میلی‌لیتر", SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("create volume value: %v", err)
	}

	productRepo := repositories.NewProductRepository(testPool)
	product, err := productRepo.Create(ctx, models.CreateProductReq{
		Title: "Hydrated product",
		Variants: []models.CreateVariantReq{{
			SKU: stringPointer("HYDRATED-750"), Price: 125,
			OptionValueIDs: []int64{volume750.ID},
		}},
	})
	if err != nil {
		t.Fatalf("create hydrated product: %v", err)
	}
	variants, err := productRepo.GetVariants(ctx, product.ID)
	if err != nil || len(variants) != 1 {
		t.Fatalf("created variants = %+v, %v; want one", variants, err)
	}
	variantID := variants[0].ID
	if _, err := testPool.Exec(ctx,
		`INSERT INTO product_images
			(product_id, product_variant_id, image_url, sort_order, is_primary)
		 VALUES ($1, NULL, '/media/products/main.webp', 0, TRUE),
		        ($1, $2, '/media/products/variant.webp', 0, TRUE)`,
		product.ID, variantID,
	); err != nil {
		t.Fatalf("insert independently-primary product and variant images: %v", err)
	}

	handler := handlers.New(handlers.Deps{
		Product: services.NewProductService(productRepo, nil, nil),
		Log:     zap.NewNop(),
	})
	router := gin.New()
	router.GET("/admin/products/:id", handler.GetAdminProduct)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(
		http.MethodGet, fmt.Sprintf("/admin/products/%d", product.ID), nil,
	))
	if recorder.Code != http.StatusOK {
		t.Fatalf("hydrated product status/body = %d/%s", recorder.Code, recorder.Body.String())
	}
	var envelope struct {
		Data models.ProductDetail `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode hydrated detail: %v", err)
	}
	if len(envelope.Data.Images) != 1 || envelope.Data.Images[0].ImageURL != "/media/products/main.webp" {
		t.Fatalf("product gallery = %+v; want only the product-level image", envelope.Data.Images)
	}
	if len(envelope.Data.Variants) != 1 {
		t.Fatalf("detail variants = %+v; want one", envelope.Data.Variants)
	}
	variant := envelope.Data.Variants[0]
	if len(variant.Options) != 1 ||
		variant.Options[0].ID != volume750.ID ||
		variant.Options[0].OptionTypeID != volume.ID ||
		variant.Options[0].OptionTypeTitle != "volume" ||
		variant.Options[0].OptionType != "حجم" {
		t.Fatalf("hydrated variant options = %+v", variant.Options)
	}
	if len(variant.Images) != 1 ||
		variant.Images[0].ImageURL != "/media/products/variant.webp" ||
		!variant.Images[0].IsPrimary {
		t.Fatalf("hydrated variant images = %+v", variant.Images)
	}
}

func TestProductVariantImageOwnershipAndGalleryScope(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	productRepo := repositories.NewProductRepository(testPool)
	imageRepo := repositories.NewProductImageRepository(testPool)

	firstProductID := seedProduct(t)
	secondProductID := seedProduct(t)
	variantService := services.NewVariantService(repositories.NewVariantRepository(testPool), nil)
	variant, err := variantService.Create(ctx, firstProductID, models.CreateVariantReq{
		SKU: stringPointer("IMAGE-SCOPE"), Price: 10,
	})
	if err != nil {
		t.Fatalf("create image-scope variant: %v", err)
	}

	productImage, err := imageRepo.Create(ctx, &models.ProductImage{
		ProductID: &firstProductID,
		ImageURL:  "/media/products/gallery.webp",
	})
	if err != nil || !productImage.IsPrimary || productImage.SortOrder != 0 {
		t.Fatalf("create product gallery image = %+v, %v", productImage, err)
	}
	variantImage, err := imageRepo.Create(ctx, &models.ProductImage{
		ProductID:        &firstProductID,
		ProductVariantID: &variant.ID,
		ImageURL:         "/media/products/variant-primary.webp",
	})
	if err != nil || !variantImage.IsPrimary || variantImage.SortOrder != 0 {
		t.Fatalf("create variant gallery image = %+v, %v", variantImage, err)
	}
	secondVariantImage, err := imageRepo.Create(ctx, &models.ProductImage{
		ProductID:        &firstProductID,
		ProductVariantID: &variant.ID,
		ImageURL:         "/media/products/variant-second.webp",
	})
	if err != nil || secondVariantImage.IsPrimary || secondVariantImage.SortOrder != 1 {
		t.Fatalf("create second variant image = %+v, %v", secondVariantImage, err)
	}
	if _, err := imageRepo.Create(ctx, &models.ProductImage{
		ProductID:        &secondProductID,
		ProductVariantID: &variant.ID,
		ImageURL:         "/media/products/wrong-owner.webp",
	}); !errors.Is(err, models.ErrInvalidState) {
		t.Fatalf("mismatched variant image error = %v; want invalid state", err)
	}

	filter := models.ProductFilter{}
	filter.Defaults()
	items, _, err := productRepo.GetAll(ctx, filter)
	if err != nil {
		t.Fatalf("list products with scoped images: %v", err)
	}
	for _, item := range items {
		if item.ID != firstProductID {
			continue
		}
		if item.Image == nil || item.Image.ImageURL != productImage.ImageURL {
			t.Fatalf("product list image = %+v; want gallery image", item.Image)
		}
		return
	}
	t.Fatalf("product %d missing from list", firstProductID)
}

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
	limitedTag, err := tagRepo.Create(ctx, models.CreateTagReq{Title: "Limited", Slug: "limited"})
	if err != nil {
		t.Fatalf("create second tag: %v", err)
	}
	for _, productID := range []int64{firstID, secondID} {
		tagIDs := []int64{tag.ID}
		if productID == secondID {
			tagIDs = append(tagIDs, limitedTag.ID)
		}
		if err := productRepo.AttachTags(ctx, productID, tagIDs); err != nil {
			t.Fatalf("attach product %d tag: %v", productID, err)
		}
	}
	if err := productRepo.AttachTags(ctx, secondID, []int64{tag.ID}); err != nil {
		t.Fatalf("reattach existing product tag: %v", err)
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
	if got := items[0].Tags; len(got) != 2 || got[0].Title != "Gift" || got[1].Title != "Limited" {
		t.Fatalf("first page tags = %+v; want Gift and Limited", got)
	}

	filter.Page = 2
	items, total, err = productRepo.GetAll(ctx, filter)
	if err != nil || total != 2 || len(items) != 1 || items[0].ID != firstID {
		t.Fatalf("second page = %+v, total %d, err %v", items, total, err)
	}
	if got := items[0].Tags; len(got) != 1 || got[0].Title != "Gift" {
		t.Fatalf("second page tags = %+v; want Gift", got)
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
