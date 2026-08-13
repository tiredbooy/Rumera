package product

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public product catalogue routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/products", h.ListProducts)
	v1.GET("/products/slug/:slug", h.GetProductBySlug)
	v1.GET("/products/:id", h.GetProduct)
	v1.GET("/products/:id/tags", h.ProductTags)
	v1.GET("/products/:id/images", h.ProductImages)
	v1.GET("/products/:id/variants", h.ProductVariants)
}

// RegisterCustomer is a no-op.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts product admin CRUD (PH-021a).
// read: list/detail; write: mutations; del: permanent delete (products:delete).
func RegisterAdmin(read, write, del *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	if read == nil {
		read = write
	}
	if write == nil {
		write = read
	}
	if del == nil {
		del = write
	}
	read.GET("/products", h.ListAdminProducts)
	read.GET("/products/:id", h.GetAdminProduct)
	write.POST("/products/aggregate", h.CreateProductAggregate)
	write.PUT("/products/:id/aggregate", h.UpdateProductAggregate)
	write.POST("/products", h.CreateProduct)
	write.PATCH("/products/:id", h.UpdateProduct)
	del.DELETE("/products/:id", h.DeleteProduct)
	write.POST("/products/:id/tags", h.AttachProductTags)
	write.PUT("/products/:id/tags", h.SyncProductTags)
	write.DELETE("/products/:id/tags", h.DetachProductTags)
}
