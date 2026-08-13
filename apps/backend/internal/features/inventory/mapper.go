// internal/mappers/inventory_mappers.go
package inventory

func ToInventoryResponse(inv *Inventory) InventoryResponse {
	// missing_weight: null or non-positive catalogue weight (shipping needs kg).
	missing := inv.WeightKg == nil || *inv.WeightKg <= 0
	var weight *float64
	if inv.WeightKg != nil && *inv.WeightKg > 0 {
		weight = inv.WeightKg
	}
	return InventoryResponse{
		ID:               inv.ID,
		ProductVariantID: inv.ProductVariantID,
		ProductID:        inv.ProductID,
		ProductTitle:     inv.ProductTitle,
		SKU:              inv.SKU,
		CategoryTitle:    inv.CategoryTitle,
		UnitPrice:        inv.UnitPrice,
		Weight:           weight,
		MissingWeight:    missing,
		StockOnHand:      inv.StockOnHand,
		CommittedStock:   inv.CommittedStock,
		AvailableStock:   inv.StockOnHand - inv.CommittedStock,
		ReorderPoint:     inv.ReorderPoint,
		ReorderQuantity:  inv.ReorderQuantity,
		LastRestockAt:    inv.LastRestockAt,
		UpdatedAt:        inv.UpdatedAt,
	}
}

func ToMovementResponse(m *InventoryMovement) InventoryMovementResponse {
	return InventoryMovementResponse{
		ID:               m.ID,
		ProductVariantID: m.ProductVariantID,
		Quantity:         m.Quantity,
		Type:             m.Type,
		ReferenceOrderID: m.ReferenceOrderID,
		Note:             m.Note,
		CreatedAt:        m.CreatedAt,
	}
}
