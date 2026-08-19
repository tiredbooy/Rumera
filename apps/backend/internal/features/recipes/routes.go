package recipes

import "github.com/gin-gonic/gin"

// RegisterPublic mounts storefront recipe routes.
// Static path segments (featured, sitemap) must register before :slug.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/recipes", h.List)
	v1.GET("/recipes/featured", h.Featured)
	v1.GET("/recipes/sitemap", h.Sitemap)
	v1.GET("/recipes/:slug", h.GetBySlug)
	v1.GET("/recipes/:slug/related", h.Related)
	// 404 path: resolves a slug retired by a rename to the current one.
	v1.GET("/recipes/:slug/redirect", h.SlugRedirect)
	// Cross-sell from product pages: recipes that use this product.
	v1.GET("/products/:id/recipes", h.ProductRecipes)
}

// RegisterCustomer is a no-op for recipes.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts admin recipe management (PH-021a read/write split).
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
	read.GET("/recipes", h.ListAdmin)
	read.GET("/recipes/:id", h.GetAdmin)
	write.POST("/recipes", h.Create)
	write.PATCH("/recipes/:id", h.Update)
	write.DELETE("/recipes/:id", h.Delete)
}
