package coupons

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op (coupons need auth to validate).
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts checkout coupon validation.
func RegisterCustomer(c *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	c.POST("/coupons/validate", h.Validate)
}

// RegisterAdmin mounts coupon admin CRUD.
func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.POST("/coupons", h.Create)
	a.GET("/coupons", h.List)
	a.GET("/coupons/:id", h.Get)
	a.PATCH("/coupons/:id", h.Update)
	a.DELETE("/coupons/:id", h.Delete)
}
