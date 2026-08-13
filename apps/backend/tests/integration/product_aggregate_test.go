//go:build integration

package integration

import (
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/features/catalog/product"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/tiredbooy/internal/features/catalog/option"
	"github.com/tiredbooy/internal/features/catalog/tag"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

func TestProductAggregateIsAtomicRecoverableAndReplayable(t *testing.T) {
	requireDB(t)
	resetTables(t, "product_aggregate_operations", "products", "tags")
	ctx := context.Background()
	productRepo := product.NewRepository(testPool)
	service := product.NewService(productRepo, nil, nil)
	tagRepo := tag.NewRepository(testPool)
	createdTag, err := tagRepo.Create(ctx, tag.CreateTagReq{Title: "Featured", Slug: "featured"})
	if err != nil {
		t.Fatalf("create aggregate tag: %v", err)
	}

	code := "AGG-1"
	imageURL := "https://images.example/aggregate.webp"
	createReq := product.SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Aggregate product",
		Code:        &code,
		IsActive:    false,
		TagIDs:      []int64{createdTag.ID},
		Variants: []product.SaveProductVariantReq{{
			SKU: stringPointer("AGG-ONE"), Price: 125, IsActive: true,
		}},
		Images: []product.SaveProductImageReq{{
			ImageURL: &imageURL, IsPrimary: true,
		}},
	}
	created, err := service.SaveAggregate(ctx, 0, createReq)
	if err != nil {
		t.Fatalf("create aggregate: %v", err)
	}
	replayed, err := service.SaveAggregate(ctx, 0, createReq)
	if err != nil || replayed.ID != created.ID {
		t.Fatalf("replay aggregate create = %+v, %v; want product %d", replayed, err, created.ID)
	}
	assertRowCount(t, "products", 1)
	assertRowCount(t, "product_variants", 1)
	assertRowCount(t, "product_images", 1)
	assertRowCount(t, "product_aggregate_operations", 1)

	failedOperationID := uuid.NewString()
	failedReq := product.SaveProductAggregateReq{
		OperationID:       failedOperationID,
		ExpectedUpdatedAt: &created.UpdatedAt,
		Title:             "Must roll back",
		IsActive:          true,
		TagIDs:            []int64{createdTag.ID + 1000},
		Variants: []product.SaveProductVariantReq{{
			ID:  aggregateInt64Pointer(singleVariantID(t, productRepo, created.ID)),
			SKU: stringPointer("CHANGED-IN-FAILED-TX"), Price: 250, IsActive: true,
		}},
		Images: existingAggregateImages(t, productRepo, created.ID),
	}
	_, err = service.SaveAggregate(ctx, created.ID, failedReq)
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("failed aggregate error = %v; want validation", err)
	}
	assertAppField(t, err, "tag_ids")

	afterFailure, err := productRepo.GetByIDForAdmin(ctx, created.ID)
	if err != nil || afterFailure.Title != created.Title || afterFailure.IsActive != created.IsActive {
		t.Fatalf("product after rollback = %+v, %v; want original", afterFailure, err)
	}
	variants, err := productRepo.GetVariants(ctx, created.ID)
	if err != nil || len(variants) != 1 || variants[0].SKU == nil || *variants[0].SKU != "AGG-ONE" {
		t.Fatalf("variants after rollback = %+v, %v; want original SKU", variants, err)
	}
	assertRowCount(t, "product_aggregate_operations", 1)

	failedReq.Title = "Recovered product"
	failedReq.TagIDs = []int64{createdTag.ID}
	failedReq.Variants[0].SKU = stringPointer("RECOVERED-SKU")
	recovered, err := service.SaveAggregate(ctx, created.ID, failedReq)
	if err != nil || recovered.Title != "Recovered product" {
		t.Fatalf("retry rolled-back operation = %+v, %v", recovered, err)
	}
	assertRowCount(t, "product_aggregate_operations", 2)

	differentContent := failedReq
	differentContent.Title = "Operation collision"
	_, err = service.SaveAggregate(ctx, created.ID, differentContent)
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("reused operation with different content error = %v; want conflict", err)
	}
	assertAppField(t, err, "operation_id")
	current, err := productRepo.GetByIDForAdmin(ctx, created.ID)
	if err != nil || current.Title != "Recovered product" {
		t.Fatalf("product after operation collision = %+v, %v", current, err)
	}
}

