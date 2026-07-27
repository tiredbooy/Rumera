//go:build integration

package integration

import (
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
	"github.com/tiredbooy/internal/handlers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

func TestMediaPipelineUploadServeDeleteAndPathSafety(t *testing.T) {
	requireDB(t)
	resetTables(t, "products")
	productID := seedProduct(t)
	service, store, cache := integrationMediaService(t, repositories.NewProductRepository(testPool))
	handler := handlers.New(handlers.Deps{Media: service, Log: zap.NewNop()})
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
		service, store, cache := integrationMediaService(t, repositories.NewProductRepository(testPool))
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
		productRepo := repositories.NewProductRepository(testPool)
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

type productMediaIdentityRepository interface {
	GetMediaIdentity(context.Context, int64) (string, error)
}

func integrationMediaService(
	t *testing.T,
	productRepo productMediaIdentityRepository,
) (*services.MediaService, *storage.LocalStorage, *storage.LocalStorage) {
	t.Helper()
	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create media store: %v", err)
	}
	cache, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("create media cache: %v", err)
	}
	lifecycle := services.NewMediaLifecycleService(
		store, cache, repositories.NewMediaLifecycleRepository(testPool), zap.NewNop(),
	)
	service := services.NewMediaService(
		store,
		cache,
		repositories.NewProductImageRepository(testPool),
		productRepo,
		repositories.NewContentMediaRepository(testPool),
		lifecycle,
		imaging.New(),
		services.MediaConfig{
			MaxUploadBytes: 1 << 20, MaxDimension: 4000,
			MaxSourceDimension: 12000, MaxSourcePixels: 40_000_000,
		},
		zap.NewNop(),
	)
	return service, store, cache
}

type deleteProductAfterIdentityRepository struct {
	pool     *pgxpool.Pool
	delegate repositories.ProductRepository
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
