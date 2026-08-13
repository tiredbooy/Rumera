package site_settings

import "github.com/gin-gonic/gin"

// RegisterPublic mounts storefront settings on the public API group.
//
//	GET /settings
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/settings", h.GetPublic)
}

// RegisterCustomer is a no-op — settings are public or admin.
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts admin settings editor routes.
//
//	GET /admin/settings
//	PUT /admin/settings
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/settings", h.GetAdmin)
	a.PUT("/settings", h.Update)
}
