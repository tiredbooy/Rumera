package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

// Media-specific sentinel errors. Handlers map these to 413 / 415 respectively;
// everything else falls back to the generic error mapping.
var (
	ErrImageTooLarge           = errors.New("media: image exceeds maximum upload size")
	ErrImageDimensionsTooLarge = errors.New("media: image dimensions exceed configured limits")
	ErrUnsupportedImage        = errors.New("media: unsupported or unreadable image")
)

// inputExt maps a signature-verified source format to the stored-original
// extension. It also doubles as the accepted-upload format allow-list.
var inputExt = map[imaging.Format]string{
	imaging.FormatJPEG: "jpg",
	imaging.FormatPNG:  "png",
	imaging.FormatWebP: "webp",
	imaging.FormatAVIF: "avif",
}

const (
	defaultMaxSourceDimension = 12_000
	defaultMaxSourcePixels    = int64(40_000_000)
)

// MediaConfig captures the runtime knobs the media service needs (sourced from
// configs.Config in bootstrap).
type Config struct {
	MaxUploadBytes     int64
	DefaultQuality     int
	MaxDimension       int
	MaxSourceDimension int
	MaxSourcePixels    int64
	AllowedOutput      map[imaging.Format]bool
}

type productMediaRepository interface {
	GetMediaIdentity(ctx context.Context, productID int64) (slug string, err error)
}

type contentOwnerRepo interface {
	OwnerExists(ctx context.Context, ownerType string, ownerID int64) (bool, error)
	Attach(ctx context.Context, ownerType, role string, ownerID int64, url, key string, alt models.NullablePatch[string]) (*ContentAttachment, error)
}

// ProductImageRepository is the product-images write surface media needs.
// Implemented by features/catalog/ProductImageRepository (bootstrap wires it).
type ProductImageRepository interface {
	Create(ctx context.Context, img *models.ProductImage) (*models.ProductImage, error)
	GetByID(ctx context.Context, id int64) (*models.ProductImage, error)
	ListByProduct(ctx context.Context, productID int64) ([]*models.ProductImage, error)
	UpdateAlt(ctx context.Context, id int64, alt *string) (*models.ProductImage, error)
	SetPrimary(ctx context.Context, productID, id int64) error
	Reorder(ctx context.Context, productID int64, ids []int64) error
	Delete(ctx context.Context, productID, id int64) error
}

// Service stores uploaded product images and serves resized/recompressed
// variants on the fly. Originals live in `store`; rendered variants are cached
// in `cache`. The actual codec work is delegated to an imaging.Transformer
// (pure-Go by default, libvips under `-tags vips`).
type Service struct {
	store storage.WriteOnceStorage
	cache storage.Storage
	repo  ProductImageRepository
	prod  productMediaRepository
	owner contentOwnerRepo
	life  *LifecycleService
	tr    imaging.Transformer
	cfg   Config
	log   *zap.Logger
	newID func() string
}

func NewService(
	store storage.WriteOnceStorage,
	cache storage.Storage,
	repo ProductImageRepository,
	prod productMediaRepository,
	owner contentOwnerRepo,
	lifecycle *LifecycleService,
	tr imaging.Transformer,
	cfg Config,
	log *zap.Logger,
) *Service {
	if cfg.DefaultQuality <= 0 {
		cfg.DefaultQuality = 80
	}
	if cfg.MaxDimension <= 0 {
		cfg.MaxDimension = 4000
	}
	if cfg.MaxSourceDimension <= 0 {
		cfg.MaxSourceDimension = defaultMaxSourceDimension
	}
	if cfg.MaxSourcePixels <= 0 {
		cfg.MaxSourcePixels = defaultMaxSourcePixels
	}
	return &Service{
		store: store,
		cache: cache,
		repo:  repo,
		prod:  prod,
		owner: owner,
		life:  lifecycle,
		tr:    tr,
		cfg:   cfg,
		log:   log,
		newID: uuid.NewString,
	}
}

// ── Upload & management ─────────────────────────────────────────────────────

