package orders

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (orders require auth).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts customer order routes.
// moneyIdem (optional) is the PH-011c money-route idempotency middleware —
// applied to POST /orders and POST /orders/:id/pay. Cancel remains domain-guarded.
func RegisterCustomer(c *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	if moneyIdem != nil {
		c.POST("/orders", moneyIdem, h.CreateOrder)
		c.POST("/orders/:id/pay", moneyIdem, h.PayOrder)
	} else {
		c.POST("/orders", h.CreateOrder)
		c.POST("/orders/:id/pay", h.PayOrder)
	}
	c.GET("/orders", h.ListMyOrders)
	c.GET("/orders/:id", h.GetMyOrder)
	c.POST("/orders/:id/cancel", h.CancelOrder)
}

// RegisterAdmin mounts admin order routes.
// read: list/detail (orders:read or write or refund).
// write: warehouse PATCH status + POST refund (parent grants write∨refund).
// paid / cancelled / refunded are not PATCH targets — MarkAsPaid, Cancel, RefundOrder.
func RegisterAdmin(read, write *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	if read == nil {
		read = write
	}
	if write == nil {
		write = read
	}
	read.GET("/orders", h.ListOrders)
	read.GET("/orders/:id", h.GetOrder)
	write.PATCH("/orders/:id/status", h.UpdateOrderStatus)
	write.POST("/orders/:id/cancel", h.AdminCancelOrder)
	write.POST("/orders/:id/refund", h.RefundOrder)
}
