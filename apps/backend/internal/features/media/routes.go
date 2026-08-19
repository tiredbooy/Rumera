package media

import "github.com/gin-gonic/gin"

// RegisterPublic mounts the on-the-fly transform endpoint outside /api/v1.
// Call with the engine root (or any group) that should host GET /media/*key.
func RegisterPublicRoot(r gin.IRoutes, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	r.GET("/media/*key", h.ServeMedia)
}

// RegisterPublic is a no-op under /api/v1 (transform lives at /media/*key).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer is a no-op (media admin + public transform only).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts product image management and standalone uploads.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/products/:id/images", h.ListProductImages)
	a.POST("/products/:id/images", h.UploadProductImage)
	a.POST("/products/:id/images/url", h.AddProductImageURL)
	a.PUT("/products/:id/images/order", h.ReorderProductImages)
	a.PATCH("/products/:id/images/:imageId", h.UpdateProductImage)
	a.PUT("/products/:id/images/:imageId/primary", h.SetPrimaryProductImage)
	a.DELETE("/products/:id/images/:imageId", h.DeleteProductImage)

	a.GET("/uploads", h.ListLibrary)
	a.POST("/uploads", h.UploadImage)
	a.POST("/uploads/release", h.ReleaseStandaloneUpload)
	a.POST("/uploads/:ownerType/:ownerID/:role", h.UploadOwnerImage)
}
