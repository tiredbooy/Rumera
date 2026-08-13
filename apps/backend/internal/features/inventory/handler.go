package inventory

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
)

// Handler is the HTTP surface for admin inventory.
type Handler struct {
	Inventory Service
	Validator *validator.Validator
}

// NewHandler constructs the inventory HTTP handler.
func NewHandler(svc Service, v *validator.Validator) *Handler {
	return &Handler{Inventory: svc, Validator: v}
}

// ListInventory — GET /admin/inventory
func (h *Handler) List(c *gin.Context) {
	var filter InventoryFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	if !inventorySortSupported(filter.SortBy) {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	filter.Defaults()

	items, total, err := h.Inventory.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]InventoryResponse, len(items))
	for i, inv := range items {
		out[i] = ToInventoryResponse(inv)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
}

// LowStockInventory — GET /admin/inventory/low-stock
func (h *Handler) LowStock(c *gin.Context) {
	items, err := h.Inventory.GetLowStock(c.Request.Context())
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]InventoryResponse, len(items))
	for i, inv := range items {
		out[i] = ToInventoryResponse(inv)
	}
	response.OK(c, out)
}

// GetVariantInventory — GET /admin/inventory/variants/:variantID
func (h *Handler) GetByVariant(c *gin.Context) {
	variantID, ok := httpx.ParamInt64(c, "variantID")
	if !ok {
		return
	}
	inv, err := h.Inventory.GetByVariantID(c.Request.Context(), variantID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToInventoryResponse(inv))
}

// AdjustVariantStock — POST /admin/inventory/variants/:variantID/adjust
func (h *Handler) Adjust(c *gin.Context) {
	variantID, ok := httpx.ParamInt64(c, "variantID")
	if !ok {
		return
	}
	var req AdjustStockReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Inventory.AdjustStock(c.Request.Context(), variantID, req, nil); err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.NoContent(c)
}

// UpdateVariantReorder — PATCH /admin/inventory/variants/:variantID/reorder
func (h *Handler) UpdateReorder(c *gin.Context) {
	variantID, ok := httpx.ParamInt64(c, "variantID")
	if !ok {
		return
	}
	var req UpdateReorderReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	inv, err := h.Inventory.UpdateReorder(c.Request.Context(), variantID, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, ToInventoryResponse(inv))
}

// ListInventoryMovements — GET /admin/inventory/movements
func (h *Handler) ListMovements(c *gin.Context) {
	var filter MovementFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	if filter.SortBy != "" && filter.SortBy != "created_at" {
		response.Error(c, response.ErrInvalidQuery)
		return
	}
	filter.Defaults()

	movements, total, err := h.Inventory.GetMovements(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]InventoryMovementResponse, len(movements))
	for i, m := range movements {
		out[i] = ToMovementResponse(m)
	}
	response.Paginated(c, out, httpx.Paginate(filter.Page, filter.Limit, total))
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
	variantID, ok := httpx.ParamInt64(c, "variantID")
	if !ok {
		return
	}
	movements, err := h.Inventory.GetMovementsByVariant(c.Request.Context(), variantID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]InventoryMovementResponse, len(movements))
	for i, m := range movements {
		out[i] = ToMovementResponse(m)
	}
	response.OK(c, out)
}