// Upload validates and stores an original image for a product, recording a
// product_images row and returning it.
func (s *Service) Upload(ctx context.Context, productID int64, data []byte, altText *string, isPrimary bool) (*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	slug, err := s.prod.GetMediaIdentity(ctx, productID)
	if errors.Is(err, models.ErrNotFound) {
		return nil, apperr.ErrProductNotFound
	}
	if err != nil {
		return nil, apperr.ErrInternal
	}
	altText, err = normalizeProductImageAlt(altText)
	if err != nil {
		return nil, err
	}

	w, h, ext, err := s.inspectUpload(data)
	if err != nil {
		return nil, err
	}

	key, err := s.storeOriginal(
		ctx,
		MediaOwnerProduct,
		productID,
		slug,
		RoleGallery,
		ext,
		data,
	)
	if err != nil {
		return nil, err
	}
	imageURL, err := canonicalMediaPath(key)
	if err != nil {
		_ = s.store.Delete(ctx, key)
		return nil, apperr.ErrInternal
	}

	pid := productID
	wv, hv := w, h
	img := &models.ProductImage{
		ProductID:  &pid,
		ImageURL:   imageURL,
		StorageKey: &key,
		AltText:    altText,
		IsPrimary:  isPrimary,
		Width:      &wv,
		Height:     &hv,
	}
	created, err := s.repo.Create(ctx, img)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) || isDefinitiveDatabaseRejection(err) {
			if deleteErr := s.store.Delete(ctx, key); deleteErr != nil {
				s.log.Warn("media: clean rejected original",
					zap.String("key", key), zap.Error(deleteErr))
			}
			s.log.Error("media: create row rejected; removed original",
				zap.String("key", key), zap.Error(err))
		} else {
			// A connection loss or cancellation can hide a committed INSERT. Retain
			// the immutable blob rather than risk leaving that row broken; Task 057c
			// reconciliation can remove it if the row definitively did not land.
			s.log.Error("media: create row outcome ambiguous; retained original for reconciliation",
				zap.String("key", key), zap.Error(err))
		}
		if errors.Is(err, models.ErrNotFound) || isProductOwnerForeignKeyViolation(err) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	return created, nil
}

