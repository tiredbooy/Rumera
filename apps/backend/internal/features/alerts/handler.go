package alerts

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

type Handler struct {
	Service   *Service
	Validator *validator.Validator
}

func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req CreateProductAlertReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	alert, err := h.Service.Create(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, alert)
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	list, err := h.Service.List(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Service.Delete(c.Request.Context(), userID, id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
