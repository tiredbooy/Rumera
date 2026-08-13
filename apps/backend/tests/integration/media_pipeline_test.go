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
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/features/media"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
)

func TestMediaPipelineUploadServeDeleteAndPathSafety(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	productID := seedProduct(t)
	service, store, cache := integrationMediaService(t, product.NewRepository(testPool))
	handler := media.NewHandler(service, nil, validator.New())
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/admin/products/:id/images", handler.UploadProductImage)
	router.DELETE("/admin/products/:id/images/:imageId", handler.DeleteProductImage)
	router.GET("/media/*key", handler.ServeMedia)

	upload := multipartRequest(t, http.MethodPost,
		fmt.Sprintf("/admin/products/%d/images", productID), "bottle.txt", integrationPNG(t))
	uploadRecorder := httptest.NewRecorder()
	router.ServeHTTP(uploadRecorder, upload)
	if uploadRecorder.Code != http.StatusCreated {
		t.Fatalf("upload status/body = %d/%s; want 201", uploadRecorder.Code, uploadRecorder.Body.String())
	}
	var envelope struct {
		Data models.ImageResponse `json:"data"`
	}
	if err := json.Unmarshal(uploadRecorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if envelope.Data.StorageKey == nil || envelope.Data.Width == nil || *envelope.Data.Width != 2 {
		t.Fatalf("upload response = %+v; want stored 2x2 image", envelope.Data)
	}
	key := *envelope.Data.StorageKey
	if exists, err := store.Exists(context.Background(), key); err != nil || !exists {
		t.Fatalf("uploaded original exists = %v, %v; want true, nil", exists, err)
	}

	serve := httptest.NewRequest(http.MethodGet, "/media/"+key+"?f=png&w=1&h=1&fit=inside", nil)
	serveRecorder := httptest.NewRecorder()
	router.ServeHTTP(serveRecorder, serve)
	if serveRecorder.Code != http.StatusOK || serveRecorder.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("serve status/type = %d/%q; want 200/image/png", serveRecorder.Code, serveRecorder.Header().Get("Content-Type"))
	}
	if serveRecorder.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("serve cache-control = %q", serveRecorder.Header().Get("Cache-Control"))
	}
	if objects, err := cache.List(context.Background(), ""); err != nil || len(objects) != 1 {
		t.Fatalf("render cache = %+v, %v; want one object", objects, err)
	}

	if _, _, err := service.Transform(context.Background(), "products/../escape.png", imaging.Options{}); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("unsafe transform error = %v; want not found", err)
	}

	remove := httptest.NewRequest(http.MethodDelete,
		fmt.Sprintf("/admin/products/%d/images/%d", productID, envelope.Data.ID), nil)
	removeRecorder := httptest.NewRecorder()
	router.ServeHTTP(removeRecorder, remove)
	if removeRecorder.Code != http.StatusNoContent {
		t.Fatalf("delete status/body = %d/%s; want 204", removeRecorder.Code, removeRecorder.Body.String())
	}
	if exists, err := store.Exists(context.Background(), key); err != nil || exists {
		t.Fatalf("deleted original exists = %v, %v; want false, nil", exists, err)
	}
	if objects, err := cache.List(context.Background(), ""); err != nil || len(objects) != 0 {
		t.Fatalf("cache after delete = %+v, %v; want empty", objects, err)
	}

	spoofed := multipartRequest(t, http.MethodPost,
		fmt.Sprintf("/admin/products/%d/images", productID), "fake.png", []byte("GIF89a"))
	spoofedRecorder := httptest.NewRecorder()
	router.ServeHTTP(spoofedRecorder, spoofed)
	if spoofedRecorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("spoofed upload status/body = %d/%s; want 415", spoofedRecorder.Code, spoofedRecorder.Body.String())
	}
}

