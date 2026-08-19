package media

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

const secondMediaObjectID = "8d5a52bc-9918-4773-a02e-1f8f41ed2301"

func TestMediaUploadUsesStableProductOwnerAndRetriesCollision(t *testing.T) {
	store := newTestLocalStorage(t)
	cache := newTestLocalStorage(t)
	images := &mediaImageRepositoryStub{}
	products := &productMediaRepositoryStub{slug: "Reserve / Red Wine"}
	service := NewService(
		store,
		cache,
		images,
		products,
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{MaxUploadBytes: 1 << 20},
		zap.NewNop(),
	)

	firstKey, err := mediaStorageKey(
		MediaOwnerProduct,
		42,
		products.slug,
		RoleGallery,
		testMediaObjectID,
		"png",
	)
	if err != nil {
		t.Fatalf("build collision key: %v", err)
	}
	if err := store.Put(context.Background(), firstKey, strings.NewReader("existing")); err != nil {
		t.Fatalf("seed collision: %v", err)
	}
	ids := []string{testMediaObjectID, secondMediaObjectID}
	service.newID = func() string {
		id := ids[0]
		ids = ids[1:]
		return id
	}

	alt := "Bottle front"
	got, err := service.Upload(context.Background(), 42, testPNG(t), &alt, false)
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	wantKey := "products/42-reserve-red-wine/gallery-" + secondMediaObjectID + ".png"
	if got.StorageKey == nil || *got.StorageKey != wantKey {
		t.Fatalf("storage key = %v; want %q", got.StorageKey, wantKey)
	}
	if got.ImageURL != "/media/"+wantKey {
		t.Fatalf("image url = %q; want canonical media path", got.ImageURL)
	}
	if products.requestedID != 42 {
		t.Fatalf("resolved product id = %d; want 42", products.requestedID)
	}
	if images.created == nil || images.created.StorageKey == nil || *images.created.StorageKey != wantKey {
		t.Fatalf("persisted image = %+v", images.created)
	}
	if !got.IsPrimary || images.primaryImageID != got.ID {
		t.Fatalf("first image primary state = %+v, primary id %d", got, images.primaryImageID)
	}

	rc, err := store.Open(context.Background(), firstKey)
	if err != nil {
		t.Fatalf("open collision object: %v", err)
	}
	existing, readErr := io.ReadAll(rc)
	_ = rc.Close()
	if readErr != nil || string(existing) != "existing" {
		t.Fatalf("collision object = %q, %v; want existing", existing, readErr)
	}
}

func TestMediaUploadRetainsBlobForAmbiguousDatabaseFailure(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{name: "connection failure", err: errors.New("database unavailable")},
		{name: "statement completion unknown", err: databaseStateError{state: "40003"}},
		{name: "transaction resolution unknown", err: databaseStateError{state: "08007"}},
		{name: "admin shutdown", err: databaseStateError{state: "57P01"}},
		{name: "io error", err: databaseStateError{state: "58030"}},
		{name: "internal error", err: databaseStateError{state: "XX000"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newTestLocalStorage(t)
			images := &mediaImageRepositoryStub{createErr: tt.err}
			service := NewService(
				store,
				newTestLocalStorage(t),
				images,
				&productMediaRepositoryStub{slug: "draft-product"},
				&contentMediaRepositoryStub{},
				nil,
				imaging.New(),
				Config{},
				zap.NewNop(),
			)
			service.newID = func() string { return testMediaObjectID }

			if _, err := service.Upload(context.Background(), 9, testPNG(t), nil, false); err == nil {
				t.Fatal("Upload succeeded; want repository failure")
			}
			if images.created == nil || images.created.StorageKey == nil {
				t.Fatalf("repository did not receive image: %+v", images.created)
			}
			if exists, err := store.Exists(context.Background(), *images.created.StorageKey); err != nil || !exists {
				t.Fatalf("retained blob exists = %v, %v; want true, nil", exists, err)
			}
		})
	}
}

