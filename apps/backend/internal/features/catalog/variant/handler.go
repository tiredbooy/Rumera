package variant

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for product variants.
type Handler struct {
	Variant   *Service
	Validator *validator.Validator
	Cache     cache.Store
}

// NewHandler constructs the variant HTTP handler.
func NewHandler(svc *Service, v *validator.Validator, store cache.Store) *Handler {
	return &Handler{Variant: svc, Validator: v, Cache: store}
}

type optionIDsReq struct {
	OptionValueIDs []int64 `json:"option_value_ids" validate:"required"`
}

type replaceOptionIDsReq struct {
	OptionValueIDs *[]int64 `json:"option_value_ids" validate:"required"`
}

// CreateVariant — POST /admin/products/:id/variants
func (h *Handler) CreateVariant(c *gin.Context) {
	productID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req CreateVariantReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	variant, err := h.Variant.Create(c.Request.Context(), productID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(productID))
	response.Created(c, toVariantResponse(variant, nil, nil, nil))
}

// GetVariant returns a variant with its options and images.
//
// GET /variants/:id
func (h *Handler) GetVariant(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	variant, err := h.Variant.GetByID(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	options, err := h.Variant.GetOptions(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	images, err := h.Variant.GetImages(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	imgResp := make([]models.ImageResponse, len(images))
	for i, img := range images {
		imgResp[i] = toImageResponse(img)
	}
	response.OK(c, toVariantResponse(variant, options, imgResp, nil))
}

// UpdateVariant — PATCH /admin/variants/:id
func (h *Handler) UpdateVariant(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateVariantReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()
	current, err := h.Variant.GetByID(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	variant, err := h.Variant.Update(ctx, id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(ctx, cache.KeyProduct(current.ProductID))
	response.OK(c, toVariantResponse(variant, nil, nil, nil))
}

// DeleteVariant — DELETE /admin/variants/:id
func (h *Handler) DeleteVariant(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()
	variant, err := h.Variant.GetByID(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if err := h.Variant.Delete(ctx, id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(ctx, cache.KeyProduct(variant.ProductID))
	response.NoContent(c)
}

// AttachVariantOptions — POST /admin/variants/:id/options
func (h *Handler) AttachVariantOptions(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req optionIDsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()
	variant, err := h.Variant.GetByID(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if err := h.Variant.AttachOptions(ctx, id, req.OptionValueIDs); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(ctx, cache.KeyProduct(variant.ProductID))
	response.NoContent(c)
}

// ReplaceVariantOptions — PUT /admin/variants/:id/options.
func (h *Handler) ReplaceVariantOptions(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req replaceOptionIDsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if req.OptionValueIDs == nil {
		response.Error(c, response.ErrInvalidBody)
		return
	}
	ctx := c.Request.Context()
	variant, err := h.Variant.GetByID(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if err := h.Variant.ReplaceOptions(ctx, id, *req.OptionValueIDs); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(ctx, cache.KeyProduct(variant.ProductID))
	response.NoContent(c)
}

// VariantOptions — GET /variants/:id/options
func (h *Handler) VariantOptions(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	options, err := h.Variant.GetOptions(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, options)
}

// VariantImages — GET /variants/:id/images
func (h *Handler) VariantImages(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	images, err := h.Variant.GetImages(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]models.ImageResponse, len(images))
	for i, img := range images {
		out[i] = toImageResponse(img)
	}
	response.OK(c, out)
}

func (h *Handler) invalidate(ctx context.Context, keys ...string) {
	if h.Cache == nil || len(keys) == 0 {
		return
	}
	_ = h.Cache.Delete(ctx, keys...)
}

func toVariantResponse(
	v *ProductVariant,
	options []models.OptionValueResponse,
	images []models.ImageResponse,
	availableStock *int,
) models.VariantResponse {
	if options == nil {
		options = []models.OptionValueResponse{}
	}
	if images == nil {
		images = []models.ImageResponse{}
	}
	return models.VariantResponse{
		ID:             v.ID,
		SKU:            v.SKU,
		Price:          v.Price,
		CompareAtPrice: v.CompareAtPrice,
		IsActive:       v.IsActive,
		AvailableStock: availableStock,
		Options:        options,
		Images:         images,
	}
}

func toImageResponse(i *models.ProductImage) models.ImageResponse {
	return models.ImageResponse{
		ID: i.ID, ImageURL: i.ImageURL, StorageKey: i.StorageKey, AltText: i.AltText,
		SortOrder: i.SortOrder, IsPrimary: i.IsPrimary, Width: i.Width, Height: i.Height,
	}
}