func TestProductAggregateSwapsGraphAndPreservesInventory(t *testing.T) {
	requireDB(t)
	resetTables(t, "product_aggregate_operations", "products", "tags", "option_types")
	ctx := context.Background()
	productRepo := product.NewRepository(testPool)
	service := product.NewService(productRepo, nil, nil)
	optionService := option.NewService(option.NewRepository(testPool))
	tagRepo := tag.NewRepository(testPool)

	firstTag, err := tagRepo.Create(ctx, tag.CreateTagReq{Title: "Old", Slug: "old"})
	if err != nil {
		t.Fatalf("create first tag: %v", err)
	}
	secondTag, err := tagRepo.Create(ctx, tag.CreateTagReq{Title: "New", Slug: "new"})
	if err != nil {
		t.Fatalf("create second tag: %v", err)
	}
	color, err := optionService.CreateType(ctx, option.CreateOptionTypeReq{Title: "color", DisplayName: "Color"})
	if err != nil {
		t.Fatalf("create color type: %v", err)
	}
	red, err := optionService.CreateValue(ctx, color.ID, option.CreateOptionValueReq{Value: "Red"})
	if err != nil {
		t.Fatalf("create red value: %v", err)
	}
	blue, err := optionService.CreateValue(ctx, color.ID, option.CreateOptionValueReq{Value: "Blue"})
	if err != nil {
		t.Fatalf("create blue value: %v", err)
	}

	code, slug := "SWAP-BASE", "swap-base"
	description, origin := "Clear me", "Scotland"
	metaTitle, metaDescription := "Meta", "Meta description"
	abv, weight := 40.0, 750.0
	oldImageURL := "https://images.example/old.webp"
	created, err := service.SaveAggregate(ctx, 0, product.SaveProductAggregateReq{
		OperationID:     uuid.NewString(),
		Title:           "Swap product",
		Code:            &code,
		Slug:            &slug,
		Description:     &description,
		CountryOfOrigin: &origin,
		ABV:             &abv,
		Weight:          &weight,
		IsActive:        true,
		MetaTitle:       &metaTitle,
		MetaDescription: &metaDescription,
		MetaTags:        []string{"old"},
		TagIDs:          []int64{firstTag.ID},
		Variants: []product.SaveProductVariantReq{
			{SKU: stringPointer("SWAP-RED"), Price: 100, IsActive: true, OptionValueIDs: []int64{red.ID}},
			{SKU: stringPointer("SWAP-BLUE"), Price: 110, IsActive: true, OptionValueIDs: []int64{blue.ID}},
		},
		Images: []product.SaveProductImageReq{{ImageURL: &oldImageURL, IsPrimary: true}},
	})
	if err != nil {
		t.Fatalf("create swappable aggregate: %v", err)
	}
	variants, err := productRepo.GetVariants(ctx, created.ID)
	if err != nil || len(variants) != 2 {
		t.Fatalf("created variants = %+v, %v", variants, err)
	}
	redVariant, blueVariant := variants[0], variants[1]
	seedInventory(t, redVariant.ID, 23, 4)
	if err := variant.NewService(
		variant.NewRepository(testPool), inventory.NewRepository(testPool), nil,
	).Delete(ctx, redVariant.ID); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("standalone stocked variant deletion error = %v; want conflict", err)
	}
	if _, err := testPool.Exec(ctx, `
		INSERT INTO product_images (
			product_id, product_variant_id, image_url, storage_key, sort_order, is_primary
		) VALUES ($1, $2, '/media/products/variant.webp', 'products/variant.webp', 0, TRUE)`,
		created.ID, redVariant.ID,
	); err != nil {
		t.Fatalf("insert retained variant image: %v", err)
	}

	newImageURL := "https://images.example/new.webp"
	updated, err := service.SaveAggregate(ctx, created.ID, product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &created.UpdatedAt,
		Title:             "Swapped and cleared",
		IsActive:          false,
		TagIDs:            []int64{secondTag.ID},
		Variants: []product.SaveProductVariantReq{
			{ID: &redVariant.ID, SKU: stringPointer("SWAP-BLUE"), Price: 120, IsActive: false, OptionValueIDs: []int64{blue.ID}},
			{ID: &blueVariant.ID, SKU: stringPointer("SWAP-RED"), Price: 130, IsActive: true, OptionValueIDs: []int64{red.ID}},
		},
		Images: []product.SaveProductImageReq{{ImageURL: &newImageURL, IsPrimary: true}},
	})
	if err != nil {
		t.Fatalf("swap aggregate graph: %v", err)
	}
	if updated.Code != nil || updated.Slug != nil || updated.Description != nil ||
		updated.CountryOfOrigin != nil || updated.ABV != nil || updated.Weight != nil ||
		updated.MetaTitle != nil || updated.MetaDescription != nil || len(updated.MetaTags) != 0 {
		t.Fatalf("nullable fields were not cleared: %+v", updated)
	}

	variants, err = productRepo.GetVariants(ctx, created.ID)
	if err != nil || len(variants) != 2 {
		t.Fatalf("updated variants = %+v, %v", variants, err)
	}
	byID := map[int64]*variant.ProductVariant{variants[0].ID: variants[0], variants[1].ID: variants[1]}
	if byID[redVariant.ID].SKU == nil || *byID[redVariant.ID].SKU != "SWAP-BLUE" || byID[redVariant.ID].IsActive {
		t.Fatalf("first retained variant = %+v", byID[redVariant.ID])
	}
	if byID[blueVariant.ID].SKU == nil || *byID[blueVariant.ID].SKU != "SWAP-RED" {
		t.Fatalf("second retained variant = %+v", byID[blueVariant.ID])
	}
	options, err := productRepo.GetVariantOptions(ctx, created.ID)
	if err != nil || len(options[redVariant.ID]) != 1 || options[redVariant.ID][0].ID != blue.ID ||
		len(options[blueVariant.ID]) != 1 || options[blueVariant.ID][0].ID != red.ID {
		t.Fatalf("swapped options = %+v, %v", options, err)
	}
	var onHand, committed int
	if err := testPool.QueryRow(ctx, `
		SELECT stock_on_hand, committed_stock FROM inventory WHERE product_variant_id = $1`,
		redVariant.ID,
	).Scan(&onHand, &committed); err != nil || onHand != 23 || committed != 4 {
		t.Fatalf("retained inventory = %d/%d, %v; want 23/4", onHand, committed, err)
	}
	var variantImageCount int
	if err := testPool.QueryRow(ctx, `
		SELECT count(*) FROM product_images WHERE product_variant_id = $1`, redVariant.ID,
	).Scan(&variantImageCount); err != nil || variantImageCount != 1 {
		t.Fatalf("retained variant image count = %d, %v; want 1", variantImageCount, err)
	}
	images, err := productRepo.GetImages(ctx, created.ID)
	if err != nil || len(images) != 1 || images[0].ImageURL != newImageURL || !images[0].IsPrimary {
		t.Fatalf("replaced product gallery = %+v, %v", images, err)
	}
	tags, err := productRepo.GetTags(ctx, created.ID)
	if err != nil || len(tags) != 1 || tags[0].ID != secondTag.ID {
		t.Fatalf("replaced tags = %+v, %v", tags, err)
	}

	staleReq := product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &created.UpdatedAt,
		Title:             "Stale overwrite",
		IsActive:          true,
		Variants: []product.SaveProductVariantReq{
			{ID: &redVariant.ID, SKU: stringPointer("SWAP-BLUE"), Price: 120, IsActive: false, OptionValueIDs: []int64{blue.ID}},
			{ID: &blueVariant.ID, SKU: stringPointer("SWAP-RED"), Price: 130, IsActive: true, OptionValueIDs: []int64{red.ID}},
		},
		Images: existingAggregateImages(t, productRepo, created.ID),
	}
	_, err = service.SaveAggregate(ctx, created.ID, staleReq)
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("stale aggregate error = %v; want conflict", err)
	}
	assertAppField(t, err, "expected_updated_at")

	deleteStockedReq := product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &updated.UpdatedAt,
		Title:             "Must retain stocked variant",
		IsActive:          false,
		Variants: []product.SaveProductVariantReq{{
			ID: &blueVariant.ID, SKU: stringPointer("SWAP-RED"), Price: 130, IsActive: true, OptionValueIDs: []int64{red.ID},
		}},
		Images: existingAggregateImages(t, productRepo, created.ID),
	}
	_, err = service.SaveAggregate(ctx, created.ID, deleteStockedReq)
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("delete stocked variant error = %v; want conflict", err)
	}
	assertAppField(t, err, "variants")
	assertRowCount(t, "product_variants", 2)

	deleteUnusedReq := product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &updated.UpdatedAt,
		Title:             "Unused variant removed",
		IsActive:          false,
		Variants: []product.SaveProductVariantReq{{
			ID: &redVariant.ID, SKU: stringPointer("SWAP-BLUE"), Price: 120, IsActive: false, OptionValueIDs: []int64{blue.ID},
		}},
		Images: existingAggregateImages(t, productRepo, created.ID),
	}
	removed, err := service.SaveAggregate(ctx, created.ID, deleteUnusedReq)
	if err != nil || removed.Title != "Unused variant removed" {
		t.Fatalf("delete unused variant = %+v, %v", removed, err)
	}
	assertRowCount(t, "product_variants", 1)
	if err := testPool.QueryRow(ctx,
		`SELECT stock_on_hand FROM inventory WHERE product_variant_id = $1`, redVariant.ID,
	).Scan(&onHand); err != nil || onHand != 23 {
		t.Fatalf("inventory after unused deletion = %d, %v; want 23", onHand, err)
	}
}