func TestMediaUploadDeletesBlobForDefinitiveDatabaseRejection(t *testing.T) {
	store := newTestLocalStorage(t)
	images := &mediaImageRepositoryStub{createErr: databaseStateError{state: "23514"}}
	service := NewService(
		store,
		newTestLocalStorage(t),
		images,
		&productMediaRepositoryStub{slug: "draft-product"},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{},
		zap.NewNop(),
	)
	service.newID = func() string { return testMediaObjectID }

	if _, err := service.Upload(context.Background(), 9, testPNG(t), nil, false); err == nil {
		t.Fatal("Upload succeeded; want repository failure")
	}
	if images.created == nil || images.created.StorageKey == nil {
		t.Fatalf("repository did not receive image: %+v", images.created)
	}
	if exists, err := store.Exists(context.Background(), *images.created.StorageKey); err != nil || exists {
		t.Fatalf("rejected blob exists = %v, %v; want false, nil", exists, err)
	}
}

func TestMediaUploadRejectsMissingProductOwner(t *testing.T) {
	service := NewService(
		newTestLocalStorage(t),
		newTestLocalStorage(t),
		&mediaImageRepositoryStub{},
		&productMediaRepositoryStub{err: models.ErrNotFound},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{},
		zap.NewNop(),
	)

	_, err := service.Upload(context.Background(), 404, testPNG(t), nil, false)
	if !errors.Is(err, apperr.ErrProductNotFound) {
		t.Fatalf("Upload error = %v; want ErrProductNotFound", err)
	}
}

func TestMediaStandaloneUploadReturnsCanonicalLegacyPath(t *testing.T) {
	service := NewService(
		newTestLocalStorage(t),
		newTestLocalStorage(t),
		&mediaImageRepositoryStub{},
		&productMediaRepositoryStub{},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{},
		zap.NewNop(),
	)
	service.newID = func() string { return testMediaObjectID }

	got, err := service.UploadImage(context.Background(), "hero", testPNG(t))
	if err != nil {
		t.Fatalf("UploadImage: %v", err)
	}
	wantKey := "hero/" + testMediaObjectID + ".png"
	if got.Key != wantKey || got.URL != "/media/"+wantKey {
		t.Fatalf("result = %+v; want key %q and canonical URL", got, wantKey)
	}
}

func TestMediaOwnerUploadAttachesEverySupportedSlot(t *testing.T) {
	tests := []struct {
		ownerType string
		role      string
		wantKey   string
		withAlt   bool
	}{
		{ownerType: "hero-slides", role: "desktop", wantKey: "hero-slides/17/desktop-" + testMediaObjectID + ".png", withAlt: true},
		{ownerType: "hero-slides", role: "mobile", wantKey: "hero-slides/17/mobile-" + testMediaObjectID + ".png", withAlt: true},
		{ownerType: "recipes", role: "cover", wantKey: "recipes/17/cover-" + testMediaObjectID + ".png", withAlt: true},
		{ownerType: "recipes", role: "og", wantKey: "recipes/17/og-" + testMediaObjectID + ".png"},
		{ownerType: "journal", role: "cover", wantKey: "journal/17/cover-" + testMediaObjectID + ".png", withAlt: true},
	}
	for _, tt := range tests {
		t.Run(tt.ownerType+" "+tt.role, func(t *testing.T) {
			store := newTestLocalStorage(t)
			owner := &contentMediaRepositoryStub{exists: true}
			service := NewService(
				store,
				newTestLocalStorage(t),
				&mediaImageRepositoryStub{},
				&productMediaRepositoryStub{},
				owner,
				nil,
				imaging.New(),
				Config{},
				zap.NewNop(),
			)
			service.newID = func() string { return testMediaObjectID }

			alt := models.NullablePatch[string]{}
			if tt.withAlt {
				alt = models.NullablePatch[string]{Set: true, Value: stringPointer(" Owner image ")}
			}
			got, err := service.UploadOwnerImage(
				context.Background(), tt.ownerType, 17, tt.role, testPNG(t), alt,
			)
			if err != nil {
				t.Fatalf("UploadOwnerImage: %v", err)
			}
			if got.Key != tt.wantKey || got.URL != "/media/"+tt.wantKey || got.Width != 2 || got.Height != 2 {
				t.Fatalf("upload result = %+v; want key %q and 2x2 dimensions", got, tt.wantKey)
			}
			if owner.attachedKey != tt.wantKey || owner.attachedURL != got.URL || owner.ownerID != 17 {
				t.Fatalf("attachment = %+v; want owner 17 and key %q", owner, tt.wantKey)
			}
			if tt.withAlt && (!owner.alt.Set || owner.alt.Value == nil || *owner.alt.Value != "Owner image") {
				t.Fatalf("attachment alt = %+v; want normalized owner image alt", owner.alt)
			}
			if exists, err := store.Exists(context.Background(), tt.wantKey); err != nil || !exists {
				t.Fatalf("stored original exists = %v, %v; want true, nil", exists, err)
			}
		})
	}
}