func TestMediaPipelineReplacesOwnerAndRollsBackRejectedUpload(t *testing.T) {
	requireDB(t)
	ctx := context.Background()

	t.Run("owner replacement removes old original and render", func(t *testing.T) {
		resetTables(t, "recipes")
		var recipeID int64
		if err := testPool.QueryRow(ctx,
			`INSERT INTO recipes (title, slug, content, difficulty, status)
			 VALUES ('Replace cover', 'replace-cover', 'Steps', 'easy', 'draft') RETURNING id`,
		).Scan(&recipeID); err != nil {
			t.Fatalf("insert recipe: %v", err)
		}
		service, store, cache := integrationMediaService(t, product.NewRepository(testPool))
		first, err := service.UploadOwnerImage(ctx, "recipes", recipeID, "cover", integrationPNG(t), models.NullablePatch[string]{})
		if err != nil {
			t.Fatalf("upload first cover: %v", err)
		}
		if _, _, err := service.Transform(ctx, first.Key, imaging.Options{Format: imaging.FormatPNG, Width: 1}); err != nil {
			t.Fatalf("render first cover: %v", err)
		}

		second, err := service.UploadOwnerImage(ctx, "recipes", recipeID, "cover", integrationPNG(t), models.NullablePatch[string]{})
		if err != nil {
			t.Fatalf("replace cover: %v", err)
		}
		if exists, err := store.Exists(ctx, first.Key); err != nil || exists {
			t.Fatalf("old original exists = %v, %v; want false, nil", exists, err)
		}
		if exists, err := store.Exists(ctx, second.Key); err != nil || !exists {
			t.Fatalf("new original exists = %v, %v; want true, nil", exists, err)
		}
		if objects, err := cache.List(ctx, ""); err != nil || len(objects) != 0 {
			t.Fatalf("cache after replacement = %+v, %v; want empty", objects, err)
		}
		var storedKey string
		if err := testPool.QueryRow(ctx, `SELECT image_storage_key FROM recipes WHERE id = $1`, recipeID).Scan(&storedKey); err != nil {
			t.Fatalf("read replacement key: %v", err)
		}
		if storedKey != second.Key {
			t.Fatalf("stored replacement key = %q; want %q", storedKey, second.Key)
		}
	})

	t.Run("foreign-key rejection removes newly stored original", func(t *testing.T) {
		resetTables(t, "products")
		productID := seedProduct(t)
		productRepo := product.NewRepository(testPool)
		deletingRepo := &deleteProductAfterIdentityRepository{
			pool: testPool, delegate: productRepo,
		}
		service, store, _ := integrationMediaService(t, deletingRepo)
		if _, err := service.Upload(ctx, productID, integrationPNG(t), nil, false); !errors.Is(err, apperr.ErrProductNotFound) {
			t.Fatalf("rejected upload error = %v; want product not found", err)
		}
		if objects, err := store.List(ctx, ""); err != nil || len(objects) != 0 {
			t.Fatalf("storage after rollback = %+v, %v; want empty", objects, err)
		}
	})
}

