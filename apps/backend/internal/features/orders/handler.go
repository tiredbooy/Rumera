package orders

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for customer and admin orders.
type Handler struct {
	Orders    Service
	Receipt   *ReceiptSender
	Validator *validator.Validator
}

// NewHandler constructs the orders HTTP handler.
func NewHandler(svc Service, receipt *ReceiptSender, v *validator.Validator) *Handler {
	return &Handler{Orders: svc, Receipt: receipt, Validator: v}
}

// eventsOwnReceipt reports whether the order.paid consumer sends the wallet
// checkout receipt, in which case this handler must not.
//
// Read off the service rather than injected as a flag so there is exactly one
// source of truth for "is the bus on" and the two can never disagree.
func (h *Handler) eventsOwnReceipt() bool {
	impl, ok := h.Orders.(*orderService)
	return ok && impl.eventsOwnSideEffects()
}

// CreateOrder places an order for the authenticated user.
//
// POST /orders
func (h *Handler) CreateOrder(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req CreateOrderReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()

	order, err := h.Orders.CreateOrder(ctx, userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	items, err := h.Orders.GetOrderItems(ctx, order.ID)
	if err != nil {
		httpx.HandleError(c, err)
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

	// Wallet checkout is already paid here. Non-wallet stays pending — receipt
	// waits for payments.Confirm (PR-020o).
	//
	// Skipped when the event bus is on: the wallet rail now emits order.paid.v1
	// inside the settle transaction and the receipt consumer sends from that, so
	// doing it here too would email the buyer twice.
	if order.Status == OrderStatusPaid && h.Receipt != nil && !h.eventsOwnReceipt() {
		_ = h.Receipt.SendPaidOrderReceipt(c.Request.Context(), order.UserID, order.ID, order.TotalAmount)
	}
	response.Created(c, ToOrderResponse(order, items))
}

// ListMyOrders — GET /orders
func (h *Handler) ListMyOrders(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var filter OrderFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	filter.UserID = &userID // never let a customer browse other users' orders
	// user_uuid is admin triage (CF-1). ANDing it with the owner clause above
	// already makes it useless here, but clearing it keeps that a property of this
	// handler rather than of predicate ordering.
	filter.UserUUID = ""

	orders, total, err := h.Orders.GetAllOrders(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, orders, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetMyOrder — GET /orders/:id
func (h *Handler) GetMyOrder(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	order, err := h.Orders.GetUserOrder(ctx, id, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	items, err := h.Orders.GetOrderItems(ctx, order.ID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToOrderResponse(order, items))
}

// PayOrder — POST /orders/:id/pay
func (h *Handler) PayOrder(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()
	order, err := h.Orders.PayOrder(ctx, id, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	items, err := h.Orders.GetOrderItems(ctx, order.ID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToOrderResponse(order, items))
}

// CancelOrder — POST /orders/:id/cancel
func (h *Handler) CancelOrder(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Orders.CancelOrder(c.Request.Context(), id, userID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// AdminCancelOrder — POST /admin/orders/:id/cancel
func (h *Handler) AdminCancelOrder(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Orders.AdminCancelOrder(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ── Admin ──────────────────────────────────────────────────────────────────

// ListOrders — GET /admin/orders
func (h *Handler) ListOrders(c *gin.Context) {
	var filter OrderFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	// orders.status is a Postgres enum, so an unknown literal would surface as a
	// 500. Reject it here as the 400 it actually is.
	if _, err := filter.ValidStatuses(); err != nil {
		httpx.HandleError(c, err)
		return
	}
	// CF-1: admin triage needs to see who bought what without opening each order.
	// Deliberately not bound from the query string — the customer-facing
	// ListMyOrders shares this filter and must never project a buyer block.
	filter = AdminListFilter(filter)

	orders, total, err := h.Orders.GetAllOrders(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, orders, httpx.Paginate(filter.Page, filter.Limit, total))
}

// GetOrder — GET /admin/orders/:id
func (h *Handler) GetOrder(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	order, err := h.Orders.GetOrder(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	items, err := h.Orders.GetOrderItems(ctx, order.ID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToOrderResponse(order, items))
}

// UpdateOrderStatus — PATCH /admin/orders/:id/status
func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateOrderStatusReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()
	order, err := h.Orders.UpdateOrderStatus(ctx, id, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	items, err := h.Orders.GetOrderItems(ctx, order.ID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToOrderListItem(order, len(items)))
}

// RefundOrder — POST /admin/orders/:id/refund
func (h *Handler) RefundOrder(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	order, err := h.Orders.RefundOrder(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToOrderListItem(order, 0))
}
