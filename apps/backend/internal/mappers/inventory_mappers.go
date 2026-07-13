// internal/mappers/inventory_mappers.go
package mappers

import "github.com/tiredbooy/internal/models"

func ToInventoryResponse(inv *models.Inventory) models.InventoryResponse {
	return models.InventoryResponse{
		ID:               inv.ID,
		ProductVariantID: inv.ProductVariantID,
		ProductID:        inv.ProductID,
		ProductTitle:     inv.ProductTitle,
		SKU:              inv.SKU,
		CategoryTitle:    inv.CategoryTitle,
		UnitPrice:        inv.UnitPrice,
		StockOnHand:      inv.StockOnHand,
		CommittedStock:   inv.CommittedStock,
		AvailableStock:   inv.StockOnHand - inv.CommittedStock,
		ReorderPoint:     inv.ReorderPoint,
		ReorderQuantity:  inv.ReorderQuantity,
		LastRestockAt:    inv.LastRestockAt,
		UpdatedAt:        inv.UpdatedAt,
	}
}

func ToMovementResponse(m *models.InventoryMovement) models.InventoryMovementResponse {
	return models.InventoryMovementResponse{
		ID:               m.ID,
		ProductVariantID: m.ProductVariantID,
		Quantity:         m.Quantity,
		Type:             m.Type,
		ReferenceOrderID: m.ReferenceOrderID,
		Note:             m.Note,
		CreatedAt:        m.CreatedAt,
	}
}