func TestMediaPipelineRejectsCrossOwnerProductImageMutations(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	ctx := context.Background()
	firstProductID := seedProduct(t)
	secondProductID := seedProduct(t)
	variantID := seedVariant(t, firstProductID)
	service, store, cache := integrationMediaService(t, product.NewRepository(testPool))

	owned, err := service.Upload(ctx, firstProductID, integrationPNG(t), nil, true)
	if err != nil {
		t.Fatalf("upload owned product image: %v", err)
	}
	second, err := service.AddProductImageURL(
		ctx, secondProductID, "https://images.example/second.webp", nil, true,
	)
	if err != nil {
		t.Fatalf("create second product image: %v", err)
	}
	if _, _, err := service.Transform(ctx, *owned.StorageKey, imaging.Options{Format: imaging.FormatPNG, Width: 1}); err != nil {
		t.Fatalf("render owned product image: %v", err)
	}

	variantKey := fmt.Sprintf("products/%d/variants/%d/reference.webp", firstProductID, variantID)
	if err := store.Put(ctx, variantKey, bytes.NewReader(integrationPNG(t))); err != nil {
		t.Fatalf("store variant image: %v", err)
	}
	variantImage, err := product.NewImageRepository(testPool).Create(ctx, &models.ProductImage{
		ProductID:        &firstProductID,
		ProductVariantID: &variantID,
		ImageURL:         "/media/" + variantKey,
		StorageKey:       &variantKey,
		IsPrimary:        true,
	})
	if err != nil {
		t.Fatalf("create variant image: %v", err)
	}
	if _, _, err := service.Transform(ctx, variantKey, imaging.Options{Format: imaging.FormatPNG, Width: 1}); err != nil {
		t.Fatalf("render variant image: %v", err)
	}

	handler := media.NewHandler(service, nil, validator.New())
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.PATCH("/admin/products/:id/images/:imageId", handler.UpdateProductImage)
	router.PUT("/admin/products/:id/images/:imageId/primary", handler.SetPrimaryProductImage)
	router.PUT("/admin/products/:id/images/order", handler.ReorderProductImages)
	router.DELETE("/admin/products/:id/images/:imageId", handler.DeleteProductImage)

	tests := []struct {
		name       string
		method     string
		target     string
		body       string
		wantStatus int
	}{
		{
			name: "patch another product image", method: http.MethodPatch,
			target: fmt.Sprintf("/admin/products/%d/images/%d", secondProductID, owned.ID),
			body:   `{"alt_text":"tampered"}`, wantStatus: http.StatusNotFound,
		},
		{
			name: "promote another product image", method: http.MethodPut,
			target:     fmt.Sprintf("/admin/products/%d/images/%d/primary", secondProductID, owned.ID),
			wantStatus: http.StatusNotFound,
		},
		{
			name: "reorder with another product image", method: http.MethodPut,
			target: fmt.Sprintf("/admin/products/%d/images/order", secondProductID),
			body:   fmt.Sprintf(`{"ids":[%d]}`, owned.ID), wantStatus: http.StatusBadRequest,
		},
		{
			name: "delete another product image", method: http.MethodDelete,
			target:     fmt.Sprintf("/admin/products/%d/images/%d", secondProductID, owned.ID),
			wantStatus: http.StatusNotFound,
		},
		{
			name: "patch variant image through product gallery", method: http.MethodPatch,
			target: fmt.Sprintf("/admin/products/%d/images/%d", firstProductID, variantImage.ID),
			body:   `{"alt_text":"tampered"}`, wantStatus: http.StatusNotFound,
		},
		{
			name: "promote variant image through product gallery", method: http.MethodPut,
			target:     fmt.Sprintf("/admin/products/%d/images/%d/primary", firstProductID, variantImage.ID),
			wantStatus: http.StatusNotFound,
		},
		{
			name: "reorder variant image through product gallery", method: http.MethodPut,
			target: fmt.Sprintf("/admin/products/%d/images/order", firstProductID),
			body:   fmt.Sprintf(`{"ids":[%d,%d]}`, owned.ID, variantImage.ID), wantStatus: http.StatusBadRequest,
		},
		{
			name: "delete variant image through product gallery", method: http.MethodDelete,
			target:     fmt.Sprintf("/admin/products/%d/images/%d", firstProductID, variantImage.ID),
			wantStatus: http.StatusNotFound,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body *bytes.Reader
			if tt.body == "" {
				body = bytes.NewReader(nil)
			} else {
				body = bytes.NewReader([]byte(tt.body))
			}
			request := httptest.NewRequest(tt.method, tt.target, body)
			if tt.body != "" {
				request.Header.Set("Content-Type", "application/json")
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if recorder.Code != tt.wantStatus {
				t.Fatalf("status/body = %d/%s; want %d", recorder.Code, recorder.Body.String(), tt.wantStatus)
			}
		})
	}

	imageRepo := product.NewImageRepository(testPool)
	for name, imageID := range map[string]int64{
		"owned product image":  owned.ID,
		"second product image": second.ID,
		"variant image":        variantImage.ID,
	} {
		image, err := imageRepo.GetByID(ctx, imageID)
		if err != nil {
			t.Fatalf("read %s after rejected mutations: %v", name, err)
		}
		if image.AltText != nil {
			t.Fatalf("%s alt = %q; want nil", name, *image.AltText)
		}
		if !image.IsPrimary {
			t.Fatalf("%s primary = false; want true", name)
		}
	}
	for _, key := range []string{*owned.StorageKey, variantKey} {
		if exists, err := store.Exists(ctx, key); err != nil || !exists {
			t.Fatalf("original %q exists = %v, %v; want true, nil", key, exists, err)
		}
	}
	if objects, err := cache.List(ctx, ""); err != nil || len(objects) != 2 {
		t.Fatalf("render cache after rejected mutations = %+v, %v; want two objects", objects, err)
	}
}

