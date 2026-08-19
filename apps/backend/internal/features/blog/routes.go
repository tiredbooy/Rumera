package blog

import "github.com/gin-gonic/gin"

// RegisterPublic mounts storefront journal routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/blogs", h.ListPublic)
	v1.GET("/blogs/:slug", h.GetBySlug)
	// 404 path: resolves a slug retired by a rename to the current one.
	v1.GET("/blogs/:slug/redirect", h.SlugRedirect)
	v1.GET("/blog-categories", h.ListCategories)
	v1.GET("/blog-categories/:id", h.GetCategory)
}

// RegisterCustomer is a no-op for blog.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts admin journal management (PH-021a read/write split).
func RegisterAdmin(read, write *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	if read == nil {
		read = write
	}
	if write == nil {
		write = read
	}
	read.GET("/blogs", h.ListAdmin)
	read.GET("/blogs/:id", h.GetAdmin)
	write.POST("/blogs", h.Create)
	write.PATCH("/blogs/:id", h.Update)
	write.DELETE("/blogs/:id", h.Delete)

	read.GET("/blog-categories", h.ListCategories)
	read.GET("/blog-categories/:id", h.GetCategory)
	write.POST("/blog-categories", h.CreateCategory)
	write.PATCH("/blog-categories/:id", h.UpdateCategory)
	write.DELETE("/blog-categories/:id", h.DeleteCategory)
}
