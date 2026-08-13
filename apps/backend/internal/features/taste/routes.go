package taste

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/me/taste-profile", h.Get)
	c.PUT("/me/taste-profile", h.Save)
}

func RegisterAdmin(_ *gin.RouterGroup, _ *Handler) {}