func TestMediaOwnerUploadRejectsInvalidOrMissingOwnerBeforeStorage(t *testing.T) {
	tests := []struct {
		name      string
		ownerType string
		role      string
		ownerID   int64
		owner     *contentMediaRepositoryStub
		wantErr   error
	}{
		{name: "product slot", ownerType: "products", role: "gallery", ownerID: 4, owner: &contentMediaRepositoryStub{exists: true}, wantErr: ErrInvalidMediaOwner},
		{name: "wrong role", ownerType: "recipes", role: "desktop", ownerID: 4, owner: &contentMediaRepositoryStub{exists: true}, wantErr: ErrInvalidMediaOwner},
		{name: "invalid id", ownerType: "recipes", role: "cover", ownerID: 0, owner: &contentMediaRepositoryStub{exists: true}, wantErr: ErrInvalidMediaOwner},
		{name: "missing owner", ownerType: "recipes", role: "cover", ownerID: 4, owner: &contentMediaRepositoryStub{}, wantErr: models.ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newTestLocalStorage(t)
			service := NewService(
				store,
				newTestLocalStorage(t),
				&mediaImageRepositoryStub{},
				&productMediaRepositoryStub{},
				tt.owner,
				nil,
				imaging.New(),
				Config{},
				zap.NewNop(),
			)
			service.newID = func() string { return testMediaObjectID }

			_, err := service.UploadOwnerImage(
				context.Background(), tt.ownerType, tt.ownerID, tt.role, testPNG(t), models.NullablePatch[string]{},
			)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("UploadOwnerImage error = %v; want %v", err, tt.wantErr)
			}
			if tt.owner.attachedKey != "" {
				t.Fatalf("unexpected attachment key %q", tt.owner.attachedKey)
			}
			key := "recipes/4/cover-" + testMediaObjectID + ".png"
			if exists, existsErr := store.Exists(context.Background(), key); existsErr != nil || exists {
				t.Fatalf("unexpected stored original = %v, %v", exists, existsErr)
			}
		})
	}
}

func TestMediaOwnerUploadCompensatesOnlyDefinitiveAttachmentFailures(t *testing.T) {
	tests := []struct {
		name       string
		attachErr  error
		wantExists bool
		wantErr    error
	}{
		{name: "owner deleted", attachErr: models.ErrNotFound, wantErr: models.ErrNotFound},
		{name: "constraint rejection", attachErr: databaseStateError{state: "23514"}, wantErr: apperr.ErrInternal},
		{name: "unknown completion", attachErr: databaseStateError{state: "40003"}, wantExists: true, wantErr: apperr.ErrInternal},
		{name: "connection failure", attachErr: errors.New("connection lost"), wantExists: true, wantErr: apperr.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newTestLocalStorage(t)
			owner := &contentMediaRepositoryStub{exists: true, attachErr: tt.attachErr}
			service := NewService(
				store,
				newTestLocalStorage(t),
				&mediaImageRepositoryStub{},
				&productMediaRepositoryStub{},
				owner,
				nil,
				imaging.New(),
				Config{},
				zap.NewNop(),
			)
			service.newID = func() string { return testMediaObjectID }

			_, err := service.UploadOwnerImage(
				context.Background(), "recipes", 17, "cover", testPNG(t), models.NullablePatch[string]{},
			)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("UploadOwnerImage error = %v; want %v", err, tt.wantErr)
			}
			key := "recipes/17/cover-" + testMediaObjectID + ".png"
			exists, existsErr := store.Exists(context.Background(), key)
			if existsErr != nil || exists != tt.wantExists {
				t.Fatalf("stored original exists = %v, %v; want %v, nil", exists, existsErr, tt.wantExists)
			}
		})
	}
}

