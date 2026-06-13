package mappers

import "github.com/tiredbooy/internal/models"

func ToOrderResponse(o *models.Order, items []models.OrderItemResponse) models.OrderResponse {
	return models.OrderResponse{
		ID:             o.ID,
		Status:         o.Status,
		PaymentMethod:  o.PaymentMethod,
		Subtotal:       o.Subtotal,
		DiscountAmount: o.DiscountAmount,
		ShippingCost:   o.ShippingCost,
		TaxAmount:      o.TaxAmount,
		TotalAmount:    o.TotalAmount,
		Notes:          o.Notes,
		PaidAt:         o.PaidAt,
		ShippedAt:      o.ShippedAt,
		DeliveredAt:    o.DeliveredAt,
		CancelledAt:    o.CancelledAt,
		CreatedAt:      o.CreatedAt,
		Items:          items,
	}
}

func ToOrderListItem(o *models.Order, itemCount int) models.OrderListItem {
	return models.OrderListItem{
		ID:            o.ID,
		Status:        o.Status,
		PaymentMethod: o.PaymentMethod,
		TotalAmount:   o.TotalAmount,
		ItemCount:     itemCount,
		CreatedAt:     o.CreatedAt,
	}
}
