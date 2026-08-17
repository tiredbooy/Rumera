package loyalty

import "github.com/gin-gonic/gin"

func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts loyalty account reads and redeem.
// moneyIdem (optional) protects POST /loyalty/redeem (PH-011c).
// Domain spend ref_id is "{userID}:idem:{key}" and requires a client key (PR-003g).
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

// RegisterAdmin mounts programme snapshot + member search/ledger (PR-003d),
// signed grant/clawback (PR-003e), and persist programme rates (PR-003f).
//
//	GET  /admin/loyalty/programme
//	PUT  /admin/loyalty/programme
//	GET  /admin/loyalty/members[/:userID[/transactions]]
//	POST /admin/users/:userID/loyalty/adjust
//
// read is gated customers:read (or write) at the composer.
// write is customers:write — same capability as wallet credit. No loyalty:write.
func RegisterAdmin(read, write *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	if read != nil {
		read.GET("/loyalty/programme", h.GetProgramme)
		read.GET("/loyalty/members", h.ListMembers)
		read.GET("/loyalty/members/:userID", h.GetMember)
		read.GET("/loyalty/members/:userID/transactions", h.ListMemberTransactions)
	}
	if write == nil {
		return
	}
	write.PUT("/loyalty/programme", h.UpdateProgramme)
	if moneyIdem != nil {
		write.POST("/users/:userID/loyalty/adjust", moneyIdem, h.AdminAdjust)
	} else {
		write.POST("/users/:userID/loyalty/adjust", h.AdminAdjust)
	}
}
