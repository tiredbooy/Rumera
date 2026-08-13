package hero

import "github.com/gin-gonic/gin"

// RegisterPublic mounts storefront hero carousel routes.
//
//	GET /hero-slides
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/hero-slides", h.ListPublic)
}

// RegisterCustomer is a no-op for hero slides.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts admin hero slide management.
//
//	GET    /admin/hero-slides
//	POST   /admin/hero-slides
//	PUT    /admin/hero-slides/order
//	GET    /admin/hero-slides/:id
//	PATCH  /admin/hero-slides/:id
//	DELETE /admin/hero-slides/:id
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/hero-slides", h.ListAdmin)
	a.POST("/hero-slides", h.Create)
	a.PUT("/hero-slides/order", h.Reorder)
	a.GET("/hero-slides/:id", h.Get)
	a.PATCH("/hero-slides/:id", h.Update)
	a.DELETE("/hero-slides/:id", h.Delete)
}
