package recommendations

import "github.com/gin-gonic/gin"

// RegisterPublic mounts guest-accessible recommendation carousels.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/recommendations/trending", h.Trending)
	v1.GET("/recommendations/products/:id/similar", h.Similar)
	v1.GET("/recommendations/products/:id/frequently-bought-together", h.FrequentlyBoughtTogether)
}

// RegisterCustomer mounts personalized recommendation + interaction routes.
func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/recommendations/for-you", h.ForYou)
	c.POST("/recommendations/interactions", h.RecordInteraction)
	c.GET("/recommendations/profile", h.GetProfile)
	c.POST("/recommendations/profile/recompute", h.RecomputeProfile)
}

// RegisterAdmin mounts recommendation observability.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/recommendations/stats", h.OpsStats)
}
