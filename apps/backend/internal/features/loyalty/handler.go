package loyalty

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/apperr"
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

func (h *Handler) GetAccount(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	acc, err := h.Service.Get(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}

func (h *Handler) ListTransactions(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	txs, err := h.Service.ListTransactions(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, txs)
}

// GetProgramme returns effective env rates + tiers for admin (PH-040d).
func (h *Handler) GetProgramme(c *gin.Context) {
	if h.Service == nil {
		httpx.HandleError(c, apperr.ErrInternal)
		return
	}
	response.OK(c, h.Service.Programme())
}

func (h *Handler) Redeem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req RedeemPointsRequest
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	// Bind durable spend key to HTTP Idempotency-Key when present (PH-040b).
	clientKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	acc, err := h.Service.Redeem(c.Request.Context(), userID, req.Points, clientKey)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}
