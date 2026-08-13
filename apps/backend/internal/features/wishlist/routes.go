package wishlist

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op — wishlist requires authentication.
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts wishlist routes on the authenticated customer group.
//
//	GET    /wishlist
//	DELETE /wishlist
//	POST   /wishlist/items
//	DELETE /wishlist/items/:id
//	GET    /wishlist/has/:variantID
func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/wishlist", h.Get)
	c.DELETE("/wishlist", h.Clear)
	c.POST("/wishlist/items", h.AddItem)
	c.DELETE("/wishlist/items/:id", h.RemoveItem)
	c.GET("/wishlist/has/:variantID", h.HasItem)
}

// RegisterAdmin is a no-op — no admin wishlist surface.
func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
