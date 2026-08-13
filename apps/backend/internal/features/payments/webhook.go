package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/apperr"
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
// Layers of replay safety (PH-011):
//  1. HTTP idempotency middleware (body-hash auto-key) — see architecture/idempotency.md
//  2. UNIQUE payment_transactions.transaction_id (PH-011d)
//  3. Confirm/Fail only transition pending rows; already-terminal → 200 ACK
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
		// Confirm: payment succeeded + order paid + stock deduct (one TX).
		if _, err := h.Payments.Confirm(ctx, ConfirmPaymentReq{
			TransactionID: req.TransactionID,
			RawResponse:   raw,
		}); err != nil {
			if h.ackIfTerminal(c, ctx, req.TransactionID, err) {
				return
			}
			httpx.HandleError(c, err)
			return
		}

	case "failed":
		pt, err := h.Payments.Fail(ctx, FailPaymentReq{
			TransactionID: req.TransactionID,
			ErrorMessage:  req.ErrorMessage,
			RawResponse:   raw,
		})
		if err != nil {
			if h.ackIfTerminal(c, ctx, req.TransactionID, err) {
				return
			}
			httpx.HandleError(c, err)
			return
		}
		// Free the reservation so the stock is sellable again.
		if pt.OrderID != nil && h.Orders != nil && h.Inventory != nil {
			if items, err := h.Orders.GetOrderStockLines(ctx, *pt.OrderID); err == nil {
				_ = h.Inventory.ReleaseForOrder(ctx, *pt.OrderID, items)
			}
		}

	default:
		response.Error(c, response.ErrInvalidField)
		return
	}

	response.OK(c, gin.H{"received": true})
}

// ackIfTerminal returns true when err is "no pending row" but the gateway
// transaction_id already exists in a terminal status — gateway redelivery of an
// already-settled payment. Respond 200 so the gateway stops retrying without
// re-running side effects (Confirm/Fail are pending-only).
func (h *Handler) ackIfTerminal(c *gin.Context, ctx context.Context, transactionID string, err error) bool {
	if h.Payments == nil || !errors.Is(err, apperr.ErrNotFound) {
		return false
	}
	pt, gerr := h.Payments.GetByTransactionID(ctx, transactionID)
	if gerr != nil || pt == nil || !isTerminalPaymentStatus(pt.Status) {
		return false
	}
	response.OK(c, gin.H{"received": true, "replayed": true})
	return true
}

func isTerminalPaymentStatus(s PaymentStatus) bool {
	switch s {
	case PaymentStatusSucceeded, PaymentStatusFailed, PaymentStatusRefunded, PaymentStatusPartiallyRefunded:
		return true
	default:
		return false
	}
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
