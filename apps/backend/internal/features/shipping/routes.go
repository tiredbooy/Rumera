package shipping

import "github.com/gin-gonic/gin"

// RegisterPublic mounts public shipping catalogue and checkout quote routes.
func RegisterPublic(v1 *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	v1.GET("/shipping/zones", h.ListZones)
	v1.GET("/shipping/zones/:id", h.GetZone)
	v1.GET("/shipping/zones/:id/methods", h.ListZoneMethods)
	v1.GET("/shipping/methods/:id", h.GetMethod)
	v1.GET("/shipping/available", h.AvailableMethods)
}

// RegisterCustomer is a no-op (shipping reads are public; writes are admin).
func RegisterCustomer(_ *gin.RouterGroup, _ *Handler) {}

// RegisterAdmin mounts shipping zone/method admin CRUD.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.POST("/shipping/zones", h.CreateZone)
	a.PATCH("/shipping/zones/:id", h.UpdateZone)
	a.DELETE("/shipping/zones/:id", h.DeleteZone)
	a.POST("/shipping/zones/:id/methods", h.CreateMethod)
	a.PATCH("/shipping/methods/:id", h.UpdateMethod)
	a.DELETE("/shipping/methods/:id", h.DeleteMethod)
}
