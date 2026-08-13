package tag

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for product tags.
type Handler struct {
	Tag       *Service
	Validator *validator.Validator
}

// NewHandler constructs the tag HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Tag: svc, Validator: v}
}

// CreateTag — POST /admin/tags
func (h *Handler) CreateTag(c *gin.Context) {
	var req CreateTagReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	t, err := h.Tag.Create(c.Request.Context(), req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, t)
}

// ListTags — GET /tags
func (h *Handler) ListTags(c *gin.Context) {
	var filter TagFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	tags, total, err := h.Tag.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, tags, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetTag — GET /tags/:id
func (h *Handler) GetTag(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	t, err := h.Tag.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, t)
}

// UpdateTag — PATCH /admin/tags/:id
func (h *Handler) UpdateTag(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateTagReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	t, err := h.Tag.Update(c.Request.Context(), id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, t)
}

// DeleteTag — DELETE /admin/tags/:id
func (h *Handler) DeleteTag(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Tag.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
