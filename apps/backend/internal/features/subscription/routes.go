package subscription

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/subscriptions", h.List)
	c.POST("/subscriptions", h.Create)
	c.PATCH("/subscriptions/:id", h.Update)
}

func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
