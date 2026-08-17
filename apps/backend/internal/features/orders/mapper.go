package orders

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/features/addresses"
)

func ToOrderResponse(o *Order, items []OrderItemResponse) OrderResponse {
	addons := decodeGiftAddons(o.GiftAddons)
	shipTo := decodeShipTo(o.ShipTo)
	return OrderResponse{
		ID:             o.ID,
		Status:         o.Status,
		PaymentMethod:  o.PaymentMethod,
		PaymentID:      o.PaymentID,
		TransactionID:  o.TransactionID,
		PaymentURL:     o.PaymentURL,
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

		PaidAt:      o.PaidAt,
		ShippedAt:   o.ShippedAt,
		DeliveredAt: o.DeliveredAt,
		CancelledAt: o.CancelledAt,
		CreatedAt:   o.CreatedAt,
		Items:       items,

		TrackingNumber: o.TrackingNumber,
		ParcelCarrier:  o.ParcelCarrier,

		UserID:           o.UserID,
		AddressID:        o.AddressID,
		ShippingMethodID: o.ShippingMethodID,
		CouponID:         o.CouponID,
		CouponCode:       o.CouponCode,
		User:             orderUserIdentity(o),
		Address:          shipTo,
		ShipTo:           shipTo,
		ShippingMethod:   orderShippingMethod(o),
		Coupon:           orderCouponSummary(o),
		Payment:          orderPaymentSummary(o),
	}
}

func decodeShipTo(raw []byte) *ShipToSnapshot {
	if len(raw) == 0 {
		return nil
	}
	var snap ShipToSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		return nil
	}
	if snap.FullName == "" && snap.AddressLine1 == "" && snap.City == "" {
		return nil
	}
	return &snap
}

func encodeShipTo(address *addresses.Address) []byte {
	if address == nil {
		return nil
	}
	raw, err := json.Marshal(ShipToSnapshot{
		FullName:      address.FullName,
		PhoneNumber:   address.PhoneNumber,
		AddressLine1:  address.AddressLine1,
		AddressLine2:  address.AddressLine2,
		City:          address.City,
		StateProvince: address.StateProvince,
		PostalCode:    address.PostalCode,
		Country:       address.Country,
	})
	if err != nil {
		return nil
	}
	return raw
}

func orderUserIdentity(o *Order) *OrderUserIdentity {
	if o.UserID == 0 && o.Buyer.ID == 0 && o.Buyer.UserID == uuid.Nil && o.Buyer.Email == "" {
		return nil
	}
	id := o.Buyer.ID
	if id == 0 {
		id = o.UserID
	}
	return &OrderUserIdentity{
		ID:        id,
		UserID:    o.Buyer.UserID,
		FirstName: o.Buyer.FirstName,
		LastName:  o.Buyer.LastName,
		Email:     o.Buyer.Email,
		Phone:     o.Buyer.Phone,
	}
}

func orderShippingMethod(o *Order) *OrderShippingMethod {
	if o.ShippingMethodID == nil && o.ShippingMethodName == nil {
		return nil
	}
	sm := &OrderShippingMethod{Carrier: o.ShippingMethodCarrier}
	if o.ShippingMethodID != nil {
		sm.ID = *o.ShippingMethodID
	}
	if o.ShippingMethodName != nil {
		sm.Name = *o.ShippingMethodName
	}
	return sm
}

func orderCouponSummary(o *Order) *OrderCouponSummary {
	if o.CouponID == nil && o.CouponCode == nil {
		return nil
	}
	c := &OrderCouponSummary{}
	if o.CouponID != nil {
		c.ID = *o.CouponID
	}
	if o.CouponCode != nil {
		c.Code = *o.CouponCode
	}
	if c.ID == 0 && c.Code == "" {
		return nil
	}
	return c
}

func orderPaymentSummary(o *Order) *OrderPaymentSummary {
	if o.PaymentID == 0 && o.TransactionID == "" {
		return nil
	}
	return &OrderPaymentSummary{
		ID:            o.PaymentID,
		TransactionID: o.TransactionID,
		Status:        o.PaymentStatus,
		PaymentURL:    o.PaymentURL,
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
		ID:             o.ID,
		Status:         o.Status,
		PaymentMethod:  o.PaymentMethod,
		TotalAmount:    o.TotalAmount,
		ItemCount:      itemCount,
		CreatedAt:      o.CreatedAt,
		TrackingNumber: o.TrackingNumber,
		ParcelCarrier:  o.ParcelCarrier,
	}
}
