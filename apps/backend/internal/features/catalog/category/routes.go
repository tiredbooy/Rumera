package category

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public category catalogue routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/categories", h.ListCategories)
	v1.GET("/categories/featured", h.FeaturedCategories)
	v1.GET("/categories/tree", h.CategoryTree)
	v1.GET("/categories/slug/:slug", h.GetCategoryBySlug)
	v1.GET("/categories/:id", h.GetCategory)
	v1.GET("/categories/:id/children", h.CategoryChildren)
}

// RegisterCustomer is a no-op (category reads are public; writes are admin).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts category admin CRUD.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.POST("/categories", h.CreateCategory)
	a.PATCH("/categories/:id", h.UpdateCategory)
	a.DELETE("/categories/:id", h.DeleteCategory)
}
