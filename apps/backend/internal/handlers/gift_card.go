package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// RedeemGiftCard — POST /gift-cards/redeem (customer)
func (h *Handler) RedeemGiftCard(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.RedeemGiftCardReq
	if !h.bindJSON(c, &req) {
		return
	}
	res, err := h.GiftCard.Redeem(c.Request.Context(), userID, req.Code)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, res)
}

// CreateGiftCards — POST /admin/gift-cards (admin)
func (h *Handler) CreateGiftCards(c *gin.Context) {
	var req models.CreateGiftCardsReq
	if !h.bindJSON(c, &req) {
		return
	}
	cards, err := h.GiftCard.Issue(c.Request.Context(), req.Amount, req.Count)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, cards)
}
