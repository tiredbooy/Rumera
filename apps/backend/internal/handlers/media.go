package handlers

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/imaging"
	"github.com/tiredbooy/pkg/response"
)

// ── Admin: product image management ─────────────────────────────────────────

// UploadProductImage — POST /admin/products/:id/images (multipart: file, alt_text?, is_primary?)
func (h *Handler) UploadProductImage(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}

	// Bound the request body so a huge upload can't exhaust memory; the +1 lets
	// us detect "exactly at the limit vs. over".
	maxBytes := h.Media.MaxUploadBytes()
	if maxBytes > 0 {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes+1)
	}

	file, _, err := c.Request.FormFile("file")
	if err != nil {
		response.Error(c, response.ErrInvalidRequest)
		return
	}
	defer file.Close()

	var reader io.Reader = file
	if maxBytes > 0 {
		reader = io.LimitReader(file, maxBytes+1)
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		response.Error(c, response.ErrFileTooLarge)
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
	response.Created(c, mappers.ToImageResponse(img))
}

// ListProductImages — GET /admin/products/:id/images
func (h *Handler) ListProductImages(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
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
		out = append(out, mappers.ToImageResponse(img))
	}
	response.OK(c, out)
}

type reorderImagesReq struct {
	IDs []int64 `json:"ids" validate:"required,min=1"`
}

// ReorderProductImages — PUT /admin/products/:id/images/order
func (h *Handler) ReorderProductImages(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req reorderImagesReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.Media.Reorder(c.Request.Context(), productID, req.IDs); err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.NoContent(c)
}

// SetPrimaryProductImage — PUT /admin/products/:id/images/:imageId/primary
func (h *Handler) SetPrimaryProductImage(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	imageID, ok := h.paramInt64(c, "imageId")
	if !ok {
		return
	}
	if err := h.Media.SetPrimary(c.Request.Context(), productID, imageID); err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.NoContent(c)
}

type updateImageReq struct {
	AltText *string `json:"alt_text"`
}

// UpdateProductImage — PATCH /admin/products/:id/images/:imageId (alt text)
func (h *Handler) UpdateProductImage(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	imageID, ok := h.paramInt64(c, "imageId")
	if !ok {
		return
	}
	var req updateImageReq
	if !h.bindJSON(c, &req) {
		return
	}
	img, err := h.Media.UpdateAlt(c.Request.Context(), productID, imageID, req.AltText)
	if err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.OK(c, mappers.ToImageResponse(img))
}

// DeleteProductImage — DELETE /admin/products/:id/images/:imageId
func (h *Handler) DeleteProductImage(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	imageID, ok := h.paramInt64(c, "imageId")
	if !ok {
		return
	}
	if err := h.Media.Delete(c.Request.Context(), productID, imageID); err != nil {
		h.handleMediaError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Public: on-the-fly transform ────────────────────────────────────────────

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

// parseTransformParams reads the f/q/w/h/fit query params, negotiating the
// format from Accept when f is omitted. It writes the error response and returns
// false on any invalid value.
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

// parseDimension parses an optional positive pixel dimension. Empty → (0, true).
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

// negotiateFormat picks the best output format from an Accept header, honouring
// the configured allow-list and falling back to JPEG.
func (h *Handler) negotiateFormat(accept string) imaging.Format {
	if strings.Contains(accept, "image/avif") && h.Media.OutputAllowed(imaging.FormatAVIF) {
		return imaging.FormatAVIF
	}
	if strings.Contains(accept, "image/webp") && h.Media.OutputAllowed(imaging.FormatWebP) {
		return imaging.FormatWebP
	}
	return imaging.FormatJPEG
}

// handleMediaError maps the media sentinels to precise HTTP codes, deferring to
// the shared error handler for everything else.
func (h *Handler) handleMediaError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrImageTooLarge):
		response.Error(c, response.ErrFileTooLarge)
	case errors.Is(err, services.ErrUnsupportedImage):
		response.Error(c, response.ErrInvalidFileType)
	default:
		h.handleError(c, err)
	}
}
