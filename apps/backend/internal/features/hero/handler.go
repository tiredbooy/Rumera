package hero

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for home hero slides.
type Handler struct {
	Service   Service
	Validator *validator.Validator
}

// NewHandler constructs the hero slides HTTP handler.
func NewHandler(svc Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

// ListPublic — GET /hero-slides
func (h *Handler) ListPublic(c *gin.Context) {
	slides, err := h.Service.GetActive(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToPublicList(slides))
}

// ListAdmin — GET /admin/hero-slides
func (h *Handler) ListAdmin(c *gin.Context) {
	slides, err := h.Service.GetAll(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToAdminList(slides))
}

// Get — GET /admin/hero-slides/:id
func (h *Handler) Get(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	slide, err := h.Service.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToAdmin(slide))
}

// Create — POST /admin/hero-slides
func (h *Handler) Create(c *gin.Context) {
	var req HeroSlideReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	slide, err := h.Service.Create(c.Request.Context(), &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, ToAdmin(slide))
}

type reorderReq struct {
	IDs []int64 `json:"ids" validate:"required,min=1,dive,gt=0"`
}

// Reorder — PUT /admin/hero-slides/order
func (h *Handler) Reorder(c *gin.Context) {
	var req reorderReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Service.Reorder(c.Request.Context(), req.IDs); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// Update — PATCH /admin/hero-slides/:id
func (h *Handler) Update(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req HeroSlideUpdateReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	slide, err := h.Service.Update(c.Request.Context(), id, &req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToAdmin(slide))
}

// Delete — DELETE /admin/hero-slides/:id
func (h *Handler) Delete(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Service.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
