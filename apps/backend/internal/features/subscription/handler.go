package subscription

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

func (h *Handler) List(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	subs, err := h.Service.List(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, subs)
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req CreateSubscriptionReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	sub, err := h.Service.Create(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, sub)
}

func (h *Handler) Update(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateSubscriptionReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	sub, err := h.Service.Update(c.Request.Context(), userID, id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, sub)
}
