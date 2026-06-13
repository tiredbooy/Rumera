package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// CreateBrand — POST /admin/brands
func (h *Handler) CreateBrand(c *gin.Context) {
	var req models.CreateBrandReq
	if !h.bindJSON(c, &req) {
		return
	}
	brand, err := h.Brand.Create(c.Request.Context(), req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, brand)
}

// ListBrands — GET /brands
func (h *Handler) ListBrands(c *gin.Context) {
	var filter models.BrandFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	brands, total, err := h.Brand.GetAll(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Paginated(c, brands, paginate(filter.Page, filter.Limit, total))
}

// GetBrand — GET /brands/:id
func (h *Handler) GetBrand(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	brand, err := h.Brand.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, brand)
}

// UpdateBrand — PATCH /admin/brands/:id
func (h *Handler) UpdateBrand(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateBrandReq
	if !h.bindJSON(c, &req) {
		return
	}
	brand, err := h.Brand.Update(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, brand)
}

// DeleteBrand — DELETE /admin/brands/:id
func (h *Handler) DeleteBrand(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Brand.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
