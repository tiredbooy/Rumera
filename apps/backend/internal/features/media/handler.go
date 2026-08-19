package media

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/storage"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for media upload/admin product images and public transforms.
type Handler struct {
	Media     *Service
	Cache     cache.Store
	Validator *validator.Validator
}

// NewHandler constructs the media HTTP handler.
func NewHandler(svc *Service, store cache.Store, v *validator.Validator) *Handler {
	return &Handler{Media: svc, Cache: store, Validator: v}
}

func (h *Handler) invalidate(ctx context.Context, keys ...string) {
	if h.Cache == nil || len(keys) == 0 {
		return
	}
	_ = h.Cache.Delete(ctx, keys...)
}

// ── Admin: product image management ─────────────────────────────────────────

// UploadProductImage — POST /admin/products/:id/images
func (h *Handler) UploadProductImage(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	data, ok := h.readImageUpload(c)
	if !ok {
		return
	}
	var altText *string
	if v := strings.TrimSpace(c.PostForm("alt_text")); v != "" {
		altText = &v
	}
	isPrimary, _ := strconv.ParseBool(c.PostForm("is_primary"))
	img, err := h.Media.Upload(c.Request.Context(), productID, data, altText, isPrimary)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.Created(c, ToImageResponse(img))
}

type productImageURLReq struct {
	ImageURL  string  `json:"image_url" validate:"required,max=2048"`
	AltText   *string `json:"alt_text" validate:"omitempty,max=255"`
	IsPrimary bool    `json:"is_primary"`
}

// AddProductImageURL — POST /admin/products/:id/images/url
func (h *Handler) AddProductImageURL(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req productImageURLReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	img, err := h.Media.AddProductImageURL(
		c.Request.Context(), productID, req.ImageURL, req.AltText, req.IsPrimary,
	)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.Created(c, ToImageResponse(img))
}

// ListProductImages — GET /admin/products/:id/images
func (h *Handler) ListProductImages(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	images, err := h.Media.List(c.Request.Context(), productID)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	out := make([]models.ImageResponse, 0, len(images))
	for _, img := range images {
		out = append(out, ToImageResponse(img))
	}
	response.OK(c, out)
}

type reorderImagesReq struct {
	IDs []int64 `json:"ids" validate:"required,min=1"`
}

