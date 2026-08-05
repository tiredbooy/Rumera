package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// CreateOrder places an order for the authenticated user.
//
// POST /orders
func (h *Handler) CreateOrder(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.CreateOrderReq
	if !h.bindJSON(c, &req) {
		return
	}
	ctx := c.Request.Context()

	order, err := h.Order.CreateOrder(ctx, userID, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	items, err := h.Order.GetOrderItems(ctx, order.ID)
	if err != nil {
		h.handleError(c, err)
		return
	}

	// Enrich the analytics order_created event with per-line catalog product IDs
	// so revenue/product aggregates can join against the products table.
	if len(items) > 0 {
		lineItems := make([]map[string]any, 0, len(items))
		for _, item := range items {
			if item.ProductID <= 0 {
				continue
			}
			amount := item.UnitPrice * float64(item.Quantity)
			lineItems = append(lineItems, map[string]any{
				"product_id": item.ProductID,
				"quantity":   item.Quantity,
				"amount":     amount,
			})
		}
		if len(lineItems) > 0 {
			c.Set(middlewares.AnalyticsPayloadKey, map[string]any{
				"order_id": order.ID,
				"items":    lineItems,
				// First line product_id keeps legacy single-key consumers working.
				"product_id": lineItems[0]["product_id"],
				"quantity":   lineItems[0]["quantity"],
				"amount":     lineItems[0]["amount"],
			})
		}
	}

	h.sendOrderConfirmation(c, order)
	response.Created(c, mappers.ToOrderResponse(order, items))
}

// sendOrderConfirmation emails the buyer a receipt, off the request path. It
// resolves the address from the authenticated UUID and never blocks or fails
// the response. Uses the notification dispatcher when configured (async outbox).
func (h *Handler) sendOrderConfirmation(c *gin.Context, order *models.Order) {
	if h.Notifications == nil && h.Notify == nil {
		return
	}
	uid, ok := middlewares.UserUUID(c)
	if !ok {
		return
	}
	user, err := h.User.GetByID(c.Request.Context(), uid)
	if err != nil {
		return
	}
	email := user.Email
	body := fmt.Sprintf(
		`<p>Thanks for your order!</p>`+
			`<p>Order <strong>#%d</strong> has been received and is now being processed.</p>`+
			`<p>Total: <strong>%.2f</strong></p>`,
		order.ID, order.TotalAmount,
	)
	subject := "Your order confirmation"
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if h.Notifications != nil {
			_ = h.Notifications.DispatchOrderConfirmed(ctx, email, subject, body, order.ID, "")
			return
		}
		_ = h.Notify.Send(ctx, email, subject, body)
	}()
}

// ListMyOrders — GET /orders
func (h *Handler) ListMyOrders(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var filter models.OrderFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()
	filter.UserID = &userID // never let a customer browse other users' orders

	orders, total, err := h.Order.GetAllOrders(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, orders, paginate(filter.Page, filter.Limit, total))
}

// GetMyOrder — GET /orders/:id
func (h *Handler) GetMyOrder(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	order, err := h.Order.GetUserOrder(ctx, id, userID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	items, err := h.Order.GetOrderItems(ctx, order.ID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToOrderResponse(order, items))
}

// CancelOrder — POST /orders/:id/cancel
func (h *Handler) CancelOrder(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Order.CancelOrder(c.Request.Context(), id, userID); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Admin ──────────────────────────────────────────────────────────────────

// ListOrders — GET /admin/orders
func (h *Handler) ListOrders(c *gin.Context) {
	var filter models.OrderFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	filter.Defaults()

	orders, total, err := h.Order.GetAllOrders(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.Paginated(c, orders, paginate(filter.Page, filter.Limit, total))
}

// GetOrder — GET /admin/orders/:id
func (h *Handler) GetOrder(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	order, err := h.Order.GetOrder(ctx, id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	items, err := h.Order.GetOrderItems(ctx, order.ID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToOrderResponse(order, items))
}

// UpdateOrderStatus — PATCH /admin/orders/:id/status
func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	id, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateOrderStatusReq
	if !h.bindJSON(c, &req) {
		return
	}
	order, err := h.Order.UpdateOrderStatus(c.Request.Context(), id, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToOrderListItem(order, 0))
}
