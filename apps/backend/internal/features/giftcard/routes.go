package giftcard

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts redeem, purchase (PH-042a), and list purchased codes.
// moneyIdem protects redeem + purchase money mutations.
func RegisterCustomer(c *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/gift-cards/mine", h.ListMine)
	if moneyIdem != nil {
		c.POST("/gift-cards/redeem", moneyIdem, h.Redeem)
		c.POST("/gift-cards/purchase", moneyIdem, h.Purchase)
	} else {
		c.POST("/gift-cards/redeem", h.Redeem)
		c.POST("/gift-cards/purchase", h.Purchase)
	}
}

func RegisterAdmin(a *gin.RouterGroup, h *Handler) {
	if h == nil {
		h = &Handler{}
	}
	a.GET("/gift-cards", h.ListAdmin)
	a.POST("/gift-cards", h.Issue)
	a.POST("/gift-cards/:id/void", h.Void)
}