// ReorderProductImages — PUT /admin/products/:id/images/order
func (h *Handler) ReorderProductImages(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req reorderImagesReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Media.Reorder(c.Request.Context(), productID, req.IDs); err != nil {
		h.handleMediaError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.NoContent(c)
}

// SetPrimaryProductImage — PUT /admin/products/:id/images/:imageId/primary
func (h *Handler) SetPrimaryProductImage(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	imageID, ok := httpx.ParamInt64(c, "imageId")
	if !ok {
		return
	}
	if err := h.Media.SetPrimary(c.Request.Context(), productID, imageID); err != nil {
		h.handleMediaError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.NoContent(c)
}

type updateImageReq struct {
	AltText models.NullablePatch[string] `json:"alt_text"`
}

// UpdateProductImage — PATCH /admin/products/:id/images/:imageId
func (h *Handler) UpdateProductImage(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	imageID, ok := httpx.ParamInt64(c, "imageId")
	if !ok {
		return
	}
	var req updateImageReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	img, err := h.Media.UpdateAlt(c.Request.Context(), productID, imageID, req.AltText)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.OK(c, ToImageResponse(img))
}

// DeleteProductImage — DELETE /admin/products/:id/images/:imageId
func (h *Handler) DeleteProductImage(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	imageID, ok := httpx.ParamInt64(c, "imageId")
	if !ok {
		return
	}
	if err := h.Media.Delete(c.Request.Context(), productID, imageID); err != nil {
		h.handleMediaError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.NoContent(c)
}

var uploadFolders = map[string]bool{
	"categories": true,
	"uploads":    true,
}

const mediaMultipartOverheadBytes int64 = 64 << 10

// UploadImage — POST /admin/uploads
func (h *Handler) UploadImage(c *gin.Context) {
	data, ok := h.readImageUpload(c)
	if !ok {
		return
	}
	folder := strings.TrimSpace(c.PostForm("folder"))
	if folder == "" || !uploadFolders[folder] {
		folder = "uploads"
	}
	res, err := h.Media.UploadImage(c.Request.Context(), folder, data)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.Created(c, res)
}

// ListLibrary — GET /admin/uploads. CE-10: the reusable media library behind
// the editor's image picker.
func (h *Handler) ListLibrary(c *gin.Context) {
	limit, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
	items, err := h.Media.ListLibrary(c.Request.Context(), c.Query("q"), limit)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.OK(c, items)
}

type releaseStandaloneUploadReq struct {
	Key string `json:"key" validate:"required,max=512"`
}

// ReleaseStandaloneUpload — POST /admin/uploads/release
func (h *Handler) ReleaseStandaloneUpload(c *gin.Context) {
	var req releaseStandaloneUploadReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Media.ReleaseStandalone(c.Request.Context(), req.Key); err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.NoContent(c)
}

// UploadOwnerImage — POST /admin/uploads/:ownerType/:ownerID/:role
func (h *Handler) UploadOwnerImage(c *gin.Context) {
	ownerID, ok := httpx.ParamInt64(c, "ownerID")
	if !ok {
		return
	}
	data, ok := h.readImageUpload(c)
	if !ok {
		return
	}
	altText := models.NullablePatch[string]{}
	if value, exists := c.GetPostForm("alt_text"); exists {
		altText.Set = true
		altText.Value = &value
	}
	res, err := h.Media.UploadOwnerImage(
		c.Request.Context(), c.Param("ownerType"), ownerID, c.Param("role"), data, altText,
	)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	if c.Param("ownerType") == "recipes" && res.OwnerSlug != "" {
		h.invalidate(c.Request.Context(), cache.KeyRecipe(res.OwnerSlug))
	}
	response.Created(c, res)
}

func (h *Handler) readImageUpload(c *gin.Context) ([]byte, bool) {
	maxBytes := h.Media.MaxUploadBytes()
	if maxBytes > 0 {
		requestLimit := maxBytes + mediaMultipartOverheadBytes
		if requestLimit < maxBytes {
			requestLimit = maxBytes
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, requestLimit)
	}
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Error(c, response.ErrFileTooLarge)
			return nil, false
		}
		response.Error(c, response.ErrInvalidRequest)
		return nil, false
	}
	defer func() { _ = file.Close() }()

	var reader io.Reader = file
	if maxBytes > 0 {
		reader = io.LimitReader(file, maxBytes+1)
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		response.Error(c, response.ErrFileTooLarge)
		return nil, false
	}
	if maxBytes > 0 && int64(len(data)) > maxBytes {
		response.Error(c, response.ErrFileTooLarge)
		return nil, false
	}
	return data, true
}

// ServeMedia — GET /media/*key
func (h *Handler) ServeMedia(c *gin.Context) {
	key := strings.TrimPrefix(c.Param("key"), "/")
	if key == "" {
		response.Error(c, response.ErrNotFound)
		return
	}
	opts, ok := h.parseTransformParams(c)
	if !ok {
		return
	}
	data, contentType, err := h.Media.Transform(c.Request.Context(), key, opts)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("Vary", "Accept")
	c.Data(http.StatusOK, contentType, data)
}

func (h *Handler) parseTransformParams(c *gin.Context) (imaging.Options, bool) {
	var o imaging.Options
	if f := c.Query("f"); f != "" {
		fm, err := imaging.ParseFormat(f)
		if err != nil || !h.Media.OutputAllowed(fm) {
			response.Error(c, response.ErrInvalidParams)
			return o, false
		}
		o.Format = fm
	} else {
		o.Format = h.negotiateFormat(c.GetHeader("Accept"))
	}
	if q := c.Query("q"); q != "" {
		n, err := strconv.Atoi(q)
		if err != nil || n < 1 || n > 100 {
			response.Error(c, response.ErrInvalidParams)
			return o, false
		}
		o.Quality = n
	}
	w, okw := parseDimension(c.Query("w"))
	hgt, okh := parseDimension(c.Query("h"))
	if !okw || !okh {
		response.Error(c, response.ErrInvalidParams)
		return imaging.Options{}, false
	}
	o.Width = w
	o.Height = hgt
	if fit := c.Query("fit"); fit != "" {
		ft, err := imaging.ParseFit(fit)
		if err != nil {
			response.Error(c, response.ErrInvalidParams)
			return imaging.Options{}, false
		}
		o.Fit = ft
	}
	return o, true
}

func parseDimension(raw string) (int, bool) {
	if raw == "" {
		return 0, true
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return 0, false
	}
	return n, true
}

func (h *Handler) negotiateFormat(accept string) imaging.Format {
	if strings.Contains(accept, "image/avif") && h.Media.OutputAllowed(imaging.FormatAVIF) {
		return imaging.FormatAVIF
	}
	if strings.Contains(accept, "image/webp") && h.Media.OutputAllowed(imaging.FormatWebP) {
		return imaging.FormatWebP
	}
	return imaging.FormatJPEG
}

func (h *Handler) handleMediaError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrImageTooLarge), errors.Is(err, ErrImageDimensionsTooLarge):
		response.Error(c, response.ErrFileTooLarge)
	case errors.Is(err, ErrUnsupportedImage):
		response.Error(c, response.ErrInvalidFileType)
	case errors.Is(err, ErrInvalidMediaOwner), errors.Is(err, storage.ErrInvalidKey):
		response.Error(c, response.ErrInvalidParams)
	case errors.Is(err, models.ErrNotFound):
		// Cross-owner / missing image mutations return 404, not 500.
		response.Error(c, response.ErrNotFound)
	default:
		// Map remaining domain sentinels (and apperr) the same way as other features.
		httpx.HandleError(c, err)
	}
}
