package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// paymentWebhookReq is the normalized gateway callback payload.
type paymentWebhookReq struct {
	TransactionID string `json:"transaction_id"`
	Status        string `json:"status"` // "succeeded" | "failed"
	ErrorMessage  string `json:"error_message"`
}

// PaymentWebhook receives asynchronous payment results from the gateway. It is
// unauthenticated (the gateway has no JWT) but every request is verified by an
// HMAC-SHA256 signature over the raw body using the shared webhook secret.
//
// On success it confirms the payment (marking the order paid) and deducts the
// reserved stock. On failure it records the failure and releases the reservation
// so the items return to sale.
//
// POST /webhooks/payment
//
// Header: X-Webhook-Signature: hex(hmac_sha256(rawBody, secret))
func (h *Handler) PaymentWebhook(c *gin.Context) {
	if h.WebhookSecret == "" {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}

	raw, err := c.GetRawData()
	if err != nil {
		response.Error(c, response.ErrInvalidBody)
		return
	}

	if !validSignature(raw, c.GetHeader("X-Webhook-Signature"), h.WebhookSecret) {
		response.Error(c, response.ErrUnauthorized)
		return
	}

	var req paymentWebhookReq
	if err := json.Unmarshal(raw, &req); err != nil || req.TransactionID == "" {
		response.Error(c, response.ErrInvalidJSON)
		return
	}

	ctx := c.Request.Context()

	switch req.Status {
	case "succeeded":
		pt, err := h.Payment.Confirm(ctx, models.ConfirmPaymentReq{
			TransactionID: req.TransactionID,
			RawResponse:   raw,
		})
		if err != nil {
			// A duplicate/late callback for an already-settled transaction is not
			// an error worth retrying — acknowledge it so the gateway stops.
			response.HandleError(c, err)
			return
		}
		// Payment + order are now marked paid; clear the committed stock.
		if pt.OrderID != nil {
			if items, err := h.Order.GetOrderItems(ctx, *pt.OrderID); err == nil {
				_ = h.Inventory.DeductForOrder(ctx, *pt.OrderID, items)
			}
		}

	case "failed":
		pt, err := h.Payment.Fail(ctx, models.FailPaymentReq{
			TransactionID: req.TransactionID,
			ErrorMessage:  req.ErrorMessage,
			RawResponse:   raw,
		})
		if err != nil {
			response.HandleError(c, err)
			return
		}
		// Free the reservation so the stock is sellable again.
		if pt.OrderID != nil {
			if items, err := h.Order.GetOrderItems(ctx, *pt.OrderID); err == nil {
				_ = h.Inventory.ReleaseForOrder(ctx, *pt.OrderID, items)
			}
		}

	default:
		response.Error(c, response.ErrInvalidField)
		return
	}

	response.OK(c, gin.H{"received": true})
}

// validSignature performs a constant-time comparison of the provided hex HMAC
// against one computed over the body with the shared secret.
func validSignature(body []byte, provided, secret string) bool {
	if provided == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(provided))
}
