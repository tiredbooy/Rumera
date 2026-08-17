package wallet

import (
	"context"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/features/users"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// TopUpGateway creates a pending gateway payment for wallet charge (PH-041a).
// Implemented by payments.Service; injected after both services exist.
type TopUpGateway interface {
	CreateWalletTopUp(ctx context.Context, userID int64, amount float64) (*TopUpIntentView, error)
}

// TopUpIntentView is the payment intent shape without importing payments types.
type TopUpIntentView struct {
	PaymentID     int64
	TransactionID string
	Amount        float64
	Currency      string
	Status        string
	PaymentURL    string
}

// Handler is the HTTP surface for customer wallet and admin credit.
type Handler struct {
	Service   *Service
	Users     *users.Service
	TopUpGW   TopUpGateway
	Validator *validator.Validator
}

// NewHandler constructs the wallet HTTP handler.
func NewHandler(svc *Service, usersSvc *users.Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Users: usersSvc, Validator: v}
}

// WithTopUp wires the gateway top-up starter (payments.Service).
func (h *Handler) WithTopUp(g TopUpGateway) *Handler {
	if h != nil {
		h.TopUpGW = g
	}
	return h
}

// Get — GET /wallet
func (h *Handler) Get(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	w, err := h.Service.GetOrCreate(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToResponse(w))
}

// WithdrawGone is intentionally not a real withdraw. Kept as 410 so stale
// clients that still POST /wallet/withdraw get a clear signal.
func (h *Handler) WithdrawGone(c *gin.Context) {
	response.Error(c, response.ErrGone)
}

// TopUp — POST /wallet/topup
// Creates a pending gateway payment; balance is credited only on webhook success.
func (h *Handler) TopUp(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	if h.TopUpGW == nil {
		response.Error(c, response.ErrServiceUnavailable)
		return
	}
	var req TopUpReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	intent, err := h.TopUpGW.CreateWalletTopUp(c.Request.Context(), userID, req.Amount)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, TopUpResponse{
		PaymentID:     intent.PaymentID,
		TransactionID: intent.TransactionID,
		Amount:        formatMoney(intent.Amount),
		Currency:      intent.Currency,
		Status:        intent.Status,
		PaymentURL:    intent.PaymentURL,
	})
}

func formatMoney(v float64) string {
	return fmt.Sprintf("%.2f", v)
}

// Transactions — GET /wallet/transactions
func (h *Handler) Transactions(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var filter TransactionFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	txs, total, err := h.Service.GetTransactions(c.Request.Context(), userID, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]TransactionResponse, len(txs))
	for i, t := range txs {
		out[i] = ToTransactionResponse(t)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// AdminTransactions — GET /admin/users/:userID/wallet/transactions
//
// A-10. The wallet rail settles inside the order transaction and writes no
// payment_transactions row on purpose (see payments/doc.go), so an operator
// investigating a wallet purchase found nothing: the admin payments board is
// empty for that order and the order detail carries no payment block. The debit
// has always been recorded here, keyed by reference_order_id — it simply had no
// admin read route. This is that route, and it is deliberately NOT a fabricated
// gateway record.
//
// Read-only, so it is gated on customers:read rather than the wallet:credit
// grant that mints money.
func (h *Handler) AdminTransactions(c *gin.Context) {
	userID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	if h.Users == nil {
		response.Error(c, response.ErrInternalError)
		return
	}
	target, err := h.Users.GetByIDIncludingInactive(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	var filter TransactionFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	txs, total, err := h.Service.GetTransactions(c.Request.Context(), target.ID, filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]TransactionResponse, len(txs))
	for i, t := range txs {
		out[i] = ToTransactionResponse(t)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// AdminCredit — POST /admin/users/:userID/wallet/credit
// Requires panel capability wallet:credit (group middleware) and records the
// acting admin UUID + client idempotency key on the ledger description.
func (h *Handler) AdminCredit(c *gin.Context) {
	userID, ok := httpx.ParamUUID(c, "userID")
	if !ok {
		return
	}
	actorID, ok := httpx.UserUUID(c)
	if !ok {
		return
	}
	if h.Users == nil {
		response.Error(c, response.ErrInternalError)
		return
	}
	target, err := h.Users.GetByIDIncludingInactive(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	var req AdminCreditReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	// Prefer explicit body key; allow Idempotency-Key header as fallback.
	if strings.TrimSpace(req.IdempotencyKey) == "" {
		req.IdempotencyKey = strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	}
	result, err := h.Service.AdminCredit(
		c.Request.Context(),
		actorID,
		target.ID,
		req.Amount,
		req.Description,
		req.IdempotencyKey,
	)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	payload := gin.H{
		"transaction":     ToTransactionResponse(&result.Transaction),
		"actor_user_id":   result.ActorUserID,
		"idempotency_key": result.IdempotencyKey,
		"replayed":        result.Replayed,
	}
	if result.Replayed {
		response.OK(c, payload)
		return
	}
	response.Created(c, payload)
}