func TestMediaPipelineProductAndVariantDeleteCleanOwnedMedia(t *testing.T) {
	requireDB(t)
	ctx := context.Background()

	t.Run("product cascade", func(t *testing.T) {
		resetTables(t, "products")
		productID := seedProduct(t)
		variantID := seedVariant(t, productID)
		productRepo := product.NewRepository(testPool)
		mediaSvc, store, cache := integrationMediaService(t, productRepo)
		lifecycle := media.NewLifecycleService(
			store, cache, media.NewLifecycleRepository(testPool), zap.NewNop(),
		)
		galleryImage, err := mediaSvc.Upload(ctx, productID, integrationPNG(t), nil, true)
		if err != nil {
			t.Fatalf("upload product image: %v", err)
		}
		variantKey := fmt.Sprintf("products/%d/variants/%d/delete.webp", productID, variantID)
		variantImage := createStoredVariantImage(t, ctx, store, productID, variantID, variantKey)
		for _, key := range []string{*galleryImage.StorageKey, *variantImage.StorageKey} {
			if _, _, err := mediaSvc.Transform(ctx, key, imaging.Options{Format: imaging.FormatPNG, Width: 1}); err != nil {
				t.Fatalf("render %q: %v", key, err)
			}
		}

		if err := product.NewService(productRepo, lifecycle, mediaSvc).Delete(ctx, productID); err != nil {
			t.Fatalf("delete product: %v", err)
		}
		assertRowCount(t, "products", 0)
		assertRowCount(t, "product_images", 0)
		for _, key := range []string{*galleryImage.StorageKey, *variantImage.StorageKey} {
			if exists, err := store.Exists(ctx, key); err != nil || exists {
				t.Fatalf("deleted product original %q exists = %v, %v; want false, nil", key, exists, err)
			}
		}
		if objects, err := cache.List(ctx, ""); err != nil || len(objects) != 0 {
			t.Fatalf("product render cache after delete = %+v, %v; want empty", objects, err)
		}
	})

	t.Run("variant cascade", func(t *testing.T) {
		resetTables(t, "products")
		productID := seedProduct(t)
		variantID := seedVariant(t, productID)
		productRepo := product.NewRepository(testPool)
		mediaSvc, store, cache := integrationMediaService(t, productRepo)
		lifecycle := media.NewLifecycleService(
			store, cache, media.NewLifecycleRepository(testPool), zap.NewNop(),
		)
		variantKey := fmt.Sprintf("products/%d/variants/%d/delete.webp", productID, variantID)
		createStoredVariantImage(t, ctx, store, productID, variantID, variantKey)
		if _, _, err := mediaSvc.Transform(ctx, variantKey, imaging.Options{Format: imaging.FormatPNG, Width: 1}); err != nil {
			t.Fatalf("render variant image: %v", err)
		}

		variantService := variant.NewService(variant.NewRepository(testPool), inventory.NewRepository(testPool), lifecycle)
		if err := variantService.Delete(ctx, variantID); err != nil {
			t.Fatalf("delete variant: %v", err)
		}
		assertRowCount(t, "products", 1)
		assertRowCount(t, "product_variants", 0)
		assertRowCount(t, "product_images", 0)
		if exists, err := store.Exists(ctx, variantKey); err != nil || exists {
			t.Fatalf("deleted variant original exists = %v, %v; want false, nil", exists, err)
		}
		if objects, err := cache.List(ctx, ""); err != nil || len(objects) != 0 {
			t.Fatalf("variant render cache after delete = %+v, %v; want empty", objects, err)
		}
	})
}

func createStoredVariantImage(
	t *testing.T,
	ctx context.Context,
	store *storage.LocalStorage,
	productID, variantID int64,
	key string,
) *models.ProductImage {
	t.Helper()
	if err := store.Put(ctx, key, bytes.NewReader(integrationPNG(t))); err != nil {
		t.Fatalf("store variant original: %v", err)
	}
	image, err := product.NewImageRepository(testPool).Create(ctx, &models.ProductImage{
		ProductID:        &productID,
		ProductVariantID: &variantID,
		ImageURL:         "/media/" + key,
		StorageKey:       &key,
		IsPrimary:        true,
	})
	if err != nil {
		t.Fatalf("create variant image row: %v", err)
	}
	return image
}

type productMediaIdentityRepository interface {
	GetMediaIdentity(context.Context, int64) (string, error)
}

func integrationMediaService(
	t *testing.T,
	productRepo productMediaIdentityRepository,
) (*media.Service, *storage.LocalStorage, *storage.LocalStorage) {
	t.Helper()
	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create media store: %v", err)
	}
	cache, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create media cache: %v", err)
	}
	lifecycle := media.NewLifecycleService(
		store, cache, media.NewLifecycleRepository(testPool), zap.NewNop(),
	)
	service := media.NewService(
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
	return service, store, cache
}

type deleteProductAfterIdentityRepository struct {
	pool     *pgxpool.Pool
	delegate product.Repository
}

func (r *deleteProductAfterIdentityRepository) GetMediaIdentity(ctx context.Context, productID int64) (string, error) {
	slug, err := r.delegate.GetMediaIdentity(ctx, productID)
	if err != nil {
		return "", err
	}
	if _, err := r.pool.Exec(ctx, `DELETE FROM products WHERE id = $1`, productID); err != nil {
		return "", err
	}
	return slug, nil
}

func multipartRequest(t *testing.T, method, target, filename string, data []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatalf("write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart body: %v", err)
	}
	request := httptest.NewRequest(method, target, &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request
}

func integrationPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 180, G: 20, B: 30, A: 255})
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatalf("encode PNG: %v", err)
	}
	return buffer.Bytes()
}
