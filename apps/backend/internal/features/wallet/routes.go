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

// AdminCreditCapability is the panel grant required to POST
// /admin/users/:userID/wallet/credit. Isolated from customers:write so the
// default staff seed cannot mint ledger money (PR-040c).
const AdminCreditCapability = "wallet:credit"

// RegisterAdmin mounts admin wallet credit on the /admin group.
//
//	POST /admin/users/:userID/wallet/credit
//
// Parent group must already apply Auth + wallet:credit (not customers:write).
// moneyIdem (optional) is the PH-011c HTTP platform. Service-level ledger
// marker (idem=<key>) remains the authoritative deposit truth.
// Two groups on purpose. Reading a customer's ledger is support work
// (customers:read); crediting mints ledger money and keeps its dedicated
// wallet:credit grant, so the default staff seed cannot mint by being able to
// look (PR-040c). One group for both would silently widen that.
func RegisterAdmin(read, a *gin.RouterGroup, h *Handler, moneyIdem gin.HandlerFunc) {
	if h == nil {
		h = &Handler{}
	}
	if read != nil {
		// A-10: a wallet-paid order writes no payment_transactions row, so this
		// ledger is the only admin trail it has.
		read.GET("/users/:userID/wallet/transactions", h.AdminTransactions)
	}
	if moneyIdem != nil {
		a.POST("/users/:userID/wallet/credit", moneyIdem, h.AdminCredit)
	} else {
		a.POST("/users/:userID/wallet/credit", h.AdminCredit)
	}
}
