package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"strconv"

	"github.com/google/uuid"
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
	PublicBaseURL  string // prepended to "/media/{key}"; empty = same-origin
	MaxUploadBytes int64
	DefaultQuality int
	MaxDimension   int
	AllowedOutput  map[imaging.Format]bool
}

// MediaService stores uploaded product images and serves resized/recompressed
// variants on the fly. Originals live in `store`; rendered variants are cached
// in `cache`. The actual codec work is delegated to an imaging.Transformer
// (pure-Go by default, libvips under `-tags vips`).
type MediaService struct {
	store storage.Storage
	cache storage.Storage
	repo  repositories.ProductImageRepository
	prod  repositories.ProductRepository
	tr    imaging.Transformer
	cfg   MediaConfig
	log   *zap.Logger
}

func NewMediaService(
	store, cache storage.Storage,
	repo repositories.ProductImageRepository,
	prod repositories.ProductRepository,
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
	return &MediaService{store: store, cache: cache, repo: repo, prod: prod, tr: tr, cfg: cfg, log: log}
}

// PublicURL builds the canonical serving URL for a storage key.
func (s *MediaService) PublicURL(key string) string {
	return s.cfg.PublicBaseURL + "/media/" + key
}

// ── Upload & management ─────────────────────────────────────────────────────

// Upload validates and stores an original image for a product, recording a
// product_images row and returning it.
func (s *MediaService) Upload(ctx context.Context, productID int64, data []byte, altText *string, isPrimary bool) (*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	if s.cfg.MaxUploadBytes > 0 && int64(len(data)) > s.cfg.MaxUploadBytes {
		return nil, ErrImageTooLarge
	}
	if len(data) == 0 {
		return nil, ErrUnsupportedImage
	}

	if exists, err := s.prod.ExistsByID(ctx, productID); err != nil {
		return nil, apperr.ErrInternal
	} else if !exists {
		return nil, apperr.ErrProductNotFound
	}

	w, h, format, err := s.tr.Probe(data)
	if err != nil {
		return nil, ErrUnsupportedImage
	}
	ext, ok := inputExt[format]
	if !ok {
		return nil, ErrUnsupportedImage
	}

	key := "products/" + uuid.NewString() + "." + ext
	if err := s.store.Put(ctx, key, bytes.NewReader(data)); err != nil {
		s.log.Error("media: store original", zap.String("key", key), zap.Error(err))
		return nil, apperr.ErrInternal
	}

	sortOrder, err := s.repo.NextSortOrder(ctx, productID)
	if err != nil {
		_ = s.store.Delete(ctx, key) // don't leak the blob if the row never lands
		return nil, apperr.ErrInternal
	}
	// The first image of a product is primary by default.
	primary := isPrimary || sortOrder == 0

	pid := productID
	wv, hv := w, h
	img := &models.ProductImage{
		ProductID:  &pid,
		ImageURL:   s.PublicURL(key),
		StorageKey: &key,
		AltText:    altText,
		SortOrder:  sortOrder,
		IsPrimary:  primary,
		Width:      &wv,
		Height:     &hv,
	}
	created, err := s.repo.Create(ctx, img)
	if err != nil {
		_ = s.store.Delete(ctx, key)
		s.log.Error("media: create row", zap.Error(err))
		return nil, apperr.ErrInternal
	}
	if primary {
		// Guarantee exactly one primary per product.
		if err := s.repo.SetPrimary(ctx, productID, created.ID); err != nil {
			s.log.Warn("media: set primary", zap.Int64("image_id", created.ID), zap.Error(err))
		}
		created.IsPrimary = true
	}
	return created, nil
}

func (s *MediaService) List(ctx context.Context, productID int64) ([]*models.ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.ErrInvalidRequest
	}
	return s.repo.ListByProduct(ctx, productID)
}

func (s *MediaService) UpdateAlt(ctx context.Context, productID, imageID int64, alt *string) (*models.ProductImage, error) {
	if err := s.assertImageBelongs(ctx, productID, imageID); err != nil {
		return nil, err
	}
	return s.repo.UpdateAlt(ctx, imageID, alt)
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
	return s.repo.Reorder(ctx, productID, ids)
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
	if err := s.repo.Delete(ctx, imageID); err != nil {
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
