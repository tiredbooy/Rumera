package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// CreateTag — POST /admin/tags
func (h *Handler) CreateTag(c *gin.Context) {
	var req models.CreateTagReq
	if !h.bindJSON(c, &req) {
		return
	}
	tag, err := h.Tag.Create(c.Request.Context(), req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, tag)
}

// ListTags — GET /tags
func (h *Handler) ListTags(c *gin.Context) {
	var filter models.TagFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	tags, total, err := h.Tag.GetAll(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Paginated(c, tags, paginate(filter.Page, filter.Limit, total))
}

// GetTag — GET /tags/:id
func (h *Handler) GetTag(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	tag, err := h.Tag.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, tag)
}

// UpdateTag — PATCH /admin/tags/:id
func (h *Handler) UpdateTag(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateTagReq
	if !h.bindJSON(c, &req) {
		return
	}
	tag, err := h.Tag.Update(c.Request.Context(), id, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, tag)
}

// DeleteTag — DELETE /admin/tags/:id
func (h *Handler) DeleteTag(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Tag.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
