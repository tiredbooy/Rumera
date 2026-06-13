package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// GetCart — GET /cart
func (h *Handler) GetCart(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	cart, err := h.Cart.Get(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, cart)
}

// AddCartItem — POST /cart/items
func (h *Handler) AddCartItem(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.AddCartItemReq
	if !h.bindJSON(c, &req) {
		return
	}
	cart, err := h.Cart.AddItem(c.Request.Context(), userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, cart)
}

// UpdateCartItem — PATCH /cart/items/:id
func (h *Handler) UpdateCartItem(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	itemID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	var req models.UpdateCartItemReq
	if !h.bindJSON(c, &req) {
		return
	}
	cart, err := h.Cart.UpdateItem(c.Request.Context(), userID, itemID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, cart)
}

// RemoveCartItem — DELETE /cart/items/:id
func (h *Handler) RemoveCartItem(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	itemID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	cart, err := h.Cart.RemoveItem(c.Request.Context(), userID, itemID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, cart)
}

// ClearCart — DELETE /cart
func (h *Handler) ClearCart(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	if err := h.Cart.Clear(c.Request.Context(), userID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}
