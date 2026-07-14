package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// GetLoyaltyAccount serves GET /api/v1/loyalty.
func (h *Handler) GetLoyaltyAccount(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	acc, err := h.Loyalty.Get(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}

// GetLoyaltyTransactions serves GET /api/v1/loyalty/transactions.
func (h *Handler) GetLoyaltyTransactions(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	txs, err := h.Loyalty.ListTransactions(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, txs)
}

// RedeemLoyaltyPoints serves POST /api/v1/loyalty/redeem.
func (h *Handler) RedeemLoyaltyPoints(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.RedeemPointsRequest
	if !h.bindJSON(c, &req) {
		return
	}
	acc, err := h.Loyalty.Redeem(c.Request.Context(), userID, req.Points)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, acc)
}
