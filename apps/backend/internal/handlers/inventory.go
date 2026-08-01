package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/mappers"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/response"
)

// ListInventory — GET /admin/inventory
func (h *Handler) ListInventory(c *gin.Context) {
	var filter models.InventoryFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	if !inventorySortSupported(filter.SortBy) {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	filter.Defaults()

	items, total, err := h.Inventory.GetAll(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	out := make([]models.InventoryResponse, len(items))
	for i, inv := range items {
		out[i] = mappers.ToInventoryResponse(inv)
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

// LowStockInventory — GET /admin/inventory/low-stock
func (h *Handler) LowStockInventory(c *gin.Context) {
	items, err := h.Inventory.GetLowStock(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}
	out := make([]models.InventoryResponse, len(items))
	for i, inv := range items {
		out[i] = mappers.ToInventoryResponse(inv)
	}
	response.OK(c, out)
}

// GetVariantInventory — GET /admin/inventory/variants/:variantID
func (h *Handler) GetVariantInventory(c *gin.Context) {
	variantID, ok := h.paramInt64(c, "variantID")
	if !ok {
		return
	}
	inv, err := h.Inventory.GetByVariantID(c.Request.Context(), variantID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToInventoryResponse(inv))
}

// AdjustVariantStock — POST /admin/inventory/variants/:variantID/adjust
func (h *Handler) AdjustVariantStock(c *gin.Context) {
	variantID, ok := h.paramInt64(c, "variantID")
	if !ok {
		return
	}
	var req models.AdjustStockReq
	if !h.bindJSON(c, &req) {
		return
	}
	if err := h.Inventory.AdjustStock(c.Request.Context(), variantID, req, nil); err != nil {
		h.handleError(c, err)
		return
	}
	response.NoContent(c)
}

// UpdateVariantReorder — PATCH /admin/inventory/variants/:variantID/reorder
func (h *Handler) UpdateVariantReorder(c *gin.Context) {
	variantID, ok := h.paramInt64(c, "variantID")
	if !ok {
		return
	}
	var req models.UpdateReorderReq
	if !h.bindJSON(c, &req) {
		return
	}
	inv, err := h.Inventory.UpdateReorder(c.Request.Context(), variantID, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	response.OK(c, mappers.ToInventoryResponse(inv))
}

// ListInventoryMovements — GET /admin/inventory/movements
func (h *Handler) ListInventoryMovements(c *gin.Context) {
	var filter models.MovementFilter
	if !h.bindQuery(c, &filter) {
		return
	}
	if filter.SortBy != "" && filter.SortBy != "created_at" {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	filter.Defaults()

	movements, total, err := h.Inventory.GetMovements(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	out := make([]models.InventoryMovementResponse, len(movements))
	for i, m := range movements {
		out[i] = mappers.ToMovementResponse(m)
	}
	response.Paginated(c, out, paginate(filter.Page, filter.Limit, total))
}

func inventorySortSupported(sortBy string) bool {
	switch sortBy {
	case "", "id", "updated_at", "stock_on_hand", "available_stock", "reorder_point", "product_title", "sku":
		return true
	default:
		return false
	}
}

// VariantMovements — GET /admin/inventory/variants/:variantID/movements
func (h *Handler) VariantMovements(c *gin.Context) {
	variantID, ok := h.paramInt64(c, "variantID")
	if !ok {
		return
	}
	movements, err := h.Inventory.GetMovementsByVariant(c.Request.Context(), variantID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	out := make([]models.InventoryMovementResponse, len(movements))
	for i, m := range movements {
		out[i] = mappers.ToMovementResponse(m)
	}
	response.OK(c, out)
}
