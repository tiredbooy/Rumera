package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// GetWallet returns the caller's wallet, creating it on first access.
//
// GET /wallet
func (h *Handler) GetWallet(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	wallet, err := h.Wallet.GetOrCreate(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToWalletResponse(wallet))
}

// DepositToWallet (public) was removed: self-service free credit is unsafe.
// Wallet credit now flows only through verified payments, refunds, gift-card/
// loyalty redemption, and AdminCreditWallet below.

// AdminCreditWallet — POST /admin/users/:userID/wallet/credit
// Ops-only top-up of a customer's wallet (gift, goodwill, manual settlement).
func (h *Handler) AdminCreditWallet(c *gin.Context) {
	userID, ok := h.paramUUID(c, "userID")
	if !ok {
		return
	}
	// Resolve internal numeric id from public UUID.
	target, err := h.User.GetByIDIncludingInactive(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	var req struct {
		Amount      float64 `json:"amount" validate:"required,gt=0"`
		Description string  `json:"description" validate:"omitempty,max=500"`
	}
	if !h.bindJSON(c, &req) {
		return
	}
	desc := req.Description
	if desc == "" {
		desc = "افزایش موجودی توسط مدیر"
	}
	tx, err := h.Wallet.Deposit(c.Request.Context(), target.ID, req.Amount, nil, &desc)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, mappers.ToWalletTransactionResponse(tx))
}

// WithdrawFromWallet is intentionally not registered. Kept as a 410 handler so
// any stale client that still POSTs /wallet/withdraw gets a clear signal.
func (h *Handler) WithdrawFromWallet(c *gin.Context) {
	response.Error(c, response.ErrGone)
}

// WalletTransactions — GET /wallet/transactions
func (h *Handler) WalletTransactions(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var filter models.WalletTransactionFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	txs, total, err := h.Wallet.GetTransactions(c.Request.Context(), userID, filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	out := make([]models.WalletTransactionResponse, len(txs))
	for i, t := range txs {
		out[i] = mappers.ToWalletTransactionResponse(t)
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}
