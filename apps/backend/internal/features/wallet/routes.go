package wallet

import "github.com/gin-gonic/gin"

// RegisterPublic is a no-op — wallet requires authentication.
func RegisterPublic(_ *gin.RouterGroup, _ *Handler) {}

// RegisterCustomer mounts customer wallet routes on the authenticated group.
//
//	GET  /wallet
//	GET  /wallet/transactions
//	POST /wallet/topup     → gateway top-up intent (moneyIdem; PH-041a)
//	POST /wallet/withdraw  → 410 Gone (self-service withdraw removed)
//
// moneyIdem (optional) protects POST /wallet/topup (PH-011).
func RegisterCustomer(c *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	c.GET("/wallet", h.Get)
	c.GET("/wallet/transactions", h.Transactions)
	if moneyIdem != nil {
		c.POST("/wallet/topup", moneyIdem, h.TopUp)
	} else {
		c.POST("/wallet/topup", h.TopUp)
	}
	c.POST("/wallet/withdraw", h.WithdrawGone)
}

// RegisterAdmin mounts admin wallet credit on the /admin group.
//
//	POST /admin/users/:userID/wallet/credit
//
// moneyIdem (optional) is the PH-011c HTTP platform. Service-level ledger
// marker (idem=<key>) remains the authoritative deposit truth.
func RegisterAdmin(a *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	if moneyIdem != nil {
		a.POST("/users/:userID/wallet/credit", moneyIdem, h.AdminCredit)
	} else {
		a.POST("/users/:userID/wallet/credit", h.AdminCredit)
	}
}
