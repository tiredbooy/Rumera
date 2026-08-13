package cart

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for the customer cart.
type Handler struct {
	Cart      *Service
	Validator *validator.Validator
}

// NewHandler constructs the cart HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Cart: svc, Validator: v}
}

// GetCart — GET /cart
func (h *Handler) Get(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	cart, err := h.Cart.Get(c.Request.Context(), userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, cart)
}

// AddCartItem — POST /cart/items
func (h *Handler) AddItem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req AddCartItemReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cart, err := h.Cart.AddItem(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, cart)
}

// AddCartItems — POST /cart/items/bulk
// Adds many variants at once (e.g. all of a recipe's ingredients). Returns the
// refreshed cart plus a list of variants that were skipped (unavailable/unknown).
func (h *Handler) AddItems(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req AddCartItemsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	result, err := h.Cart.AddItems(c.Request.Context(), userID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, result)
}

// UpdateCartItem — PATCH /cart/items/:id
func (h *Handler) UpdateItem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	itemID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateCartItemReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	cart, err := h.Cart.UpdateItem(c.Request.Context(), userID, itemID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, cart)
}

// RemoveCartItem — DELETE /cart/items/:id
func (h *Handler) RemoveItem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	itemID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	cart, err := h.Cart.RemoveItem(c.Request.Context(), userID, itemID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, cart)
}

// ClearCart — DELETE /cart
func (h *Handler) Clear(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	if err := h.Cart.Clear(c.Request.Context(), userID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
