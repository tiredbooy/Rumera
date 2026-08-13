package orders

import "encoding/json"

func ToOrderResponse(o *Order, items []OrderItemResponse) OrderResponse {
	addons := decodeGiftAddons(o.GiftAddons)
	return OrderResponse{
		ID:             o.ID,
		Status:         o.Status,
		PaymentMethod:  o.PaymentMethod,
		Subtotal:       o.Subtotal,
		DiscountAmount: o.DiscountAmount,
		ShippingCost:   o.ShippingCost,
		TaxAmount:      o.TaxAmount,
		TotalAmount:    o.TotalAmount,
		Notes:          o.Notes,

		IsGift:                o.IsGift,
		GiftMessage:           o.GiftMessage,
		GiftWrap:              o.GiftWrap,
		HidePrice:             o.HidePrice,
		GiftAddonsFee:         o.GiftAddonsFee,
		GiftAddons:            addons,
		ScheduledDeliveryDate: o.ScheduledDeliveryDate,

		PaidAt:         o.PaidAt,
		ShippedAt:      o.ShippedAt,
		DeliveredAt:    o.DeliveredAt,
		CancelledAt:    o.CancelledAt,
		CreatedAt:      o.CreatedAt,
		Items:          items,
	}
}

func decodeGiftAddons(raw []byte) []GiftAddonSnapshot {
	if len(raw) == 0 {
		return nil
	}
	var out []GiftAddonSnapshot
	if err := json.Unmarshal(raw, &out); err != nil || len(out) == 0 {
		return nil
	}
	return out
}

func ToOrderListItem(o *Order, itemCount int) OrderListItem {
	return OrderListItem{
		ID:            o.ID,
		Status:        o.Status,
		PaymentMethod: o.PaymentMethod,
		TotalAmount:   o.TotalAmount,
		ItemCount:     itemCount,
		CreatedAt:     o.CreatedAt,
	}
}
