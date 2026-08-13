package brand

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for brands.
type Handler struct {
	Brand     Service
	Validator *validator.Validator
}

// NewHandler constructs the brand HTTP handler.
func NewHandler(svc Service, v *validator.Validator) *Handler {
	return &Handler{Brand: svc, Validator: v}
}

// CreateBrand — POST /admin/brands
func (h *Handler) CreateBrand(c *gin.Context) {
	var req CreateBrandReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	b, err := h.Brand.Create(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, b)
}

// ListBrands — GET /brands
func (h *Handler) ListBrands(c *gin.Context) {
	var filter BrandFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	brands, total, err := h.Brand.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, brands, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetBrand — GET /brands/:id
func (h *Handler) GetBrand(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	b, err := h.Brand.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, b)
}

// GetBrandBySlug — GET /brands/slug/:slug
func (h *Handler) GetBrandBySlug(c *gin.Context) {
	b, err := h.Brand.GetBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, b)
}

// UpdateBrand — PATCH /admin/brands/:id
func (h *Handler) UpdateBrand(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateBrandReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	b, err := h.Brand.Update(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, b)
}

// DeleteBrand — DELETE /admin/brands/:id
func (h *Handler) DeleteBrand(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Brand.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