func TestProductAggregatePreparedMediaCleanupDoesNotBreakReplay(t *testing.T) {
	requireDB(t)
	resetTables(t, "product_aggregate_operations", "products")
	ctx := context.Background()
	productRepo := product.NewRepository(testPool)
	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create aggregate media store: %v", err)
	}
	cache, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create aggregate media cache: %v", err)
	}
	lifecycle := media.NewLifecycleService(
		store, cache, media.NewLifecycleRepository(testPool), zap.NewNop(),
	)
	media := media.NewService(
		store,
		cache,
		product.NewImageRepository(testPool),
		productRepo,
		media.NewContentRepository(testPool),
		lifecycle,
		imaging.New(),
		media.Config{
			MaxUploadBytes: 1 << 20, MaxDimension: 4000,
			MaxSourceDimension: 12000, MaxSourcePixels: 40_000_000,
		},
		zap.NewNop(),
	)
	upload, err := media.UploadImage(ctx, "uploads", integrationPNG(t))
	if err != nil {
		t.Fatalf("stage aggregate media: %v", err)
	}
	service := product.NewService(productRepo, lifecycle, media)
	createReq := product.SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Prepared media product",
		IsActive:    true,
		Images: []product.SaveProductImageReq{{
			StorageKey: &upload.Key,
			IsPrimary:  true,
		}},
	}
	created, err := service.SaveAggregate(ctx, 0, createReq)
	if err != nil {
		t.Fatalf("attach prepared aggregate media: %v", err)
	}
	images, err := productRepo.GetImages(ctx, created.ID)
	if err != nil || len(images) != 1 || images[0].StorageKey == nil ||
		*images[0].StorageKey != upload.Key || images[0].Width == nil || *images[0].Width != 2 {
		t.Fatalf("prepared aggregate image = %+v, %v", images, err)
	}

	withoutImage, err := service.SaveAggregate(ctx, created.ID, product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &created.UpdatedAt,
		Title:             "Prepared media removed",
		IsActive:          true,
	})
	if err != nil {
		t.Fatalf("remove prepared aggregate media: %v", err)
	}
	if exists, err := store.Exists(ctx, upload.Key); err != nil || exists {
		t.Fatalf("detached prepared media exists = %v, %v; want false, nil", exists, err)
	}

	replayed, err := service.SaveAggregate(ctx, 0, createReq)
	if err != nil || replayed.ID != withoutImage.ID {
		t.Fatalf("replay after prepared media cleanup = %+v, %v; want product %d", replayed, err, withoutImage.ID)
	}
}

