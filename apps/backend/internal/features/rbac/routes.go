package rbac

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op: capabilities are admin-only.
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer is a no-op: capabilities are admin-only.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts capability administration routes on the admin group.
// The group is expected to already apply Auth + panel-role guards.
//
//	GET  /admin/capabilities          — any panel role (live grant resolution)
//	PUT  /admin/capabilities/:role    — requires roles:manage (handler-enforced)
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	// Nil handler still registers paths so route smoke tests and partial
	// composition graphs can mount the tree; runtime calls NPE only if hit.
	if h == nil {
		h = &Handler{}
	}
	a.GET("/capabilities", h.ListCapabilities)
	a.PUT("/capabilities/:role", h.ReplaceCapabilities)
}
