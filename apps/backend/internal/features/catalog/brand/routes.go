package brand

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public brand catalogue routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/brands", h.ListBrands)
	v1.GET("/brands/slug/:slug", h.GetBrandBySlug)
	v1.GET("/brands/:id", h.GetBrand)
}

// RegisterCustomer is a no-op (brand reads are public; writes are admin).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts brand admin CRUD.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.POST("/brands", h.CreateBrand)
	a.PATCH("/brands/:id", h.UpdateBrand)
	a.DELETE("/brands/:id", h.DeleteBrand)
}
