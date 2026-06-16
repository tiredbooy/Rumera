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

// DepositToWallet was removed: a public self-service deposit endpoint let any
// authenticated user credit their own spendable balance for free. Wallet credit
// now flows only through verified payments, refunds, gift-card/loyalty
// redemption and admin actions (which call WalletService.Deposit directly).

// WithdrawFromWallet — POST /wallet/withdraw
func (h *Handler) WithdrawFromWallet(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.WithdrawReq
	if !h.bindJSON(c, &req) {
		return
	}
	tx, err := h.Wallet.Withdraw(c.Request.Context(), userID, req.Amount, nil, req.Description)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, mappers.ToWalletTransactionResponse(tx))
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
