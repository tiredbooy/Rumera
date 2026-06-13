package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// GetWishlist returns the caller's wishlist with all items.
//
// GET /wishlist
func (h *Handler) GetWishlist(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	wishlist, err := h.Wishlist.GetOrCreate(ctx, userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	items, err := h.Wishlist.GetItems(ctx, wishlist.ID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, mappers.ToWishlistResponse(wishlist, items))
}

// AddWishlistItem — POST /wishlist/items
func (h *Handler) AddWishlistItem(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	var req models.AddWishlistItemReq
	if !h.bindJSON(c, &req) {
		return
	}
	ctx := c.Request.Context()

	wishlist, err := h.Wishlist.GetOrCreate(ctx, userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	if err := h.Wishlist.AddItem(ctx, wishlist.ID, req); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, gin.H{"wishlist_id": wishlist.ID})
}

// RemoveWishlistItem — DELETE /wishlist/items/:id
func (h *Handler) RemoveWishlistItem(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	itemID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	wishlist, err := h.Wishlist.GetOrCreate(ctx, userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	if err := h.Wishlist.RemoveItem(ctx, wishlist.ID, itemID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// ClearWishlist — DELETE /wishlist
func (h *Handler) ClearWishlist(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	wishlist, err := h.Wishlist.GetOrCreate(ctx, userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	if err := h.Wishlist.Clear(ctx, wishlist.ID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// HasWishlistItem — GET /wishlist/has/:variantID
func (h *Handler) HasWishlistItem(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		return
	}
	variantID, ok := h.paramInt64(c, "variantID")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	wishlist, err := h.Wishlist.GetOrCreate(ctx, userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	has, err := h.Wishlist.HasItem(ctx, wishlist.ID, variantID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.OK(c, gin.H{"has_item": has})
}
