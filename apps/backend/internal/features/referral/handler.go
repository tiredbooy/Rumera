package referral

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

func (h *Handler) GetMine(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	ref, err := h.Service.Get(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ref)
}

func (h *Handler) Claim(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req ClaimReferralInput
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Service.Claim(c.Request.Context(), userID, req.Code); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
