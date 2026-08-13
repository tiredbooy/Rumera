package taste

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

func (h *Handler) Get(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	profile, err := h.Service.Get(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, profile)
}

func (h *Handler) Save(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req UpdateTasteProfileInput
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	profile, err := h.Service.Save(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, profile)
}
