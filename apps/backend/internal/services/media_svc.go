package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/url"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

// Media-specific sentinel errors. Handlers map these to 413 / 415 respectively;
// everything else falls back to the generic error mapping.
var (
	ErrImageTooLarge    = errors.New("media: image exceeds maximum upload size")
	ErrUnsupportedImage = errors.New("media: unsupported or unreadable image")
)

// inputExt maps a probed source format to the extension used for the stored
// original. It also doubles as the allow-list of accepted upload formats.
var inputExt = map[string]string{
	"jpeg": "jpg",
	"png":  "png",
	"webp": "webp",
	"gif":  "gif",
	"avif": "avif",
	"heif": "avif",
}

// MediaConfig captures the runtime knobs the media service needs (sourced from
// configs.Config in bootstrap).
type MediaConfig struct {
	MaxUploadBytes int64
	DefaultQuality int
	MaxDimension   int
	AllowedOutput  map[imaging.Format]bool
}

type productMediaRepository interface {
	GetMediaIdentity(ctx context.Context, productID int64) (slug string, err error)
}

type contentMediaRepository interface {
	OwnerExists(ctx context.Context, ownerType string, ownerID int64) (bool, error)
	Attach(ctx context.Context, ownerType, role string, ownerID int64, url, key string, alt models.NullablePatch[string]) error
}

// MediaService stores uploaded product images and serves resized/recompressed
// variants on the fly. Originals live in `store`; rendered variants are cached
// in `cache`. The actual codec work is delegated to an imaging.Transformer
// (pure-Go by default, libvips under `-tags vips`).
type MediaService struct {
	store storage.WriteOnceStorage
	cache storage.Storage
	repo  repositories.ProductImageRepository
	prod  productMediaRepository
	owner contentMediaRepository
	tr    imaging.Transformer
	cfg   MediaConfig
	log   *zap.Logger
	newID func() string
}

func NewMediaService(
	store storage.WriteOnceStorage,
	cache storage.Storage,
	repo repositories.ProductImageRepository,
	prod productMediaRepository,
	owner contentMediaRepository,
	tr imaging.Transformer,
	cfg MediaConfig,
	log *zap.Logger,
) *MediaService {
	if cfg.DefaultQuality <= 0 {
		cfg.DefaultQuality = 80
	}
	if cfg.MaxDimension <= 0 {
		cfg.MaxDimension = 4000
	}
	return &MediaService{
		store: store,
		cache: cache,
		repo:  repo,
		prod:  prod,
		owner: owner,
		tr:    tr,
		cfg:   cfg,
		log:   log,
		newID: uuid.NewString,
	}
}

// ── Upload & management ─────────────────────────────────────────────────────

// Upload validates and stores an original image for a product, recording a
// product_images row and returning it.
func (s *MediaService) Upload(ctx context.Context, productID int64, data []byte, altText *string, isPrimary bool) (*models.ProductImage, error) {
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
		MediaRoleGallery,
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
		if isDefinitiveDatabaseRejection(err) {
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
		if isProductOwnerForeignKeyViolation(err) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	return created, nil
}

// AddProductImageURL attaches an externally hosted or static image without
// pretending the backend owns its bytes. Product ordering, alt text, and primary
// behavior remain identical to uploaded product images.
func (s *MediaService) AddProductImageURL(
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

	normalized, err := normalizeExternalImageURL(imageURL)
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
		if isProductOwnerForeignKeyViolation(err) {
			return nil, apperr.ErrProductNotFound
		}
		return nil, apperr.ErrInternal
	}
	return created, nil
}

