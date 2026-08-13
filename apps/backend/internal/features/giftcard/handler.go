package giftcard

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// PurchaseGateway starts a pending gateway payment for gift-card buy (PH-042a).
// Implemented by payments.Service via bootstrap adapter.
type PurchaseGateway interface {
	CreateGiftCardPurchase(ctx context.Context, userID int64, amount float64) (*PurchaseIntentView, error)
}

// PurchaseIntentView mirrors payments.TopUpIntent without importing payments.
type PurchaseIntentView struct {
	PaymentID     int64
	TransactionID string
	Amount        float64
	Currency      string
	Status        string
}

type Handler struct {
	Service    *Service
	PurchaseGW PurchaseGateway
	Validator  *validator.Validator
}

func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

// WithPurchase wires the payment starter after payments.Service exists.
func (h *Handler) WithPurchase(g PurchaseGateway) *Handler {
	if h != nil {
		h.PurchaseGW = g
	}
	return h
}

func (h *Handler) Redeem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req RedeemGiftCardReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	res, err := h.Service.Redeem(c.Request.Context(), userID, req.Code)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, res)
}

// Purchase — POST /gift-cards/purchase (pending payment; code after webhook).
func (h *Handler) Purchase(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	if h.PurchaseGW == nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	var req PurchaseGiftCardReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	intent, err := h.PurchaseGW.CreateGiftCardPurchase(c.Request.Context(), userID, req.Amount)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, PurchaseIntentResponse{
		PaymentID:     intent.PaymentID,
		TransactionID: intent.TransactionID,
		Amount:        fmt.Sprintf("%.2f", intent.Amount),
		Currency:      intent.Currency,
		Status:        intent.Status,
	})
}

// ListMine — GET /gift-cards/mine (codes the caller purchased).
func (h *Handler) ListMine(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	cards, err := h.Service.ListPurchased(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if cards == nil {
		cards = []PurchasedGiftCardResponse{}
	}
	response.OK(c, cards)
}

func (h *Handler) Issue(c *gin.Context) {
	var req CreateGiftCardsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cards, err := h.Service.Issue(c.Request.Context(), req.Amount, req.Count)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, cards)
}
