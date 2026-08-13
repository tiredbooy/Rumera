package variant

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public variant read routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/variants/:id", h.GetVariant)
	v1.GET("/variants/:id/options", h.VariantOptions)
	v1.GET("/variants/:id/images", h.VariantImages)
}

// RegisterCustomer is a no-op.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts variant write routes (create hangs under products).
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.POST("/products/:id/variants", h.CreateVariant)
	a.PATCH("/variants/:id", h.UpdateVariant)
	a.DELETE("/variants/:id", h.DeleteVariant)
	a.POST("/variants/:id/options", h.AttachVariantOptions)
	a.PUT("/variants/:id/options", h.ReplaceVariantOptions)
}