func TestMediaAddsExternalProductImageWithoutStorageOwnership(t *testing.T) {
	images := &mediaImageRepositoryStub{}
	service := NewService(
		newTestLocalStorage(t),
		newTestLocalStorage(t),
		images,
		&productMediaRepositoryStub{slug: "product"},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{},
		zap.NewNop(),
	)
	alt := "Remote bottle"
	got, err := service.AddProductImageURL(
		context.Background(), 23, "  https://images.example/bottle.webp  ", &alt, false,
	)
	if err != nil {
		t.Fatalf("AddProductImageURL: %v", err)
	}
	if got.ImageURL != "https://images.example/bottle.webp" || got.StorageKey != nil {
		t.Fatalf("external image = %+v; want normalized URL and nil key", got)
	}
	if !got.IsPrimary || images.primaryImageID != got.ID {
		t.Fatalf("first external image primary state = %+v, primary id %d", got, images.primaryImageID)
	}
}

func TestMediaMapsProductDeletionRaceToNotFound(t *testing.T) {
	images := &mediaImageRepositoryStub{createErr: &pgconn.PgError{
		Code:           "23503",
		ConstraintName: "product_images_product_id_fkey",
	}}
	service := NewService(
		newTestLocalStorage(t),
		newTestLocalStorage(t),
		images,
		&productMediaRepositoryStub{slug: "deleted-product"},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{},
		zap.NewNop(),
	)

	_, err := service.AddProductImageURL(
		context.Background(), 23, "https://images.example/bottle.webp", nil, false,
	)
	if !errors.Is(err, apperr.ErrProductNotFound) {
		t.Fatalf("deletion race error = %v; want product not found", err)
	}
}

func TestMediaRejectsUnsafeExternalProductImageURLs(t *testing.T) {
	invalid := []string{
		"",
		"relative/image.webp",
		"//images.example/image.webp",
		"ftp://images.example/image.webp",
		"http://images.example/image.webp",
		"https://user:pass@images.example/image.webp",
		"https://images.example/image.webp#fragment",
		"/media/products/unowned.webp",
	}
	for _, imageURL := range invalid {
		t.Run(imageURL, func(t *testing.T) {
			images := &mediaImageRepositoryStub{}
			service := NewService(
				newTestLocalStorage(t),
				newTestLocalStorage(t),
				images,
				&productMediaRepositoryStub{slug: "product"},
				&contentMediaRepositoryStub{},
				nil,
				imaging.New(),
				Config{},
				zap.NewNop(),
			)

			_, err := service.AddProductImageURL(context.Background(), 23, imageURL, nil, false)
			if !errors.Is(err, apperr.ErrInvalidRequest) {
				t.Fatalf("AddProductImageURL(%q) error = %v; want invalid request", imageURL, err)
			}
			if images.created != nil {
				t.Fatalf("unsafe URL created image: %+v", images.created)
			}
		})
	}
}

func TestMediaTransformKeepsLegacyFlatKeysReadable(t *testing.T) {
	store := newTestLocalStorage(t)
	cache := newTestLocalStorage(t)
	const key = "products/550e8400-e29b-41d4-a716-446655440000.png"
	if err := store.Put(context.Background(), key, bytes.NewReader(testPNG(t))); err != nil {
		t.Fatalf("seed legacy key: %v", err)
	}
	service := NewService(
		store,
		cache,
		&mediaImageRepositoryStub{},
		&productMediaRepositoryStub{},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{},
		zap.NewNop(),
	)

	data, contentType, err := service.Transform(
		context.Background(),
		key,
		imaging.Options{Format: imaging.FormatPNG},
	)
	if err != nil || len(data) == 0 || contentType != "image/png" {
		t.Fatalf("Transform = %d bytes, %q, %v", len(data), contentType, err)
	}
	if _, _, err := service.Transform(context.Background(), "products/../escape.png", imaging.Options{}); !errors.Is(err, models.ErrNotFound) {
		t.Fatalf("invalid-key error = %v; want ErrNotFound", err)
	}
}

type productMediaRepositoryStub struct {
	slug        string
	err         error
	requestedID int64
}

type contentMediaRepositoryStub struct {
	exists      bool
	existsErr   error
	attachErr   error
	ownerType   string
	role        string
	ownerID     int64
	attachedURL string
	attachedKey string
	alt         models.NullablePatch[string]
}

func (r *contentMediaRepositoryStub) OwnerExists(_ context.Context, ownerType string, ownerID int64) (bool, error) {
	r.ownerType = ownerType
	r.ownerID = ownerID
	if r.existsErr != nil {
		return false, r.existsErr
	}
	return r.exists, nil
}

