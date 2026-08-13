package orders

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (orders require auth).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts customer order routes.
// moneyIdem (optional) is the PH-011c money-route idempotency middleware —
// applied only to POST /orders (place intent). Cancel remains domain-guarded.
func RegisterCustomer(c *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	if moneyIdem != nil {
		c.POST("/orders", moneyIdem, h.CreateOrder)
	} else {
		c.POST("/orders", h.CreateOrder)
	}
	c.GET("/orders", h.ListMyOrders)
	c.GET("/orders/:id", h.GetMyOrder)
	c.POST("/orders/:id/cancel", h.CancelOrder)
}

// RegisterAdmin mounts admin order routes.
// read: list/detail; write: status transitions (orders:write or refund). PH-021a.
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
}