func TestProductAggregateEndpointReturnsStructuredFieldErrors(t *testing.T) {
	requireDB(t)
	resetTables(t, "product_aggregate_operations", "products", "tags")
	productRepo := product.NewRepository(testPool)
	handler := product.NewHandler(product.NewService(productRepo, nil, nil), validator.New(), nil, zap.NewNop())
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/admin/products/aggregate", handler.CreateProductAggregate)
	router.PUT("/admin/products/:id/aggregate", handler.UpdateProductAggregate)

	createBody, err := json.Marshal(product.SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Endpoint aggregate",
		IsActive:    false,
	})
	if err != nil {
		t.Fatalf("marshal aggregate create: %v", err)
	}
	createRequest := httptest.NewRequest(
		http.MethodPost, "/admin/products/aggregate", bytes.NewReader(createBody),
	)
	createRequest.Header.Set("Content-Type", "application/json")
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("aggregate create status/body = %d/%s", createRecorder.Code, createRecorder.Body.String())
	}
	var createdEnvelope struct {
		Data models.ProductDetail `json:"data"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createdEnvelope); err != nil {
		t.Fatalf("decode aggregate create: %v", err)
	}

	invalidBody, err := json.Marshal(product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &createdEnvelope.Data.UpdatedAt,
		Title:             "Must roll back",
		TagIDs:            []int64{999999},
	})
	if err != nil {
		t.Fatalf("marshal aggregate update: %v", err)
	}
	invalidRequest := httptest.NewRequest(
		http.MethodPut,
		"/admin/products/"+fmt.Sprint(createdEnvelope.Data.ID)+"/aggregate",
		bytes.NewReader(invalidBody),
	)
	invalidRequest.Header.Set("Content-Type", "application/json")
	invalidRecorder := httptest.NewRecorder()
	router.ServeHTTP(invalidRecorder, invalidRequest)
	if invalidRecorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("aggregate validation status/body = %d/%s; want 422", invalidRecorder.Code, invalidRecorder.Body.String())
	}
	var errorEnvelope struct {
		Error struct {
			Code   string              `json:"code"`
			Fields map[string][]string `json:"fields"`
		} `json:"error"`
	}
	if err := json.Unmarshal(invalidRecorder.Body.Bytes(), &errorEnvelope); err != nil {
		t.Fatalf("decode aggregate validation: %v", err)
	}
	if errorEnvelope.Error.Code != "VALIDATION_ERROR" || len(errorEnvelope.Error.Fields["tag_ids"]) == 0 {
		t.Fatalf("aggregate validation envelope = %+v", errorEnvelope.Error)
	}
	current, err := productRepo.GetByIDForAdmin(context.Background(), createdEnvelope.Data.ID)
	if err != nil || current.Title != "Endpoint aggregate" {
		t.Fatalf("product after endpoint rollback = %+v, %v", current, err)
	}
}

func TestGranularGraphWritesInvalidateAggregateRevision(t *testing.T) {
	requireDB(t)
	resetTables(t, "product_aggregate_operations", "products")
	ctx := context.Background()
	productRepo := product.NewRepository(testPool)
	aggregateService := product.NewService(productRepo, nil, nil)
	imageURL := "https://images.example/revision.webp"
	created, err := aggregateService.SaveAggregate(ctx, 0, product.SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Revision product",
		IsActive:    true,
		Variants: []product.SaveProductVariantReq{{
			SKU: stringPointer("REVISION-SKU"), Price: 100, IsActive: true,
		}},
		Images: []product.SaveProductImageReq{{ImageURL: &imageURL, IsPrimary: true}},
	})
	if err != nil {
		t.Fatalf("create revision aggregate: %v", err)
	}
	variantID := singleVariantID(t, productRepo, created.ID)
	time.Sleep(2 * time.Millisecond)
	price := 125.0
	if _, err := variant.NewService(
		variant.NewRepository(testPool), inventory.NewRepository(testPool), nil,
	).Update(ctx, variantID, variant.UpdateVariantReq{Price: &price}); err != nil {
		t.Fatalf("granular variant update: %v", err)
	}
	_, err = aggregateService.SaveAggregate(ctx, created.ID, product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &created.UpdatedAt,
		Title:             "Stale after variant",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("aggregate after granular variant error = %v; want conflict", err)
	}
	assertAppField(t, err, "expected_updated_at")

	current, err := productRepo.GetByIDForAdmin(ctx, created.ID)
	if err != nil {
		t.Fatalf("read revision after variant update: %v", err)
	}
	images, err := productRepo.GetImages(ctx, created.ID)
	if err != nil || len(images) != 1 {
		t.Fatalf("revision images = %+v, %v", images, err)
	}
	time.Sleep(2 * time.Millisecond)
	alt := "Updated outside aggregate"
	if _, err := product.NewImageRepository(testPool).UpdateAlt(ctx, images[0].ID, &alt); err != nil {
		t.Fatalf("granular image update: %v", err)
	}
	_, err = aggregateService.SaveAggregate(ctx, created.ID, product.SaveProductAggregateReq{
		OperationID:       uuid.NewString(),
		ExpectedUpdatedAt: &current.UpdatedAt,
		Title:             "Stale after image",
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("aggregate after granular image error = %v; want conflict", err)
	}
	assertAppField(t, err, "expected_updated_at")
}

func existingAggregateImages(
	t *testing.T,
	repo product.Repository,
	productID int64,
) []product.SaveProductImageReq {
	t.Helper()
	images, err := repo.GetImages(context.Background(), productID)
	if err != nil {
		t.Fatalf("read aggregate images: %v", err)
	}
	result := make([]product.SaveProductImageReq, len(images))
	for i, image := range images {
		result[i] = product.SaveProductImageReq{
			ID:        &image.ID,
			AltText:   image.AltText,
			IsPrimary: image.IsPrimary,
		}
	}
	return result
}

func singleVariantID(t *testing.T, repo product.Repository, productID int64) int64 {
	t.Helper()
	variants, err := repo.GetVariants(context.Background(), productID)
	if err != nil || len(variants) != 1 {
		t.Fatalf("single variant = %+v, %v", variants, err)
	}
	return variants[0].ID
}

func aggregateInt64Pointer(value int64) *int64 { return &value }

func assertAppField(t *testing.T, err error, field string) {
	t.Helper()
	fields, ok := apperr.Fields(err)
	if !ok || len(fields[field]) == 0 {
		t.Fatalf("error fields = %+v; want %q", fields, field)
	}
}

func assertRowCount(t *testing.T, table string, want int) {
	t.Helper()
	var got int
	if err := testPool.QueryRow(context.Background(), "SELECT count(*) FROM "+table).Scan(&got); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	if got != want {
		t.Fatalf("%s row count = %d; want %d", table, got, want)
	}
}