func (r *contentMediaRepositoryStub) Attach(
	_ context.Context,
	ownerType, role string,
	ownerID int64,
	url, key string,
	alt models.NullablePatch[string],
) (*ContentAttachment, error) {
	r.ownerType = ownerType
	r.role = role
	r.ownerID = ownerID
	r.attachedURL = url
	r.attachedKey = key
	r.alt = alt
	if r.attachErr != nil {
		return nil, r.attachErr
	}
	return &ContentAttachment{}, nil
}

func (r *productMediaRepositoryStub) GetMediaIdentity(_ context.Context, productID int64) (string, error) {
	r.requestedID = productID
	return r.slug, r.err
}

type mediaImageRepositoryStub struct {
	created        *models.ProductImage
	createErr      error
	nextSortOrder  int
	primaryImageID int64
}

type databaseStateError struct{ state string }

func (e databaseStateError) Error() string    { return "database error " + e.state }
func (e databaseStateError) SQLState() string { return e.state }

func (r *mediaImageRepositoryStub) Create(_ context.Context, img *models.ProductImage) (*models.ProductImage, error) {
	r.created = img
	if r.createErr != nil {
		return nil, r.createErr
	}
	created := *img
	created.ID = 71
	created.SortOrder = r.nextSortOrder
	created.IsPrimary = img.IsPrimary || r.nextSortOrder == 0
	if created.IsPrimary {
		r.primaryImageID = created.ID
	}
	return &created, nil
}

func (r *mediaImageRepositoryStub) GetByID(context.Context, int64) (*models.ProductImage, error) {
	return nil, models.ErrNotFound
}

func (r *mediaImageRepositoryStub) ListByProduct(context.Context, int64) ([]*models.ProductImage, error) {
	return nil, nil
}

func (r *mediaImageRepositoryStub) UpdateAlt(context.Context, int64, *string) (*models.ProductImage, error) {
	return nil, models.ErrNotFound
}

func (r *mediaImageRepositoryStub) SetPrimary(_ context.Context, _ int64, imageID int64) error {
	r.primaryImageID = imageID
	return nil
}

func (r *mediaImageRepositoryStub) Reorder(context.Context, int64, []int64) error {
	return nil
}

func (r *mediaImageRepositoryStub) Delete(context.Context, int64, int64) error {
	return nil
}

func newTestLocalStorage(t *testing.T) *storage.LocalStorage {
	t.Helper()
	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("NewLocalStorage: %v", err)
	}
	return store
}

func testPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 180, G: 20, B: 30, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode PNG: %v", err)
	}
	return buf.Bytes()
}

func TestListLibraryReturnsImagesNewestFirstAndFiltersByKey(t *testing.T) {
	store := newTestLocalStorage(t)
	service := NewService(
		store,
		newTestLocalStorage(t),
		&mediaImageRepositoryStub{},
		&productMediaRepositoryStub{},
		&contentMediaRepositoryStub{},
		nil,
		imaging.New(),
		Config{MaxUploadBytes: 1 << 20},
		zap.NewNop(),
	)

	ctx := context.Background()
	for _, key := range []string{
		"uploads/first.webp",
		"recipes/9/cover-" + testMediaObjectID + ".png",
		"uploads/notes.txt",
	} {
		if err := store.Put(ctx, key, strings.NewReader("x")); err != nil {
			t.Fatalf("seed %q: %v", key, err)
		}
	}

	items, err := service.ListLibrary(ctx, "", 0)
	if err != nil {
		t.Fatalf("ListLibrary: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("items = %#v; want the two images only", items)
	}
	for i := 1; i < len(items); i++ {
		if items[i-1].ModifiedAt.Before(items[i].ModifiedAt) {
			t.Fatalf("items are not newest-first: %#v", items)
		}
	}
	for _, item := range items {
		if item.URL != "/media/"+item.Key {
			t.Fatalf("url = %q; want the canonical path for %q", item.URL, item.Key)
		}
	}

	filtered, err := service.ListLibrary(ctx, "RECIPES/9", 0)
	if err != nil {
		t.Fatalf("ListLibrary filtered: %v", err)
	}
	if len(filtered) != 1 || !strings.HasPrefix(filtered[0].Key, "recipes/9/") {
		t.Fatalf("filtered = %#v", filtered)
	}

	capped, err := service.ListLibrary(ctx, "", 1)
	if err != nil || len(capped) != 1 {
		t.Fatalf("capped = %#v, err = %v", capped, err)
	}
}
