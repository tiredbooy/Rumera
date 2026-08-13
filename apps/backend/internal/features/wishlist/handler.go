package wishlist

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for the customer wishlist.
type Handler struct {
	Service   *Service
	Validator *validator.Validator
}

// NewHandler constructs the wishlist HTTP handler.
func NewHandler(svc *Service, v *validator.Validator) *Handler {
	return &Handler{Service: svc, Validator: v}
}

// Get — GET /wishlist
func (h *Handler) Get(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	list, err := h.Service.GetOrCreate(ctx, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	items, err := h.Service.GetItems(ctx, list.ID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToResponse(list, items))
}

// AddItem — POST /wishlist/items
func (h *Handler) AddItem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	var req AddItemReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()

	list, err := h.Service.GetOrCreate(ctx, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if err := h.Service.AddItem(ctx, list.ID, req); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, gin.H{"wishlist_id": list.ID})
}

// RemoveItem — DELETE /wishlist/items/:id
func (h *Handler) RemoveItem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	itemID, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	list, err := h.Service.GetOrCreate(ctx, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if err := h.Service.RemoveItem(ctx, list.ID, itemID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// Clear — DELETE /wishlist
func (h *Handler) Clear(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	list, err := h.Service.GetOrCreate(ctx, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	if err := h.Service.Clear(ctx, list.ID); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// HasItem — GET /wishlist/has/:variantID
func (h *Handler) HasItem(c *gin.Context) {
	userID, ok := httpx.UID(c)
	if !ok {
		return
	}
	variantID, ok := httpx.ParamInt64(c, "variantID")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	list, err := h.Service.GetOrCreate(ctx, userID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	has, err := h.Service.HasItem(ctx, list.ID, variantID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, gin.H{"has_item": has})
}
