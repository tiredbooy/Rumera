package addresses

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op — addresses require authentication.
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts customer address routes on the authenticated group.
//
//	POST   /addresses
//	GET    /addresses
//	GET    /addresses/:id
//	PATCH  /addresses/:id
//	DELETE /addresses/:id
//	POST   /addresses/:id/default
func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.POST("/addresses", h.Create)
	c.GET("/addresses", h.List)
	c.GET("/addresses/:id", h.Get)
	c.PATCH("/addresses/:id", h.Update)
	c.DELETE("/addresses/:id", h.Delete)
	c.POST("/addresses/:id/default", h.SetDefault)
}

// RegisterAdmin is a no-op — no admin address management surface today.
func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
