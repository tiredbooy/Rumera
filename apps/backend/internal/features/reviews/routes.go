package reviews

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public review routes (product listings + single approved).
// Note: product review paths share the /products/:id prefix with catalog; order
// relative to other product routes is preserved from legacy registration.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/products/:id/reviews", h.ProductReviews)
	v1.GET("/products/:id/reviews/summary", h.ProductRatingSummary)
	v1.GET("/reviews/:id", h.Get)
}

// RegisterCustomer mounts authenticated customer review routes.
func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/reviews/mine", h.MyReviews)
	c.GET("/reviews/pending", h.PendingReviews)
	c.POST("/reviews", h.Create)
	c.PATCH("/reviews/:id", h.Update)
	c.DELETE("/reviews/:id", h.Delete)
	c.POST("/reviews/:id/react", h.React)
	c.GET("/reviews/:id/images", h.Images)
	c.POST("/reviews/:id/images", h.AddImage)
}

// RegisterAdmin mounts admin moderation routes (PH-021a read/write split).
// read: list; write: status moderate.
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
	read.GET("/reviews", h.ListAdmin)
	write.PATCH("/reviews/:id/status", h.UpdateStatus)
}
