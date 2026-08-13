package payments

import "github.com/gin-gonic/gin"

// RegisterPublic mounts the payment gateway webhook (signature-verified).
// webhookIdem is the PH-011 platform middleware (AllowAutoKey) for this route.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler, idempotency gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	if idempotency != nil {
		v1.POST("/webhooks/payment", idempotency, h.PaymentWebhook)
	} else {
		v1.POST("/webhooks/payment", h.PaymentWebhook)
	}
}

// RegisterCustomer is a no-op (payments admin + webhook only).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts read-only payment admin routes.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/payments", h.List)
	a.GET("/payments/by-transaction/:txid", h.GetByTransactionID)
	a.GET("/payments/:id", h.Get)
}
