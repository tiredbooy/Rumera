package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

type optionIDsReq struct {
	OptionValueIDs []int64 `json:"option_value_ids" validate:"required"`
}

// CreateVariant — POST /admin/products/:id/variants
func (h *Handler) CreateVariant(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.CreateVariantReq
	if !h.bindJSON(c, &req) {
		return
	}
	variant, err := h.Variant.Create(c.Request.Context(), productID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, mappers.ToVariantResponse(variant, nil, nil, nil))
}

// GetVariant returns a variant with its options and images.
//
// GET /variants/:id
func (h *Handler) GetVariant(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	variant, err := h.Variant.GetByID(ctx, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	options, err := h.Variant.GetOptions(ctx, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	images, err := h.Variant.GetImages(ctx, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	imgResp := make([]models.ImageResponse, len(images))
	for i, img := range images {
		imgResp[i] = mappers.ToImageResponse(img)
	}
	response.OK(c, mappers.ToVariantResponse(variant, options, imgResp, nil))
}

// UpdateVariant — PATCH /admin/variants/:id
func (h *Handler) UpdateVariant(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateVariantReq
	if !h.bindJSON(c, &req) {
		return
	}
	variant, err := h.Variant.Update(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToVariantResponse(variant, nil, nil, nil))
}

// DeleteVariant — DELETE /admin/variants/:id
func (h *Handler) DeleteVariant(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Variant.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// AttachVariantOptions — POST /admin/variants/:id/options
func (h *Handler) AttachVariantOptions(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req optionIDsReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.Variant.AttachOptions(c.Request.Context(), id, req.OptionValueIDs); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// VariantOptions — GET /variants/:id/options
func (h *Handler) VariantOptions(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	options, err := h.Variant.GetOptions(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, options)
}

// VariantImages — GET /variants/:id/images
func (h *Handler) VariantImages(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	images, err := h.Variant.GetImages(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	out := make([]models.ImageResponse, len(images))
	for i, img := range images {
		out[i] = mappers.ToImageResponse(img)
	}
	response.OK(c, out)
}