// AddProductImageURL attaches an externally hosted or static image without
// pretending the backend owns its bytes. Product ordering, alt text, and primary
// behavior remain identical to uploaded product images.
func (s *Service) AddProductImageURL(
	ctx context.Context,
	productID int64,
	imageURL string,
	altText *string,
	isPrimary bool,
) (*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if _, err := s.prod.GetMediaIdentity(ctx, productID); errors.Is(err, models.ErrNotFound) {
		return nil, apperr.ErrProductNotFound
	} else if err != nil {
		return nil, apperr.ErrInternal
	}
	altText, err := normalizeProductImageAlt(altText)
	if err != nil {
		return nil, err
	}

	normalized, err := NormalizeExternalImageURL(imageURL)
	if err != nil {
		return nil, apperr.ErrInvalidRequest
	}
	pid := productID
	created, err := s.repo.Create(ctx, &models.ProductImage{
		ProductID: &pid,
		ImageURL:  normalized,
		AltText:   altText,
		IsPrimary: isPrimary,
	})
	if err != nil {
		if errors.Is(err, models.ErrNotFound) || isProductOwnerForeignKeyViolation(err) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	return created, nil
}

// UploadResult is the outcome of a standalone (non-product) image upload: a
// stored original addressable by its public URL.
type UploadResult struct {
	URL       string `json:"url"`
	Key       string `json:"key"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	OwnerSlug string `json:"-"`
}

// UploadImage validates and stores a standalone image (hero slides, recipe and
// journal covers, …) under the given folder prefix and returns its public URL.
// Unlike Upload it records no database row — the URL is persisted on the owning
// entity (e.g. hero_slides.image_url). The same size/format guards apply.
func (s *Service) UploadImage(ctx context.Context, folder string, data []byte) (*UploadResult, error) {
	w, h, ext, err := s.inspectUpload(data)
	if err != nil {
		return nil, err
	}

	if folder == "" {
		folder = "uploads"
	}
	key, err := s.storeLegacyOriginal(ctx, folder, ext, data)
	if err != nil {
		return nil, err
	}
	url, err := canonicalMediaPath(key)
	if err != nil {
		_ = s.store.Delete(ctx, key)
		return nil, apperr.ErrInternal
	}
	return &UploadResult{URL: url, Key: key, Width: w, Height: h}, nil
}

// ── Media library ───────────────────────────────────────────────────────────

// LibraryItem is one reusable original from the media library.
type LibraryItem struct {
	URL        string    `json:"url"`
	Key        string    `json:"key"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modified_at"`
}

const (
	libraryDefaultLimit = 60
	libraryMaxLimit     = 200
)

// ListLibrary returns stored originals newest first, so an editor can reuse an
// image that is already on the site instead of uploading it a second time.
// Rendered variants live in a separate cache store and never appear here.
//
// ponytail: one walk of the originals namespace per request, filtered in Go.
// Fine for the low thousands of objects this store holds; index the keys in a
// table if listing ever shows up in a latency profile.
func (s *Service) ListLibrary(ctx context.Context, search string, limit int) ([]LibraryItem, error) {
	if limit <= 0 {
		limit = libraryDefaultLimit
	}
	if limit > libraryMaxLimit {
		limit = libraryMaxLimit
	}
	objects, err := s.store.List(ctx, "")
	if err != nil {
		s.log.Error("media: list library", zap.Error(err))
		return nil, apperr.ErrInternal
	}

	needle := strings.ToLower(strings.TrimSpace(search))
	items := make([]LibraryItem, 0, len(objects))
	for _, object := range objects {
		if !isStoredImageExtension(strings.ToLower(strings.TrimPrefix(path.Ext(object.Key), "."))) {
			continue
		}
		if needle != "" && !strings.Contains(strings.ToLower(object.Key), needle) {
			continue
		}
		url, err := canonicalMediaPath(object.Key)
		if err != nil {
			continue
		}
		items = append(items, LibraryItem{
			URL:        url,
			Key:        object.Key,
			Size:       object.Size,
			ModifiedAt: object.ModTime,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ModifiedAt.After(items[j].ModifiedAt)
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

// UploadOwnerImage stores one immutable content image and atomically attaches
// its canonical URL/key pair to an existing owner slot.
func (s *Service) UploadOwnerImage(
	ctx context.Context,
	ownerType string,
	ownerID int64,
	role string,
	data []byte,
	altText models.NullablePatch[string],
) (*UploadResult, error) {
	if ownerID <= 0 {
		return nil, ErrInvalidMediaOwner
	}
	kind, mediaRole, err := contentMediaSlot(ownerType, role)
	if err != nil {
		return nil, err
	}
	if altText.Set && ownerType == "recipes" && role == "og" {
		return nil, ErrInvalidMediaOwner
	}
	if err := normalizeImageAltPatch(&altText); err != nil {
		return nil, err
	}
	exists, err := s.owner.OwnerExists(ctx, ownerType, ownerID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
	if !exists {
		return nil, models.ErrNotFound
	}

	w, h, ext, err := s.inspectUpload(data)
	if err != nil {
		return nil, err
	}
	key, err := s.storeOriginal(ctx, kind, ownerID, "", mediaRole, ext, data)
	if err != nil {
		return nil, err
	}
	mediaURL, err := canonicalMediaPath(key)
	if err != nil {
		_ = s.store.Delete(ctx, key)
		return nil, apperr.ErrInternal
	}

	attachment, err := s.owner.Attach(ctx, ownerType, role, ownerID, mediaURL, key, altText)
	if err != nil {
		definitive := errors.Is(err, models.ErrNotFound) || isDefinitiveDatabaseRejection(err)
		if definitive {
			if deleteErr := s.store.Delete(ctx, key); deleteErr != nil {
				s.log.Warn("media: clean unattached owner image",
					zap.String("key", key), zap.Error(deleteErr))
			}
		} else {
			s.log.Error("media: owner attachment outcome ambiguous; retained original for reconciliation",
				zap.String("key", key), zap.Error(err))
		}
		if errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrNotFound
		}
		return nil, apperr.ErrInternal
	}
	if s.life != nil && attachment.DetachedKey != nil {
		s.life.CleanupKeys(ctx, *attachment.DetachedKey)
	}

	return &UploadResult{
		URL: mediaURL, Key: key, Width: w, Height: h, OwnerSlug: attachment.OwnerSlug,
	}, nil
}

func (s *Service) inspectUpload(data []byte) (width, height int, ext string, err error) {
	if s.cfg.MaxUploadBytes > 0 && int64(len(data)) > s.cfg.MaxUploadBytes {
		return 0, 0, "", ErrImageTooLarge
	}
	return s.inspectImage(data)
}

func (s *Service) inspectImage(data []byte) (width, height int, ext string, err error) {
	if len(data) == 0 {
		return 0, 0, "", ErrUnsupportedImage
	}
	detected, err := imaging.DetectFormat(data)
	if err != nil {
		return 0, 0, "", ErrUnsupportedImage
	}
	width, height, probed, err := s.tr.Probe(data)
	if err != nil {
		return 0, 0, "", ErrUnsupportedImage
	}
	probedFormat, ok := normalizeProbedImageFormat(probed)
	if !ok || probedFormat != detected || width < 1 || height < 1 {
		return 0, 0, "", ErrUnsupportedImage
	}
	if width > s.cfg.MaxSourceDimension || height > s.cfg.MaxSourceDimension ||
		int64(width) > s.cfg.MaxSourcePixels/int64(height) {
		return 0, 0, "", ErrImageDimensionsTooLarge
	}
	ext, ok = inputExt[detected]
	if !ok {
		return 0, 0, "", ErrUnsupportedImage
	}
	return width, height, ext, nil
}

func normalizeProbedImageFormat(value string) (imaging.Format, bool) {
	switch strings.ToLower(value) {
	case "jpeg", "jpg":
		return imaging.FormatJPEG, true
	case "png":
		return imaging.FormatPNG, true
	case "webp":
		return imaging.FormatWebP, true
	case "avif", "heif":
		return imaging.FormatAVIF, true
	default:
		return "", false
	}
}

func NormalizeExternalImageURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 2048 || strings.ContainsRune(value, '#') {
		return "", ErrInvalidMediaOwner
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.User != nil || parsed.Fragment != "" {
		return "", ErrInvalidMediaOwner
	}
	if strings.ContainsRune(value, '\\') {
		return "", ErrInvalidMediaOwner
	}
	if strings.HasPrefix(value, "/") {
		if strings.HasPrefix(value, "//") || strings.HasPrefix(value, "/media/") {
			return "", ErrInvalidMediaOwner
		}
		return value, nil
	}
	if parsed.Scheme != "https" || parsed.Host == "" {
		return "", ErrInvalidMediaOwner
	}
	return value, nil
}

// ResolvePreparedProductImage validates an ownerless upload immediately before
// an aggregate product transaction claims it. The immutable object remains in
// place on transaction failure so the same operation can be retried safely.
func (s *Service) ResolvePreparedProductImage(
	ctx context.Context,
	key string,
) (string, int, int, error) {
	key = strings.TrimSpace(key)
	if !strings.HasPrefix(key, "uploads/") || storage.ValidateKey(key) != nil {
		return "", 0, 0, apperr.ErrInvalidRequest
	}
	exists, err := s.store.Exists(ctx, key)
	if err != nil {
		return "", 0, 0, apperr.ErrInternal
	}
	if !exists {
		return "", 0, 0, apperr.ErrInvalidRequest
	}
	reader, err := s.store.Open(ctx, key)
	if err != nil {
		return "", 0, 0, apperr.ErrInternal
	}
	defer reader.Close()

	var source io.Reader = reader
	if s.cfg.MaxUploadBytes > 0 {
		source = io.LimitReader(reader, s.cfg.MaxUploadBytes+1)
	}
	data, err := io.ReadAll(source)
	if err != nil {
		return "", 0, 0, apperr.ErrInternal
	}
	width, height, _, err := s.inspectUpload(data)
	if err != nil {
		return "", 0, 0, apperr.ErrInvalidRequest
	}
	mediaURL, err := canonicalMediaPath(key)
	if err != nil {
		return "", 0, 0, apperr.ErrInvalidRequest
	}
	return mediaURL, width, height, nil
}

func (s *Service) NormalizeProductImageURL(value string) (string, error) {
	return NormalizeExternalImageURL(value)
}

const mediaWriteAttempts = 4

func (s *Service) storeOriginal(
	ctx context.Context,
	kind OwnerKind,
	ownerID int64,
	ownerSlug string,
	role Role,
	ext string,
	data []byte,
) (string, error) {
	for range mediaWriteAttempts {
		key, err := mediaStorageKey(kind, ownerID, ownerSlug, role, s.nextID(), ext)
		if err != nil {
			return "", apperr.ErrInternal
		}
		if err := s.store.PutIfAbsent(ctx, key, bytes.NewReader(data)); err == nil {
			return key, nil
		} else if !errors.Is(err, storage.ErrKeyExists) {
			s.log.Error("media: store original", zap.String("key", key), zap.Error(err))
			return "", apperr.ErrInternal
		}
	}
	s.log.Error("media: exhausted storage key attempts")
	return "", apperr.ErrInternal
}

func (s *Service) storeLegacyOriginal(ctx context.Context, folder, ext string, data []byte) (string, error) {
	for range mediaWriteAttempts {
		key := folder + "/" + s.nextID() + "." + ext
		if err := storage.ValidateKey(key); err != nil {
			return "", apperr.ErrInvalidRequest
		}
		if err := s.store.PutIfAbsent(ctx, key, bytes.NewReader(data)); err == nil {
			return key, nil
		} else if !errors.Is(err, storage.ErrKeyExists) {
			s.log.Error("media: store upload", zap.String("key", key), zap.Error(err))
			return "", apperr.ErrInternal
		}
	}
	s.log.Error("media: exhausted legacy storage key attempts")
	return "", apperr.ErrInternal
}

func (s *Service) nextID() string {
	if s.newID != nil {
		return s.newID()
	}
	return uuid.NewString()
}

func isDefinitiveDatabaseRejection(err error) bool {
	var sqlStateErr interface{ SQLState() string }
	if !errors.As(err, &sqlStateErr) {
		return false
	}
	state := sqlStateErr.SQLState()
	if len(state) < 2 {
		return false
	}
	// Only errors that prove PostgreSQL rejected or rolled back this statement
	// permit deletion. Connection, shutdown, I/O, and internal errors remain
	// ambiguous even when they carry a SQLSTATE.
	switch state[:2] {
	case "22", "23", "42", "44":
		return true
	case "40":
		return state != "40003"
	default:
		return false
	}
}

func isProductOwnerForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == "23503" &&
		pgErr.ConstraintName == "product_images_product_id_fkey"
}

func (s *Service) List(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	return s.repo.ListByProduct(ctx, productID)
}

func (s *Service) ReleaseStandalone(ctx context.Context, key string) error {
	if s.life == nil {
		return apperr.ErrInternal
	}
	return s.life.ReleaseStandalone(ctx, key)
}

func (s *Service) UpdateAlt(
	ctx context.Context,
	productID, imageID int64,
	alt models.NullablePatch[string],
) (*models.ProductImage, error) {
	if productID <= 0 || imageID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	image, err := s.repo.GetByID(ctx, imageID)
	if err != nil {
		return nil, err
	}
	if image.ProductID == nil || *image.ProductID != productID || image.ProductVariantID != nil {
		return nil, models.ErrNotFound
	}
	if !alt.Set {
		return image, nil
	}
	if err := normalizeImageAltPatch(&alt); err != nil {
		return nil, err
	}
	return s.repo.UpdateAlt(ctx, imageID, alt.Value)
}

func (s *Service) SetPrimary(ctx context.Context, productID, imageID int64) error {
	if err := s.assertImageBelongs(ctx, productID, imageID); err != nil {
		return err
	}
	return s.repo.SetPrimary(ctx, productID, imageID)
}

func (s *Service) Reorder(ctx context.Context, productID int64, ids []int64) error {
	if productID <= 0 {
		return apperr.ErrInvalidRequest
	}
	if err := s.repo.Reorder(ctx, productID, ids); err != nil {
		if errors.Is(err, models.ErrInvalidState) {
			return apperr.ErrInvalidRequest
		}
		return err
	}
	return nil
}

// Delete removes the row and best-effort deletes the stored original.
func (s *Service) Delete(ctx context.Context, productID, imageID int64) error {
	img, err := s.repo.GetByID(ctx, imageID)
	if err != nil {
		return err
	}
	if img.ProductID == nil || *img.ProductID != productID || img.ProductVariantID != nil {
		return models.ErrNotFound
	}
	if err := s.repo.Delete(ctx, productID, imageID); err != nil {
		return err
	}
	if s.life != nil {
		if img.StorageKey != nil {
			s.life.CleanupKeys(ctx, *img.StorageKey)
		} else {
			s.life.CleanupURLs(ctx, &img.ImageURL)
		}
	} else if img.StorageKey != nil {
		if err := s.store.Delete(ctx, *img.StorageKey); err != nil {
			s.log.Warn("media: delete original", zap.String("key", *img.StorageKey), zap.Error(err))
		}
	}
	return nil
}

func (s *Service) assertImageBelongs(ctx context.Context, productID, imageID int64) error {
	if productID <= 0 || imageID <= 0 {
		return apperr.ErrInvalidRequest
	}
	img, err := s.repo.GetByID(ctx, imageID)
	if err != nil {
		return err
	}
	if img.ProductID == nil || *img.ProductID != productID || img.ProductVariantID != nil {
		return models.ErrNotFound
	}
	return nil
}

// ── Transform (serving) ─────────────────────────────────────────────────────

// DefaultQuality and AllowedOutput let the handler validate query params against
// the same configuration the service uses.
func (s *Service) DefaultQuality() int   { return s.cfg.DefaultQuality }
func (s *Service) MaxDimension() int     { return s.cfg.MaxDimension }
func (s *Service) MaxUploadBytes() int64 { return s.cfg.MaxUploadBytes }
func (s *Service) OutputAllowed(f imaging.Format) bool {
	if len(s.cfg.AllowedOutput) == 0 {
		return true
	}
	return s.cfg.AllowedOutput[f]
}

// Transform returns the rendered bytes and content type for a stored key under
// the given options, serving from the on-disk cache when possible.
func (s *Service) Transform(ctx context.Context, key string, opts imaging.Options) ([]byte, string, error) {
	if err := storage.ValidateKey(key); err != nil {
		return nil, "", models.ErrNotFound
	}
	opts = s.normalize(opts)

	// The effective output format determines both the cache extension and the
	// content type: when the backend can't encode the request it falls back to
	// JPEG, and we keep the cache entry consistent with that.
	effective := opts.Format
	if !s.tr.CanEncode(effective) {
		effective = imaging.FormatJPEG
	}
	opts.Format = effective
	contentType := effective.ContentType()
	cacheKey := s.cacheKey(key, opts, effective)

	// Verify the authoritative original before consulting the disposable render
	// cache. A derivative must never outlive a removed original.
	rc, err := s.store.Open(ctx, key)
	if err != nil {
		return nil, "", models.ErrNotFound
	}
	defer rc.Close()

	if cachedReader, err := s.cache.Open(ctx, cacheKey); err == nil {
		defer cachedReader.Close()
		if cached, err := io.ReadAll(cachedReader); err == nil {
			return cached, contentType, nil
		}
	}
	var original io.Reader = rc
	if s.cfg.MaxUploadBytes > 0 {
		original = io.LimitReader(rc, s.cfg.MaxUploadBytes+1)
	}
	src, err := io.ReadAll(original)
	if err != nil {
		return nil, "", apperr.ErrInternal
	}
	if s.cfg.MaxUploadBytes > 0 && int64(len(src)) > s.cfg.MaxUploadBytes {
		return nil, "", ErrImageTooLarge
	}
	if _, _, _, err := s.inspectImage(src); err != nil {
		return nil, "", err
	}

	out, ct, err := s.tr.Transform(src, opts)
	if err != nil {
		s.log.Warn("media: transform", zap.String("key", key), zap.Error(err))
		return nil, "", apperr.ErrInternal
	}

	// Cache best-effort; a cache write failure must not fail the request.
	if err := s.cache.Put(ctx, cacheKey, bytes.NewReader(out)); err != nil {
		s.log.Warn("media: cache write", zap.String("cache_key", cacheKey), zap.Error(err))
	}
	return out, ct, nil
}

// normalize clamps options to the configured limits and applies defaults.
func (s *Service) normalize(opts imaging.Options) imaging.Options {
	if opts.Format == "" {
		opts.Format = imaging.FormatJPEG
	}
	if opts.Quality <= 0 {
		opts.Quality = s.cfg.DefaultQuality
	}
	if opts.Quality > 100 {
		opts.Quality = 100
	}
	if opts.Width < 0 {
		opts.Width = 0
	}
	if opts.Height < 0 {
		opts.Height = 0
	}
	if opts.Width > s.cfg.MaxDimension {
		opts.Width = s.cfg.MaxDimension
	}
	if opts.Height > s.cfg.MaxDimension {
		opts.Height = s.cfg.MaxDimension
	}
	if opts.Fit == "" {
		opts.Fit = imaging.FitInside
	}
	return opts
}

// cacheKey derives a stable, collision-resistant path for a rendered variant.
func (s *Service) cacheKey(key string, opts imaging.Options, effective imaging.Format) string {
	canonical := string(effective) +
		"|q" + strconv.Itoa(opts.Quality) +
		"|w" + strconv.Itoa(opts.Width) +
		"|h" + strconv.Itoa(opts.Height) +
		"|" + string(opts.Fit)
	sum := sha256.Sum256([]byte(canonical))
	h := hex.EncodeToString(sum[:])
	ext := "jpg"
	switch effective {
	case imaging.FormatWebP:
		ext = "webp"
	case imaging.FormatAVIF:
		ext = "avif"
	case imaging.FormatPNG:
		ext = "png"
	}
	return mediaDerivativePrefix(key) + "/" + h + "." + ext
}
