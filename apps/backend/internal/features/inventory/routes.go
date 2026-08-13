package inventory

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (inventory is admin-only).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer is a no-op (inventory is admin-only).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts inventory admin routes.
// read: list/detail/movements (inventory:read or write).
// write: adjust/reorder (inventory:write only). PH-021a split.
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
	read.GET("/inventory", h.List)
	read.GET("/inventory/low-stock", h.LowStock)
	read.GET("/inventory/movements", h.ListMovements)
	read.GET("/inventory/variants/:variantID", h.GetByVariant)
	read.GET("/inventory/variants/:variantID/movements", h.VariantMovements)
	write.POST("/inventory/variants/:variantID/adjust", h.Adjust)
	write.PATCH("/inventory/variants/:variantID/reorder", h.UpdateReorder)
}
