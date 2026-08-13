package alerts

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/alerts", h.List)
	c.POST("/alerts", h.Create)
	c.DELETE("/alerts/:id", h.Delete)
}

func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
