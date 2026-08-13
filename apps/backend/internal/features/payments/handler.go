package payments

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// OrderItemsLookup loads order line items for webhook stock release.
type OrderItemsLookup interface {
	GetOrderStockLines(ctx context.Context, orderID int64) ([]inventory.StockLine, error)
}

// StockReleaser frees reserved stock when a payment fails (webhook path).
// Implemented by inventory.Service; narrowed for pure unit tests (PH-013c).
type StockReleaser interface {
	ReleaseForOrder(ctx context.Context, orderID int64, items []inventory.StockLine) error
}

// Handler is the HTTP surface for admin payment reads and gateway webhooks.
type Handler struct {
	Payments      *Service
	Orders        OrderItemsLookup
	Inventory     StockReleaser
	WebhookSecret string
	Validator     *validator.Validator
}

// NewHandler constructs the payments HTTP handler.
func NewHandler(svc *Service, orders OrderItemsLookup, inv StockReleaser, webhookSecret string, v *validator.Validator) *Handler {
	return &Handler{Payments: svc, Orders: orders, Inventory: inv, WebhookSecret: webhookSecret, Validator: v}
}

// Payment transactions are created and transitioned by the order/gateway flow,
// so the HTTP surface is read-only and admin-scoped.

// ListPayments — GET /admin/payments
func (h *Handler) List(c *gin.Context) {
	var filter PaymentTransactionFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()

	txs, total, err := h.Payments.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]PaymentTransactionAdminResponse, len(txs))
	for i, t := range txs {
		out[i] = ToPaymentTransactionAdminResponse(t)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetPayment — GET /admin/payments/:id
func (h *Handler) Get(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	tx, err := h.Payments.GetByID(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToPaymentTransactionAdminResponse(tx))
}

// GetPaymentByTransactionID — GET /admin/payments/by-transaction/:txid
func (h *Handler) GetByTransactionID(c *gin.Context) {
	txid := c.Param("txid")
	if txid == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	tx, err := h.Payments.GetByTransactionID(c.Request.Context(), txid)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToPaymentTransactionAdminResponse(tx))
}