// UploadResult is the outcome of a standalone (non-product) image upload: a
// stored original addressable by its public URL.
type UploadResult struct {
	URL    string `json:"url"`
	Key    string `json:"key"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// UploadImage validates and stores a standalone image (hero slides, recipe and
// journal covers, …) under the given folder prefix and returns its public URL.
// Unlike Upload it records no database row — the URL is persisted on the owning
// entity (e.g. hero_slides.image_url). The same size/format guards apply.
func (s *MediaService) UploadImage(ctx context.Context, folder string, data []byte) (*UploadResult, error) {
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

// UploadOwnerImage stores one immutable content image and atomically attaches
// its canonical URL/key pair to an existing owner slot.
func (s *MediaService) UploadOwnerImage(
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

	if err := s.owner.Attach(ctx, ownerType, role, ownerID, mediaURL, key, altText); err != nil {
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

	return &UploadResult{URL: mediaURL, Key: key, Width: w, Height: h}, nil
}

func (s *MediaService) inspectUpload(data []byte) (width, height int, ext string, err error) {
	if s.cfg.MaxUploadBytes > 0 && int64(len(data)) > s.cfg.MaxUploadBytes {
		return 0, 0, "", ErrImageTooLarge
	}
	if len(data) == 0 {
		return 0, 0, "", ErrUnsupportedImage
	}
	width, height, format, err := s.tr.Probe(data)
	if err != nil {
		return 0, 0, "", ErrUnsupportedImage
	}
	ext, ok := inputExt[format]
	if !ok {
		return 0, 0, "", ErrUnsupportedImage
	}
	return width, height, ext, nil
}

func normalizeExternalImageURL(value string) (string, error) {
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

const mediaWriteAttempts = 4

func (s *MediaService) storeOriginal(
	ctx context.Context,
	kind MediaOwnerKind,
	ownerID int64,
	ownerSlug string,
	role MediaRole,
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

func (s *MediaService) storeLegacyOriginal(ctx context.Context, folder, ext string, data []byte) (string, error) {
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

func (s *MediaService) nextID() string {
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

func (s *MediaService) List(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	return s.repo.ListByProduct(ctx, productID)
}

func (s *MediaService) UpdateAlt(
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
	if image.ProductID == nil || *image.ProductID != productID {
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

func (s *MediaService) SetPrimary(ctx context.Context, productID, imageID int64) error {
	if err := s.assertImageBelongs(ctx, productID, imageID); err != nil {
		return err
	}
	return s.repo.SetPrimary(ctx, productID, imageID)
}

func (s *MediaService) Reorder(ctx context.Context, productID int64, ids []int64) error {
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
func (s *MediaService) Delete(ctx context.Context, productID, imageID int64) error {
	img, err := s.repo.GetByID(ctx, imageID)
	if err != nil {
		return err
	}
	if img.ProductID == nil || *img.ProductID != productID {
		return models.ErrNotFound
	}
	if err := s.repo.Delete(ctx, productID, imageID); err != nil {
		return err
	}
	if img.StorageKey != nil {
		if err := s.store.Delete(ctx, *img.StorageKey); err != nil {
			s.log.Warn("media: delete original", zap.String("key", *img.StorageKey), zap.Error(err))
		}
	}
	return nil
}

func (s *MediaService) assertImageBelongs(ctx context.Context, productID, imageID int64) error {
	if productID <= 0 || imageID <= 0 {
		return apperr.ErrInvalidRequest
	}
	img, err := s.repo.GetByID(ctx, imageID)
	if err != nil {
		return err
	}
	if img.ProductID == nil || *img.ProductID != productID {
		return models.ErrNotFound
	}
	return nil
}

// ── Transform (serving) ─────────────────────────────────────────────────────

// DefaultQuality and AllowedOutput let the handler validate query params against
// the same configuration the service uses.
func (s *MediaService) DefaultQuality() int   { return s.cfg.DefaultQuality }
func (s *MediaService) MaxDimension() int     { return s.cfg.MaxDimension }
func (s *MediaService) MaxUploadBytes() int64 { return s.cfg.MaxUploadBytes }
func (s *MediaService) OutputAllowed(f imaging.Format) bool {
	if len(s.cfg.AllowedOutput) == 0 {
		return true
	}
	return s.cfg.AllowedOutput[f]
}

// Transform returns the rendered bytes and content type for a stored key under
// the given options, serving from the on-disk cache when possible.
func (s *MediaService) Transform(ctx context.Context, key string, opts imaging.Options) ([]byte, string, error) {
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
	contentType := effective.ContentType()
	cacheKey := s.cacheKey(key, opts, effective)

	if rc, err := s.cache.Open(ctx, cacheKey); err == nil {
		defer rc.Close()
		if cached, err := io.ReadAll(rc); err == nil {
			return cached, contentType, nil
		}
	}

	rc, err := s.store.Open(ctx, key)
	if err != nil {
		return nil, "", models.ErrNotFound
	}
	defer rc.Close()
	src, err := io.ReadAll(rc)
	if err != nil {
		return nil, "", apperr.ErrInternal
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
func (s *MediaService) normalize(opts imaging.Options) imaging.Options {
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
func (s *MediaService) cacheKey(key string, opts imaging.Options, effective imaging.Format) string {
	canonical := key + "|" + string(effective) +
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
	return "render/" + h[:2] + "/" + h + "." + ext
}
