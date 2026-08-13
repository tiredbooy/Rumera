package cart

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (cart requires auth).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts customer cart routes.
func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/cart", h.Get)
	c.DELETE("/cart", h.Clear)
	c.POST("/cart/items", h.AddItem)
	c.POST("/cart/items/bulk", h.AddItems)
	c.PATCH("/cart/items/:id", h.UpdateItem)
	c.DELETE("/cart/items/:id", h.RemoveItem)
}

// RegisterAdmin is a no-op (cart is customer-scoped).
func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
