package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ── Public ───────────────────────────────────────────────────────────────────

// ListHeroSlides — GET /hero-slides. Returns active slides for the storefront
// home carousel, ordered for display.
func (h *Handler) ListHeroSlides(c *gin.Context) {
	slides, err := h.HeroSlide.GetActive(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToPublicHeroSlideResponses(slides))
}

// ── Admin ────────────────────────────────────────────────────────────────────

// ListHeroSlidesAdmin — GET /admin/hero-slides. Returns every slide.
func (h *Handler) ListHeroSlidesAdmin(c *gin.Context) {
	slides, err := h.HeroSlide.GetAll(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToAdminHeroSlideResponses(slides))
}

// GetHeroSlide — GET /admin/hero-slides/:id
func (h *Handler) GetHeroSlide(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	slide, err := h.HeroSlide.GetByID(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToAdminHeroSlideResponse(slide))
}

// CreateHeroSlide — POST /admin/hero-slides
func (h *Handler) CreateHeroSlide(c *gin.Context) {
	var req models.HeroSlideReq
	if !h.bindJSON(c, &req) {
		return
	}
	slide, err := h.HeroSlide.Create(c.Request.Context(), &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Created(c, mappers.ToAdminHeroSlideResponse(slide))
}

type reorderHeroSlidesReq struct {
	IDs []int64 `json:"ids" validate:"required,min=1,dive,gt=0"`
}

// ReorderHeroSlides — PUT /admin/hero-slides/order
func (h *Handler) ReorderHeroSlides(c *gin.Context) {
	var req reorderHeroSlidesReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.HeroSlide.Reorder(c.Request.Context(), req.IDs); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// UpdateHeroSlide — PATCH /admin/hero-slides/:id
func (h *Handler) UpdateHeroSlide(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.HeroSlideUpdateReq
	if !h.bindJSON(c, &req) {
		return
	}
	slide, err := h.HeroSlide.Update(c.Request.Context(), id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToAdminHeroSlideResponse(slide))
}

// DeleteHeroSlide — DELETE /admin/hero-slides/:id
func (h *Handler) DeleteHeroSlide(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.HeroSlide.Delete(c.Request.Context(), id); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}
