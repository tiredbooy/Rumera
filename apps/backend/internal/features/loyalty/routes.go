package loyalty

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts loyalty account reads and redeem.
// moneyIdem (optional) protects POST /loyalty/redeem (PH-011c).
// Domain spend ref_id uses Idempotency-Key when present (PH-040b).
func RegisterCustomer(c *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/loyalty", h.GetAccount)
	c.GET("/loyalty/transactions", h.ListTransactions)
	if moneyIdem != nil {
		c.POST("/loyalty/redeem", moneyIdem, h.Redeem)
	} else {
		c.POST("/loyalty/redeem", h.Redeem)
	}
}

// RegisterAdmin mounts read-only programme rates for staff (PH-040d).
// Gated by customers:read (or write) at the routes composer.
func RegisterAdmin(admin *gin.RouterGroup, h *Handler) {
	if h == nil {
		return
	}
	admin.GET("/loyalty/programme", h.GetProgramme)
}
