package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// Payment transactions are created and transitioned by the order/gateway flow,
// so the HTTP surface is read-only and admin-scoped.

// ListPayments — GET /admin/payments
func (h *Handler) ListPayments(c *gin.Context) {
	var filter models.PaymentTransactionFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	txs, total, err := h.Payment.GetAll(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	out := make([]models.PaymentTransactionAdminResponse, len(txs))
	for i, t := range txs {
		out[i] = mappers.ToPaymentTransactionAdminResponse(t)
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

// GetPayment — GET /admin/payments/:id
func (h *Handler) GetPayment(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	tx, err := h.Payment.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToPaymentTransactionAdminResponse(tx))
}

// GetPaymentByTransactionID — GET /admin/payments/by-transaction/:txid
func (h *Handler) GetPaymentByTransactionID(c *gin.Context) {
	txid := c.Param("txid")
	if txid == "" {
		response.Error(c, response.ErrInvalidParams)
		return
	}
	tx, err := h.Payment.GetByTransactionID(c.Request.Context(), txid)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToPaymentTransactionAdminResponse(tx))
}
