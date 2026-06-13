// internal/models/order.go
package models

import "time"

type OrderStatus string
type PaymentMethod string

const (
	OrderStatusPending           OrderStatus = "pending"
	OrderStatusPaymentFailed     OrderStatus = "payment_failed"
	OrderStatusPaid              OrderStatus = "paid"
	OrderStatusProcessing        OrderStatus = "processing"
	OrderStatusReadyToShip       OrderStatus = "ready_to_ship"
	OrderStatusShipped           OrderStatus = "shipped"
	OrderStatusOutForDelivery    OrderStatus = "out_for_delivery"
	OrderStatusDelivered         OrderStatus = "delivered"
	OrderStatusRefundRequested   OrderStatus = "refund_requested"
	OrderStatusRefundApproved    OrderStatus = "refund_approved"
	OrderStatusRefunded          OrderStatus = "refunded"
	OrderStatusPartiallyRefunded OrderStatus = "partially_refunded"
	OrderStatusCancelled         OrderStatus = "cancelled"
)

const (
	PaymentMethodCard         PaymentMethod = "card"
	PaymentMethodCrypto       PaymentMethod = "crypto"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodWallet       PaymentMethod = "wallet"
	PaymentMethodGateway      PaymentMethod = "gateway"
)

type Order struct {
	ID               int64         `db:"id"`
	UserID           int64         `db:"user_id"`
	AddressID        *int64        `db:"address_id"`
	Status           OrderStatus   `db:"status"`
	PaymentMethod    PaymentMethod `db:"payment_method"`
	Subtotal         float64       `db:"subtotal"`
	DiscountAmount   float64       `db:"discount_amount"`
	ShippingCost     float64       `db:"shipping_cost"`
	TaxAmount        float64       `db:"tax_amount"`
	TotalAmount      float64       `db:"total_amount"`
	CouponID         *int64        `db:"coupon_id"`
	ShippingMethodID *int64        `db:"shipping_method_id"`
	Notes            *string       `db:"notes"`
	PaidAt           *time.Time    `db:"paid_at"`
	ShippedAt        *time.Time    `db:"shipped_at"`
	DeliveredAt      *time.Time    `db:"delivered_at"`
	CancelledAt      *time.Time    `db:"cancelled_at"`
	CreatedAt        time.Time     `db:"created_at"`
	UpdatedAt        time.Time     `db:"updated_at"`
}

type OrderItem struct {
	ID               int64     `db:"id"`
	OrderID          int64     `db:"order_id"`
	ProductID        int64     `db:"product_id"`
	ProductVariantID int64     `db:"product_variant_id"` // ← add this
	Quantity         int       `db:"quantity"`
	UnitPrice        float64   `db:"unit_price"`
	TotalPrice       float64   `db:"total_price"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
}

type CreateOrderReq struct {
	AddressID        int64         `json:"address_id"         validate:"required,min=1"`
	PaymentMethod    PaymentMethod `json:"payment_method"     validate:"required,oneof=card crypto bank_transfer wallet gateway"`
	ShippingMethodID int64         `json:"shipping_method_id" validate:"required,min=1"`
	CouponCode       *string       `json:"coupon_code"`
	Notes            *string       `json:"notes"`
}

type UpdateOrderStatusReq struct {
	Status OrderStatus `json:"status" validate:"required,oneof=pending payment_failed paid processing ready_to_ship shipped out_for_delivery delivered refund_requested refund_approved refunded partially_refunded cancelled"`
}

type OrderFilter struct {
	BaseFilter
	UserID   *int64       `query:"user_id"`
	Status   *OrderStatus `query:"status"`
	PaidFrom *time.Time   `query:"paid_from"`
	PaidTo   *time.Time   `query:"paid_to"`
}

func (f *OrderFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

// internal/models/order.go
type OrderItemResponse struct {
	ID           int64   `json:"id"`
	ProductID    int64   `json:"product_id"`
	VariantID    int64   `json:"variant_id"` // ← add this
	ProductTitle string  `json:"product_title"`
	ImageURL     *string `json:"image_url,omitempty"`
	Quantity     int     `json:"quantity"`
	UnitPrice    float64 `json:"unit_price"`
	TotalPrice   float64 `json:"total_price"`
}
type OrderResponse struct {
	ID             int64               `json:"id"`
	Status         OrderStatus         `json:"status"`
	PaymentMethod  PaymentMethod       `json:"payment_method"`
	Subtotal       float64             `json:"subtotal"`
	DiscountAmount float64             `json:"discount_amount"`
	ShippingCost   float64             `json:"shipping_cost"`
	TaxAmount      float64             `json:"tax_amount"`
	TotalAmount    float64             `json:"total_amount"`
	Notes          *string             `json:"notes,omitempty"`
	PaidAt         *time.Time          `json:"paid_at,omitempty"`
	ShippedAt      *time.Time          `json:"shipped_at,omitempty"`
	DeliveredAt    *time.Time          `json:"delivered_at,omitempty"`
	CancelledAt    *time.Time          `json:"cancelled_at,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	Items          []OrderItemResponse `json:"items"`
}

type OrderListItem struct {
	ID            int64         `json:"id"`
	Status        OrderStatus   `json:"status"`
	PaymentMethod PaymentMethod `json:"payment_method"`
	TotalAmount   float64       `json:"total_amount"`
	ItemCount     int           `json:"item_count"`
	CreatedAt     time.Time     `json:"created_at"`
}
